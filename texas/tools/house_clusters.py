"""Texas House county clusters under the county line rule (Tex. Const. art. III, sec. 26).

Finds partitions of the 254 counties into
  county   a county whose population fits k whole districts within the band
           (it holds exactly k districts, none crossing its line);
  surplus  a county too big for one district that fits no whole number:
           it keeps n = floor(pop / ideal) districts inside, and one crossing
           district joins its remainder with whole contiguous small counties;
  group    whole contiguous small counties forming exactly one district;
so that every district can lie in the band [ceil(0.95 I), floor(1.05 I)] and
the seats add up to 150.

Model (CP-SAT, root based): each small county joins exactly one root. A group's
root is its lowest-numbered member (symmetry breaking); a surplus cluster's root
is its surplus county. Contiguity: every member other than the root needs a
neighbour in the same cluster that is one hop closer to the root (shared
boundaries, not corners), which makes every cluster connected.

  python3 -m venv venv && venv/bin/pip install ortools
  venv/bin/python texas/tools/house_clusters.py counties.json out.json [count] [seconds]

counties.json: {"total": int, "counties": [{"code", "name", "pop", "nbrs": [code]}]}
"""
import heapq, json, math, random, sys
from ortools.sat.python import cp_model

src, out_path = sys.argv[1], sys.argv[2]
want = int(sys.argv[3]) if len(sys.argv) > 3 else 12
seconds = float(sys.argv[4]) if len(sys.argv) > 4 else 120.0

data = json.load(open(src))
total = data['total']
C = {c['code']: c for c in data['counties']}
I = total / 150
LO, HI = math.ceil(0.95 * I - 1e-9), math.floor(1.05 * I + 1e-9)
# Optional band override (HOUSE_LO / HOUSE_HI, persons) to study other bands
# whose overall range stays under 10%: HI - LO must be <= 19,430.
import os
if os.environ.get('HOUSE_LO'):
    LO, HI = int(os.environ['HOUSE_LO']), int(os.environ['HOUSE_HI'])
    assert HI - LO <= 19430, 'overall range would reach 10%'


def seat_range(p):
    a, b = max(1, math.ceil(p / HI - 1e-12)), math.floor(p / LO + 1e-12)
    return (a, b) if a <= b else None


whole, surplus, small = [], [], []
for c, e in C.items():
    if seat_range(e['pop']):
        whole.append(c)
    elif e['pop'] > HI:
        surplus.append(c)
    else:
        small.append(c)
n_in = {c: math.floor(C[c]['pop'] / I) for c in surplus}
s_rng = {c: (max(1, C[c]['pop'] - n_in[c] * HI), C[c]['pop'] - n_in[c] * LO) for c in surplus}
for c in surplus:
    assert 0 < s_rng[c][1] and s_rng[c][0] < HI, c
whole_min = sum(seat_range(C[c]['pop'])[0] for c in whole)
whole_max = sum(seat_range(C[c]['pop'])[1] for c in whole)
fixed = sum(n_in.values()) + len(surplus)
g_min, g_max = 150 - fixed - whole_max, 150 - fixed - whole_min
print(f'ideal {I:.4f} band {LO}..{HI}; whole {len(whole)} ({whole_min}-{whole_max} seats), surplus {len(surplus)} '
      f'(inside {sum(n_in.values())}), small {len(small)}; groups {g_min}..{g_max}', file=sys.stderr)

small_set = set(small)
idx = {c: i for i, c in enumerate(sorted(small))}


def hop_dist(root, allowed):
    d = {root: 0}
    q = [root]
    for u in q:
        for v in C[u]['nbrs']:
            if v in allowed and v not in d:
                d[v] = d[u] + 1
                q.append(v)
    return d


def pop_reach(root, allowed, cap):
    """Counties reachable from root through allowed counties with path population <= cap."""
    best = {}
    pq = [(C[root]['pop'], root)] if root in allowed else [(C[v]['pop'], v) for v in C[root]['nbrs'] if v in allowed]
    heapq.heapify(pq)
    while pq:
        dd, v = heapq.heappop(pq)
        if v in best or dd > cap:
            continue
        best[v] = dd
        for w in C[v]['nbrs']:
            if w in allowed and w not in best:
                heapq.heappush(pq, (dd + C[w]['pop'], w))
    return set(best)


group_cand, surplus_cand, dist = {}, {}, {}
for r in small:
    allowed = {c for c in small if idx[c] >= idx[r]}
    d = hop_dist(r, allowed)
    # reach allows for one county on the path being only partly included (a split)
    group_cand[r] = [c for c in pop_reach(r, allowed, 2 * HI) if c in d]
    dist[r] = d
# A surplus county's partners must be connected among themselves and enter the
# surplus county from one side (an entry county adjacent to it), so the crossing
# district is drawable: whole partner counties plus one piece of the surplus
# county next to the entry county. Each (surplus, entry) pair is a root.
entry_roots = {}
for t in surplus:
    entry_roots[t] = []
    for e in C[t]['nbrs']:
        if e not in small_set:
            continue
        root = (t, e)
        d = hop_dist(e, small_set)
        cap = 2 * HI - s_rng[t][0]
        surplus_cand[root] = [c for c in pop_reach(e, small_set, cap) if c in d]
        dist[root] = d
        entry_roots[t].append(root)
print(f'candidate pairs: {sum(map(len, group_cand.values())) + sum(map(len, surplus_cand.values()))}', file=sys.stderr)


def solve(seed, max_splits=None):
    """One clustering. A small county is split only where whole counties cannot
    work: then it belongs to exactly two clusters, each taking an integer share
    of its population (at least one person each)."""
    rnd = random.Random(seed)
    m = cp_model.CpModel()
    x, q = {}, {}
    for r, cs in list(group_cand.items()) + list(surplus_cand.items()):
        for c in cs:
            x[c, r] = m.NewBoolVar('')
            q[c, r] = m.NewIntVar(0, C[c]['pop'], '')
            m.Add(q[c, r] <= C[c]['pop'] * x[c, r])
            m.Add(q[c, r] >= x[c, r])
    split = {c: m.NewBoolVar('') for c in small}
    by_c = {c: [] for c in small}
    for (c, r) in x:
        by_c[c].append((x[c, r], q[c, r]))
    for c in small:
        m.Add(sum(v for v, _ in by_c[c]) == 1 + split[c])
        m.Add(sum(w for _, w in by_c[c]) == C[c]['pop'])
    y = {r: x[r, r] for r in small if (r, r) in x}
    m.Add(sum(y.values()) >= g_min)
    m.Add(sum(y.values()) <= g_max)
    for t in surplus:
        # exactly one entry county per surplus county
        m.AddExactlyOne([x[e, (t, e)] for (_, e) in entry_roots[t] if (e, (t, e)) in x])
    for root, cs in list(group_cand.items()) + list(surplus_cand.items()):
        is_group = not isinstance(root, tuple)
        if is_group and root not in y:
            continue
        pop = sum(q[c, root] for c in cs)
        if is_group:
            m.Add(pop >= LO * y[root])
            m.Add(pop <= HI * y[root])
            for c in cs:
                if c != root:
                    m.AddImplication(x[c, root], y[root])
            anchor = root
        else:
            t, e = root
            on = x[e, root]
            m.Add(pop >= max(1, LO - s_rng[t][1])).OnlyEnforceIf(on)
            m.Add(pop <= HI - s_rng[t][0]).OnlyEnforceIf(on)
            for c in cs:
                if c != e:
                    m.AddImplication(x[c, root], on)
            anchor = e
        d, cset = dist[root], set(cs)
        for c in cs:
            if c == anchor:
                continue
            closer = [v for v in C[c]['nbrs'] if v in d and d[v] == d[c] - 1]
            lits = [x[v, root] for v in closer if v in cset]
            if not lits:
                m.Add(x[c, root] == 0)
            else:
                m.AddBoolOr(lits).OnlyEnforceIf(x[c, root])
    nsplit = sum(split.values())
    if max_splits is None:
        m.Minimize(nsplit)
    else:
        m.Add(nsplit <= max_splits)
        m.Maximize(sum(rnd.randint(0, 20) * v for v in x.values()))
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = seconds
    s.parameters.num_workers = 4
    s.parameters.random_seed = seed
    if max_splits is not None:
        # Diversity stage: any lawful clustering will do; the random objective
        # and seed only steer which one is found first.
        s.parameters.stop_after_first_solution = True
        s.parameters.randomize_search = True
    st = s.Solve(m)
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        print(f'seed {seed}: {s.StatusName(st)} after {s.WallTime():.1f}s', file=sys.stderr)
        return None
    shares = lambda root, mem: {str(c): s.Value(q[c, root]) for c in mem if s.Value(split[c])}
    clusters = [{'kind': 'county', 'counties': [c]} for c in whole]
    for t in surplus:
        root = next(r for r in entry_roots[t] if (r[1], r) in x and s.Value(x[r[1], r]))
        mem = [t] + [c for c in surplus_cand[root] if s.Value(x[c, root])]
        cl = {'kind': 'surplus', 'counties': mem, 'surplus': [t], 'inside': {str(t): n_in[t]}, 'seats': n_in[t] + 1, 'entry': root[1]}
        sh = shares(root, mem[1:])
        if sh:
            cl['splitShare'] = sh
        clusters.append(cl)
    for r in y:
        if s.Value(y[r]):
            mem = [c for c in group_cand[r] if s.Value(x[c, r])]
            cl = {'kind': 'group', 'counties': mem, 'seats': 1}
            sh = shares(r, mem)
            if sh:
                cl['splitShare'] = sh
            clusters.append(cl)
    rest = 150 - sum(c.get('seats', 0) for c in clusters)
    ws = [c for c in clusters if c['kind'] == 'county']
    for c in ws:
        c['seats'] = seat_range(C[c['counties'][0]]['pop'])[0]
    rest -= sum(c['seats'] for c in ws)
    order = ws[:]
    rnd.shuffle(order)
    for c in order:
        a, b = seat_range(C[c['counties'][0]]['pop'])
        add = min(rest, b - c['seats'])
        c['seats'] += add
        rest -= add
    assert rest == 0, rest
    splits = [C[c]['name'] for c in small if s.Value(split[c])]
    print(f'seed {seed}: {s.StatusName(st)} in {s.WallTime():.1f}s, groups {sum(1 for c in clusters if c["kind"] == "group")}, '
          f'split small counties {splits}', file=sys.stderr)
    return clusters, int(s.Value(nsplit))


# Stage 1: the fewest small-county splits any lawful clustering needs (a proof
# of necessity when it is above zero). Stage 2: diverse clusterings at that count.
first = solve(0)
if not first:
    sys.exit('no clustering exists even with small-county splits')
min_splits = first[1]
print(f'minimum small-county splits: {min_splits}', file=sys.stderr)
if os.environ.get('STAGE1_ONLY'):
    sys.exit(0)
sols, seen = [], set()
seed = 1
while len(sols) < want and seed <= want * 4:
    r = solve(seed, max_splits=min_splits)
    seed += 1
    if not r:
        continue
    cl = r[0]
    key = tuple(sorted(tuple(sorted(c['counties'])) for c in cl))
    if key in seen:
        continue
    seen.add(key)
    sols.append(cl)
    json.dump({'ideal': I, 'lo': LO, 'hi': HI, 'minSmallSplits': min_splits, 'clusterings': sols}, open(out_path, 'w'))
print(f'{len(sols)} clusterings written', file=sys.stderr)
