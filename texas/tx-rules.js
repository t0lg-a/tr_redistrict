// tx-rules.js: Texas redistricting rules. County graph, Texas House county
// clustering (Tex. Const. art. III, sec. 26), and the plan validator.
// Loaded by texas/index.html (window.TXRules) and by node tests (module.exports).
(function (root) {
'use strict';

const TX = {};

// ── Unit graph helpers ────────────────────────────────────────────────────
// units: { pop: number[], county: number[] }, adj: Int32Array[] (geographic,
// shared-boundary adjacency; point contact is not adjacency).
TX.countyGraph = function (units, adj) {
  const byCode = new Map();
  const N = units.pop.length;
  for (let i = 0; i < N; i++) {
    const c = units.county[i];
    let e = byCode.get(c);
    if (!e) { e = { code: c, pop: 0, units: [], nbrs: new Set() }; byCode.set(c, e); }
    e.pop += units.pop[i]; e.units.push(i);
  }
  for (let i = 0; i < N; i++) {
    const a = units.county[i];
    for (const j of adj[i]) { const b = units.county[j]; if (a !== b) byCode.get(a).nbrs.add(b); }
  }
  return byCode;
};

function mkRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
TX.mkRng = mkRng;

// Integer seat counts n >= 1 for which pop/n lies inside [lo, hi] (inclusive).
function seatRange(pop, lo, hi) {
  const a = Math.max(1, Math.ceil(pop / hi - 1e-12)), b = Math.floor(pop / lo + 1e-12);
  return a <= b ? [a, b] : null;
}
TX.seatRange = seatRange;

// ── Texas House county classification ─────────────────────────────────────
// A county is 'whole' when its population can be divided into n whole districts
// each within the population bounds (it must then contain exactly those
// districts and no district may cross its line); 'surplus' when it is larger
// than one district but no whole number of districts fits (it keeps
// floor-many districts inside and joins its surplus with contiguous
// counties); 'small' when it is smaller than a district (it is kept whole and
// joined with contiguous counties).
TX.classifyCounty = function (pop, lo, hi) {
  const r = seatRange(pop, lo, hi);
  if (r) return { type: 'whole', seats: r };
  if (pop > hi) return { type: 'surplus', seats: null };
  return { type: 'small', seats: null };
};

// ── Texas House county clustering ─────────────────────────────────────────
// Every district is one of:
//   inside   - wholly inside one 'whole' or 'surplus' county;
//   group    - whole 'small' counties only (exactly one district);
//   crossing - the surplus of one or more 'surplus' counties plus whole
//              contiguous counties; each surplus county is crossed by at most
//              opts.crossLimit (default 1) districts.
// A cluster is a set of counties drawn together:
//   { kind: 'county',  counties: [c], seats }               whole county
//   { kind: 'group',   counties: [...small], seats: 1 }
//   { kind: 'surplus', counties: [...], surplus: [...], inside: {c: n}, seats }
// Surplus county c with n inside districts leaves a surplus in
// [pop - n*hi, pop - n*lo], which must be > 0 and fit in the crossing district.
TX.surplusOptions = function (pop, lo, hi) {
  const out = [];
  for (let n = 1; n * lo < pop; n++) {
    const sMin = Math.max(1, pop - n * hi), sMax = pop - n * lo;
    if (sMax <= 0 || sMin >= hi) continue;
    out.push({ n, sMin, sMax: Math.min(sMax, hi) });
  }
  return out;
};

// Exact rebuild of a region by depth-first search.
//   smalls:  small counties to place (all unassigned)
//   anchors: [{ id, members: Set (its surplus county/counties), win: [a, b] }]
//            each anchor must end with small population in [a, b], its smalls
//            connected to it through the anchor's members;
//   g:       number of one-district groups to form, each in [lo, hi].
// Returns Map(county -> anchor id | 'g0'.. 'g{g-1}') or null.
TX.exactRegion = function (cg, smalls, anchors, g, lo, hi, opts = {}) {
  const P = (c) => cg.get(c).pop;
  const rng = opts.rng || Math.random;
  let budget = opts.budget || 200000;
  const U = new Set(smalls);
  const res = new Map();
  const cur = anchors.map(() => 0);
  const mem = anchors.map(a => new Set(a.members));
  let groupsLeft = g;
  const adjToAnchor = (u, i) => { for (const v of cg.get(u).nbrs) if (mem[i].has(v)) return true; return false; };

  // Each component of U must be absorbable: some m groups plus spare anchor room.
  function feasible() {
    const seen = new Set();
    let groupsNeeded = 0, groupsMax = 0;
    const needA = anchors.map((a, i) => Math.max(0, a.win[0] - cur[i]));
    const reach = anchors.map(() => 0);
    for (const c of U) {
      if (seen.has(c)) continue;
      const comp = [c]; seen.add(c); let pop = 0; const touch = new Set();
      for (let i = 0; i < comp.length; i++) {
        const u = comp[i]; pop += P(u);
        for (const v of cg.get(u).nbrs) {
          if (U.has(v)) { if (!seen.has(v)) { seen.add(v); comp.push(v); } }
          else anchors.forEach((a, ai) => { if (mem[ai].has(v)) touch.add(ai); });
        }
      }
      let cap = 0; for (const ai of touch) { cap += Math.max(0, anchors[ai].win[1] - cur[ai]); reach[ai] += pop; }
      // pop = groups + absorbed, absorbed in [0, cap], groups m with m*lo <= pop - absorbed <= m*hi
      let ok = false, mMin = Infinity, mMax = -1;
      for (let m = 0; m * lo <= pop; m++) {
        const need0 = pop - m * hi, need1 = pop - m * lo;   // absorbed must be in [need0, need1]
        if (Math.max(0, need0) <= Math.min(cap, need1)) { ok = true; mMin = Math.min(mMin, m); mMax = Math.max(mMax, m); }
      }
      if (!ok) return false;
      groupsNeeded += mMin; groupsMax += mMax;
    }
    if (groupsNeeded > groupsLeft || groupsMax < groupsLeft) return false;
    for (let i = 0; i < anchors.length; i++) if (needA[i] > reach[i]) return false;
    return true;
  }

  // Connected subsets of U containing u with population in [lo, hi].
  function groupsFrom(u, limit) {
    const out = [];
    const rec = (set, pop, frontier) => {
      if (out.length >= limit || budget <= 0) return;
      if (pop >= lo) { out.push([...set]); if (pop + 0 > hi) return; }
      const fr = [...frontier];
      for (let i = fr.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [fr[i], fr[j]] = [fr[j], fr[i]]; }
      for (let i = 0; i < fr.length; i++) {
        const v = fr[i];
        if (pop + P(v) > hi) continue;
        // Canonical order: only extend with frontier nodes after i, to avoid duplicates.
        const nf = new Set(fr.slice(i + 1));
        for (const w of cg.get(v).nbrs) if (U.has(w) && !set.has(w) && w !== v) nf.add(w);
        for (const x of set) nf.delete(x);
        nf.delete(v);
        set.add(v); budget--;
        rec(set, pop + P(v), nf);
        set.delete(v);
        if (out.length >= limit) return;
      }
    };
    const f0 = new Set(); for (const w of cg.get(u).nbrs) if (U.has(w)) f0.add(w);
    rec(new Set([u]), P(u), f0);
    return out.filter(gp => { const p = gp.reduce((s, c) => s + P(c), 0); return p >= lo && p <= hi; });
  }

  function dfs() {
    if (--budget <= 0) return false;
    if (!U.size) return groupsLeft === 0 && anchors.every((a, i) => cur[i] >= a.win[0] && cur[i] <= a.win[1]);
    if (!feasible()) return false;
    // Most constrained county: fewest unassigned neighbours.
    let u = null, best = Infinity;
    for (const c of U) { let n = 0; for (const v of cg.get(c).nbrs) if (U.has(v)) n++; if (n < best) { best = n; u = c; } }
    const options = [];
    anchors.forEach((a, i) => { if (adjToAnchor(u, i) && cur[i] + P(u) <= a.win[1]) options.push(['a', i]); });
    if (groupsLeft > 0) for (const gp of groupsFrom(u, 60)) options.push(['g', gp]);
    for (let i = options.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [options[i], options[j]] = [options[j], options[i]]; }
    for (const [kind, x] of options) {
      if (kind === 'a') {
        U.delete(u); mem[x].add(u); cur[x] += P(u); res.set(u, anchors[x].id);
        if (dfs()) return true;
        U.add(u); mem[x].delete(u); cur[x] -= P(u); res.delete(u);
      } else {
        const gid = 'g' + (g - groupsLeft);
        for (const c of x) { U.delete(c); res.set(c, gid); }
        groupsLeft--;
        if (dfs()) return true;
        groupsLeft++;
        for (const c of x) { U.add(c); res.delete(c); }
      }
      if (budget <= 0) return false;
    }
    return false;
  }
  return dfs() ? res : null;
};

TX.clusterHouse = function (cg, opts) {
  const { lo, hi, seats: K, seed = 1, restarts = 10, sweeps = 3000, lnsRounds = 3000 } = opts;
  const rng = mkRng(seed);
  const cls = new Map();
  for (const [c, e] of cg) cls.set(c, TX.classifyCounty(e.pop, lo, hi));
  const P = (c) => cg.get(c).pop;
  const whole = [...cg.keys()].filter(c => cls.get(c).type === 'whole');
  const surplusCounties = [...cg.keys()].filter(c => cls.get(c).type === 'surplus');
  const small = [...cg.keys()].filter(c => cls.get(c).type === 'small');
  const sOpt = new Map(surplusCounties.map(c => [c, TX.surplusOptions(P(c), lo, hi)]));
  const ideal = (lo + hi) / 2;
  const wholeMin = whole.reduce((s, c) => s + cls.get(c).seats[0], 0);
  const wholeMax = whole.reduce((s, c) => s + cls.get(c).seats[1], 0);
  const smallTotal = small.reduce((s, c) => s + P(c), 0);
  const pick = (a) => a[(rng() * a.length) | 0];

  function run() {
    // Inside-district choice per surplus county (random among options).
    const opt = new Map(surplusCounties.map(c => [c, pick(sOpt.get(c))]));
    const surplusSeats = surplusCounties.reduce((s, c) => s + opt.get(c).n + 1, 0);
    // Small population the crossing districts absorb, at the middle of each window.
    let absorbMid = 0;
    for (const c of surplusCounties) { const o = opt.get(c); absorbMid += ideal - (o.sMin + o.sMax) / 2; }
    const gFloat = (smallTotal - absorbMid) / ideal;
    const gChoices = [];
    for (let g = Math.floor(gFloat) - 1; g <= Math.ceil(gFloat) + 1; g++) {
      const w = K - surplusSeats - g;
      if (g >= 0 && w >= wholeMin && w <= wholeMax) gChoices.push(g);
    }
    if (!gChoices.length) return null;
    const G = pick(gChoices);

    // Clusters: surplus clusters first (index = position in surplusCounties), then groups.
    const nCl = surplusCounties.length + G;
    const owner = new Map();
    const members = Array.from({ length: nCl }, () => new Set());
    const smallPop = new Float64Array(nCl);
    surplusCounties.forEach((c, i) => { owner.set(c, i); members[i].add(c); });
    // Group seeds: spread out by farthest-first over county hops.
    const hop = (src) => { const d = new Map([[src, 0]]), q = [src]; for (let i = 0; i < q.length; i++) { const u = q[i]; for (const v of cg.get(u).nbrs) if (!d.has(v) && cls.get(v).type !== 'whole') { d.set(v, d.get(u) + 1); q.push(v); } } return d; };
    const seeds = [];
    const minD = new Map(small.map(c => [c, Infinity]));
    for (const c of surplusCounties) for (const [v, d] of hop(c)) if (minD.has(v)) minD.set(v, Math.min(minD.get(v), d));
    for (let g = 0; g < G; g++) {
      let best = null, bd = -1;
      for (const c of small) { if (owner.has(c)) continue; const d = minD.get(c) + rng() * 0.5; if (d > bd) { bd = d; best = c; } }
      if (!best) return null;
      const ci = surplusCounties.length + g;
      owner.set(best, ci); members[ci].add(best); smallPop[ci] += P(best); seeds.push(best);
      for (const [v, d] of hop(best)) if (minD.has(v)) minD.set(v, Math.min(minD.get(v), d));
    }
    // Simultaneous growth: the neediest cluster takes a free neighbour.
    const target = (ci) => ci < surplusCounties.length ? ideal - (opt.get(surplusCounties[ci]).sMin + opt.get(surplusCounties[ci]).sMax) / 2 : ideal;
    let free = small.filter(c => !owner.has(c)).length;
    while (free > 0) {
      let bestCi = -1, bestNeed = -Infinity, bestV = null;
      for (let ci = 0; ci < nCl; ci++) {
        const need = (target(ci) - smallPop[ci]) / ideal + rng() * 0.05;
        if (need <= bestNeed) continue;
        const fr = [];
        for (const u of members[ci]) for (const v of cg.get(u).nbrs) if (!owner.has(v) && cls.get(v).type === 'small') fr.push(v);
        if (!fr.length) continue;
        bestNeed = need; bestCi = ci; bestV = pick(fr);
      }
      if (bestCi < 0) break;
      owner.set(bestV, bestCi); members[bestCi].add(bestV); smallPop[bestCi] += P(bestV); free--;
    }
    if (free > 0) return null;   // unreachable pockets (walled in by whole counties)

    // Violation of a cluster given its small population.
    const viol = (ci, sp) => {
      let a, b;
      if (ci < surplusCounties.length) { const o = opt.get(surplusCounties[ci]); a = Math.max(1, lo - o.sMax); b = hi - o.sMin; }
      else { a = lo; b = hi; }
      return sp < a ? a - sp : sp > b ? sp - b : 0;
    };
    let total = 0; for (let ci = 0; ci < nCl; ci++) total += viol(ci, smallPop[ci]);
    // Connectivity of cluster ci without county x (surplus clusters are rooted at their surplus county).
    const connectedWithout = (ci, x) => {
      const m = members[ci]; if (m.size <= 1) return false;
      const root = ci < surplusCounties.length ? surplusCounties[ci] : [...m].find(y => y !== x);
      if (root === x) return false;
      const seen = new Set([root]), q = [root];
      for (let i = 0; i < q.length; i++) for (const v of cg.get(q[i]).nbrs) if (v !== x && m.has(v) && !seen.has(v)) { seen.add(v); q.push(v); }
      return seen.size === m.size - 1;
    };
    // Targeted repair: take an out-of-window cluster and apply the best single
    // boundary move that pulls a county in (too small) or pushes one out (too
    // big), annealed so it can walk through plateaus.
    let T = ideal * 0.05;
    const nS = surplusCounties.length;
    for (let it = 0; it < sweeps && total > 0.5; it++) {
      const bad = [];
      for (let ci = 0; ci < nCl; ci++) if (viol(ci, smallPop[ci]) > 0) bad.push(ci);
      const ci = pick(bad);
      const cands = [];
      const consider = (x, from, to) => {
        if (cls.get(x).type !== 'small' || from === to) return;
        const px = P(x);
        const d = viol(from, smallPop[from] - px) + viol(to, smallPop[to] + px) - viol(from, smallPop[from]) - viol(to, smallPop[to]);
        cands.push([d, x, from, to]);
      };
      for (const u of members[ci]) for (const v of cg.get(u).nbrs) {
        const o = owner.get(v); if (o === undefined || o === ci) continue;
        consider(v, o, ci);   // pull v into ci
        consider(u, ci, o);   // push u out to o
      }
      if (!cands.length) continue;
      cands.sort((a, b) => a[0] - b[0]);
      let done = false;
      for (let j = 0; j < cands.length && j < 12 && !done; j++) {
        const [d, x, from, to] = cands[j === 0 || rng() < 0.7 ? j : (rng() * cands.length) | 0];
        if (d > 0 && rng() >= Math.exp(-d / T)) continue;
        if (!connectedWithout(from, x)) continue;
        members[from].delete(x); members[to].add(x); owner.set(x, to);
        smallPop[from] -= P(x); smallPop[to] += P(x); total += d; done = true;
      }
      if (it % 200 === 0) T *= 0.97;
    }

    // Large-neighbourhood repair: dissolve a failing cluster together with the
    // clusters around it (surplus counties stay as anchors) and rebuild that
    // region many times, keeping the best rebuild. Seat-neutral: the region
    // gets back the same number of group districts.
    const window_ = (ci) => {
      if (ci < nS) { const o = opt.get(surplusCounties[ci]); return [Math.max(1, lo - o.sMax), hi - o.sMin]; }
      return [lo, hi];
    };
    let stale = 0;
    for (let it = 0; it < lnsRounds && total > 0.5; it++) {
      const bad = [];
      for (let ci = 0; ci < nCl; ci++) if (viol(ci, smallPop[ci]) > 0) bad.push(ci);
      const a = pick(bad);
      // Region: a plus neighbouring clusters, widened when repeatedly stuck.
      const region = new Set([a]);
      const rings = 1 + (stale > 10 ? 1 : 0) + (stale > 30 ? 1 : 0) + (stale > 80 ? 1 : 0);
      if (stale > 150) stale = 0;
      for (let r = 0; r < rings; r++) {
        for (const ci of [...region]) for (const u of members[ci]) for (const v of cg.get(u).nbrs) {
          const o = owner.get(v); if (o !== undefined) region.add(o);
        }
      }
      const regCl = [...region];
      const before = regCl.reduce((s, ci) => s + viol(ci, smallPop[ci]), 0);
      const regSmall = [];
      for (const ci of regCl) for (const u of members[ci]) if (cls.get(u).type === 'small') regSmall.push(u);
      const inReg = new Set(regSmall);
      let best = null;
      {
        const anchorsX = regCl.filter(ci => ci < nS).map(ci => ({ id: ci, members: new Set([surplusCounties[ci]]), win: window_(ci) }));
        const groupIds = regCl.filter(ci => ci >= nS);
        const sol = TX.exactRegion(cg, regSmall, anchorsX, groupIds.length, lo, hi, { rng, budget: 40000 });
        if (sol) {
          const mem = new Map(regCl.map(ci => [ci, new Set(ci < nS ? [surplusCounties[ci]] : [])]));
          const sp = new Map(regCl.map(ci => [ci, 0]));
          const own = new Map();
          for (const [c, id] of sol) {
            const ci = typeof id === 'string' ? groupIds[+id.slice(1)] : id;
            mem.get(ci).add(c); sp.set(ci, sp.get(ci) + P(c)); own.set(c, ci);
          }
          best = { tot: 0, mem, sp, own };
        }
      }
      for (let tr = 0; tr < (best ? 0 : 40); tr++) {
        const mem = new Map(regCl.map(ci => [ci, new Set(ci < nS ? [surplusCounties[ci]] : [])]));
        const sp = new Map(regCl.map(ci => [ci, 0]));
        const own = new Map();
        // Seed each group cluster with a random region county.
        const groupsHere = regCl.filter(ci => ci >= nS);
        const pool = regSmall.slice();
        let okSeeds = true;
        for (const ci of groupsHere) {
          if (!pool.length) { okSeeds = false; break; }
          const j = (rng() * pool.length) | 0, u = pool[j]; pool.splice(j, 1);
          mem.get(ci).add(u); sp.set(ci, P(u)); own.set(u, ci);
        }
        if (!okSeeds) continue;
        let left = regSmall.length - groupsHere.length;
        while (left > 0) {
          let bc = -1, bn = -Infinity, bv = null;
          for (const ci of regCl) {
            const [wl, wh] = window_(ci);
            const need = ((wl + wh) / 2 - sp.get(ci)) / ideal + rng() * 0.1;
            if (need <= bn) continue;
            const fr = [];
            for (const u of mem.get(ci)) for (const v of cg.get(u).nbrs) if (inReg.has(v) && !own.has(v)) fr.push(v);
            if (!fr.length) continue;
            bn = need; bc = ci; bv = pick(fr);
          }
          if (bc < 0) break;
          mem.get(bc).add(bv); own.set(bv, bc); sp.set(bc, sp.get(bc) + P(bv)); left--;
        }
        if (left > 0) continue;
        // Short targeted flips inside the region.
        const vr = (ci, x) => { const [wl, wh] = window_(ci); return x < wl ? wl - x : x > wh ? x - wh : 0; };
        const conn = (ci, x) => {
          const m = mem.get(ci); if (m.size <= 1) return false;
          const root = ci < nS ? surplusCounties[ci] : [...m].find(y => y !== x);
          if (root === x) return false;
          const seen = new Set([root]), q = [root];
          for (let i = 0; i < q.length; i++) for (const v of cg.get(q[i]).nbrs) if (v !== x && m.has(v) && !seen.has(v)) { seen.add(v); q.push(v); }
          return seen.size === m.size - 1;
        };
        let tot = regCl.reduce((s, ci) => s + vr(ci, sp.get(ci)), 0);
        for (let f = 0; f < 150 && tot > 0.5; f++) {
          const badR = regCl.filter(ci => vr(ci, sp.get(ci)) > 0);
          const ci = pick(badR);
          const cands = [];
          for (const u of mem.get(ci)) for (const v of cg.get(u).nbrs) {
            if (!inReg.has(v) && !inReg.has(u)) continue;
            const o = own.get(v);
            if (o !== undefined && o !== ci) {
              const px = P(v); cands.push([vr(o, sp.get(o) - px) + vr(ci, sp.get(ci) + px) - vr(o, sp.get(o)) - vr(ci, sp.get(ci)), v, o, ci]);
            }
            if (o !== undefined && o !== ci && own.get(u) === ci) {
              const px = P(u); cands.push([vr(ci, sp.get(ci) - px) + vr(o, sp.get(o) + px) - vr(ci, sp.get(ci)) - vr(o, sp.get(o)), u, ci, o]);
            }
          }
          if (!cands.length) break;
          cands.sort((x, y) => x[0] - y[0]);
          const c = cands[rng() < 0.8 ? 0 : (rng() * cands.length) | 0];
          if (c[0] > 0 && rng() > 0.2) continue;
          const [d, x, from, to] = c;
          if (!conn(from, x)) continue;
          mem.get(from).delete(x); mem.get(to).add(x); own.set(x, to);
          sp.set(from, sp.get(from) - P(x)); sp.set(to, sp.get(to) + P(x)); tot += d;
        }
        if (!best || tot < best.tot) best = { tot, mem, sp, own };
        if (tot <= 0.5) break;
      }
      if (!best || best.tot >= before) { stale++; continue; }
      stale = 0;
      for (const ci of regCl) { members[ci] = best.mem.get(ci); smallPop[ci] = best.sp.get(ci); }
      for (const [u, ci] of best.own) owner.set(u, ci);
      total += best.tot - before;
    }
    if (total > 0.5) return null;

    const out = [];
    for (const c of whole) out.push({ kind: 'county', counties: [c], seats: cls.get(c).seats[0] });
    surplusCounties.forEach((c, ci) => {
      const o = opt.get(c);
      out.push({ kind: 'surplus', counties: [...members[ci]], surplus: [c], inside: { [c]: o.n }, seats: o.n + 1,
        smallPop: smallPop[ci], surplusWindow: [o.sMin, o.sMax] });
    });
    for (let ci = surplusCounties.length; ci < nCl; ci++) out.push({ kind: 'group', counties: [...members[ci]], seats: 1 });
    // Whole-county seat counts: fill up to K within their ranges.
    let extra = K - out.reduce((s, c) => s + c.seats, 0);
    for (const cl of out) if (cl.kind === 'county' && extra > 0) { const r = cls.get(cl.counties[0]).seats; const add = Math.min(extra, r[1] - cl.seats); cl.seats += add; extra -= add; }
    if (extra !== 0) return null;
    return out;
  }

  for (let a = 0; a < restarts; a++) {
    const r = run();
    if (r) return { ok: true, clusters: r, attempts: a + 1, classes: cls };
  }
  return { ok: false, clusters: [], attempts: restarts, classes: cls };
};

// ── Piece graph ────────────────────────────────────────────────────────────
// Some census VTDs are in several pieces. For contiguity to hold at the level
// of territory, each piece must connect to its district on its own. The worker
// graph therefore has one node per piece: node u is unit u (its first piece),
// and nodes N.. are the other pieces, glued to their unit (same district).
// An island piece that touches no other unit is joined to its own unit.
TX.pieceGraph = function (N, adj, pieces) {
  pieces = pieces || {};
  const extraOf = [];                       // extra node -> unit
  const nodesOf = new Map();                // multipart unit -> [node per piece]
  for (const [us, ps] of Object.entries(pieces)) {
    const u = +us, ids = [u];
    for (let p = 1; p < ps.length; p++) { ids.push(N + extraOf.length); extraOf.push(u); }
    nodesOf.set(u, ids);
  }
  const M = N + extraOf.length;
  const out = Array.from({ length: M }, () => new Set());
  // Node(s) of unit v that touch unit u.
  const touching = (v, u) => {
    const ids = nodesOf.get(v);
    if (!ids) return [v];
    const r = [];
    pieces[v].forEach((nb, p) => { if (nb.includes(u)) r.push(ids[p]); });
    return r;
  };
  for (let u = 0; u < N; u++) {
    const ids = nodesOf.get(u);
    if (!ids) { for (const v of adj[u]) for (const w of touching(v, u)) { out[u].add(w); out[w].add(u); } continue; }
    pieces[u].forEach((nb, p) => {
      const a = ids[p];
      for (const v of nb) for (const w of touching(v, u)) { out[a].add(w); out[w].add(a); }
      if (!nb.length) for (const b of ids) if (b !== a) { out[a].add(b); out[b].add(a); }
    });
  }
  const glue = [...nodesOf.values()];
  return { M, N, adj: out.map(s => [...s]), extraOf, glue, unitOf: (n) => n < N ? n : extraOf[n - N] };
};

// ── House: clusters to worker jobs ─────────────────────────────────────────
// A clustering (from texas/regions/house_clusters.json) lists clusters of
// county codes with seat counts. Clusters that share a split small county are
// drawn together as one job. In a job, every small county that must stay whole
// is contracted to one node; surplus and split counties keep their VTDs.
// crossLimit: surplus counties may be crossed by one district, a split small
// county by two (it is divided between exactly two districts).
TX.houseJobs = function (clustering, ctx) {
  const N = ctx.pop.length;
  const PG = ctx.pieceGraph || TX.pieceGraph(N, ctx.adj, ctx.pieces);
  const nodesOfUnit = (u) => { const r = [u]; for (let e = 0; e < PG.extraOf.length; e++) if (PG.extraOf[e] === u) r.push(N + e); return r; };
  const extrasOf = new Map();
  PG.extraOf.forEach((u, e) => { if (!extrasOf.has(u)) extrasOf.set(u, []); extrasOf.get(u).push(N + e); });
  const unitsOf = new Map();
  for (let i = 0; i < N; i++) { const c = ctx.county[i]; if (!unitsOf.has(c)) unitsOf.set(c, []); unitsOf.get(c).push(i); }
  const cls = clustering.map(c => ({ ...c, counties: c.counties.map(Number) }));
  // Union clusters that share a county (a split county appears in two).
  const parent = cls.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const seenIn = new Map();
  cls.forEach((c, i) => c.counties.forEach(k => { if (seenIn.has(k)) parent[find(i)] = find(seenIn.get(k)); else seenIn.set(k, i); }));
  const groups = new Map();
  cls.forEach((c, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
  const jobs = [];
  for (const parts of groups.values()) {
    const counties = new Set(), surplus = new Set(), count = new Map();
    let seats = 0;
    for (const c of parts) {
      seats += c.seats;
      for (const k of c.counties) { counties.add(k); count.set(k, (count.get(k) || 0) + 1); }
      for (const k of (c.surplus || [])) surplus.add(+k);
    }
    const split = new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
    const kind = parts.length > 1 ? 'split' : parts[0].kind;
    // Nodes: every piece of every VTD in whole / surplus / split counties; one
    // node for each other (small, kept whole) county. node.units lists the
    // units a node decides (extra pieces decide none: they follow their unit).
    const nodes = [];
    const nodeOfPG = new Map();
    const glue = [];
    for (const k of counties) {
      const us = unitsOf.get(k) || [];
      const keepVTDs = kind === 'county' || surplus.has(k) || split.has(k);
      if (keepVTDs) {
        for (const u of us) {
          nodeOfPG.set(u, nodes.length); nodes.push({ units: [u], county: k });
          const ex = extrasOf.get(u);
          if (ex) {
            const g = [nodes.length - 1];
            for (const e of ex) { nodeOfPG.set(e, nodes.length); g.push(nodes.length); nodes.push({ units: [], county: k, pieceOf: u }); }
            glue.push(g);
          }
        }
      } else {
        const id = nodes.length; nodes.push({ units: us.slice(), county: k });
        for (const u of us) { nodeOfPG.set(u, id); for (const e of (extrasOf.get(u) || [])) nodeOfPG.set(e, id); }
      }
    }
    const adj = nodes.map(() => new Set());
    for (const [pn, a] of nodeOfPG) for (const w of PG.adj[pn]) { const b = nodeOfPG.get(w); if (b !== undefined && b !== a) adj[a].add(b); }
    const sum = (nd, arr) => nd.units.reduce((t, u) => t + arr[u], 0);
    const cross = [];
    for (const k of surplus) cross.push([k, 1]);
    for (const k of split) cross.push([k, 2]);
    jobs.push({
      kind, seats, counties: [...counties], surplus: [...surplus], split: [...split], nodes,
      adj: adj.map(s => [...s]), glue,
      pop: nodes.map(nd => sum(nd, ctx.pop)),
      r: nodes.map(nd => sum(nd, ctx.rep)), d: nodes.map(nd => sum(nd, ctx.dem)),
      il: nodes.map(nd => nd.county), cross,
    });
  }
  return jobs;
};

// Plan metrics computed from a full assignment, in the same form (and with the
// same formulas) as the worker's metricsFromState. Used for House plans that
// are assembled from many cluster jobs.
TX.planMetrics = function (ctx, assignment, k) {
  const N = ctx.pop.length;
  const total = ctx.pop.reduce((a, b) => a + b, 0), ideal = total / k;
  const pops = new Float64Array(k), rs = new Float64Array(k), ds = new Float64Array(k);
  const touch = new Map();
  for (let i = 0; i < N; i++) {
    const d = assignment[i];
    pops[d] += ctx.pop[i]; rs[d] += ctx.rep[i]; ds[d] += ctx.dem[i];
    const c = ctx.county[i]; if (!touch.has(c)) touch.set(c, new Set()); touch.get(c).add(d);
  }
  let cut = 0;
  for (let i = 0; i < N; i++) for (const j of ctx.adj[i]) if (j > i && assignment[j] !== assignment[i]) cut++;
  let maxDev = 0, mWin = 0, kWin = 0, wd = 0, wr = 0, tot = 0, mean = 0, marginSum = 0;
  const shares = new Float64Array(k);
  for (let d = 0; d < k; d++) {
    const dev = Math.abs(pops[d] - ideal) / ideal; if (dev > maxDev) maxDev = dev;
    const t = ds[d] + rs[d], sh = t > 0 ? ds[d] / t : 0.5;
    shares[d] = sh; mean += sh; marginSum += 2 * Math.abs(sh - 0.5);
    if (sh > 0.5) { mWin++; wd += (sh - 0.5) * t; wr += (1 - sh) * t; }
    else { kWin++; wd += sh * t; wr += (0.5 - sh) * t; }
    tot += t;
  }
  mean /= k;
  const sorted = Array.from(shares).sort((a, b) => a - b);
  const median = k % 2 ? sorted[(k - 1) >> 1] : 0.5 * (sorted[k / 2 - 1] + sorted[k / 2]);
  let splits = 0; for (const s of touch.values()) splits += s.size - 1;
  return { popDev: maxDev, cutEdges: cut, effGap: tot > 0 ? (wd - wr) / tot : 0, meanMed: mean - median,
    competitiveness: marginSum / k, muhSeats: mWin, iktSeats: kWin, ilSplits: splits, viol: 0 };
};

// ── Chamber parameters (2020 Census, PL 94-171 total population) ──────────
// Exact thresholds come from integers: see texas/RULES.md for sources.
TX.chamberParams = function (chamber, totalPop) {
  const seats = { house: 150, senate: 31, congress: 38 }[chamber];
  const ideal = totalPop / seats;
  const p = { chamber, seats, ideal, totalPop };
  if (chamber === 'house') {
    // +/-5% band, inclusive integers: ceil(0.95 I) .. floor(1.05 I).
    p.lo = Math.ceil(0.95 * ideal - 1e-9); p.hi = Math.floor(1.05 * ideal + 1e-9);
    p.countyLine = true;
  } else if (chamber === 'senate') {
    // Overall range must be < 10% of ideal: seats*10*(max-min) < totalPop.
    p.maxRange = Math.ceil(totalPop / (seats * 10)) - 1;
    // Generation band: +/-5% (strict), which guarantees range < 10%.
    p.lo = Math.ceil(0.95 * ideal + 1e-9); p.hi = Math.floor(1.05 * ideal - 1e-9);
  } else {
    // Congress: equal population "as nearly as practicable". Whole-VTD plans
    // cannot reach the enacted 0-1 person range; the generator minimises it.
    p.lo = Math.floor(ideal); p.hi = Math.ceil(ideal);
    p.maxRange = 1;
  }
  return p;
};

// True when a range of r people is 10% of the ideal or more.
function k10(r, seats, total) { return seats * 10 * r >= total; }

// Connected components of `nodes` in the adjacency graph restricted to them.
function components(nodes, adj, member) {
  const seen = new Set(), comps = [];
  for (const s of nodes) {
    if (seen.has(s)) continue;
    const c = [s]; seen.add(s);
    for (let i = 0; i < c.length; i++) for (const v of adj[c[i]]) if (member(v) && !seen.has(v)) { seen.add(v); c.push(v); }
    comps.push(c);
  }
  return comps;
}

// ── Plan validator ─────────────────────────────────────────────────────────
// ctx: { pop: number[], county: number[], countyName: Map, adj: Int32Array[]
//        (rook adjacency, no artificial bridges), vap?: {h,b,a,w,t: number[]} }
// assignment: district index per unit (0..seats-1), -1 = unassigned.
// Returns { chamber, ok, checks: [{ id, label, level, pass, detail }], stats }.
// level: 'law' (binding), 'presumptive', 'practice', 'report' (information only).
TX.validate = function (chamber, ctx, assignment, opts = {}) {
  const N = ctx.pop.length;
  const total = ctx.pop.reduce((a, b) => a + b, 0);
  const P = TX.chamberParams(chamber, total);
  // House band override: another band whose overall range stays under 10%
  // (the strict reading of the county line rule). It sets both the district
  // band and the county classes.
  if (chamber === 'house' && opts.band) {
    P.lo = opts.band[0]; P.hi = opts.band[1];
    if (k10(P.hi - P.lo, P.seats, total)) throw new Error('band range must stay under 10%');
  }
  const k = P.seats;
  const checks = [], stats = {};
  const add = (id, label, level, pass, detail) => checks.push({ id, label, level, pass, detail });
  const cname = (c) => (ctx.countyName && ctx.countyName.get(c)) || String(c);

  // Completeness and seat count.
  const dPop = new Float64Array(k), dUnits = Array.from({ length: k }, () => []);
  let unassigned = 0, outOfRange = 0;
  for (let i = 0; i < N; i++) {
    const d = assignment[i];
    if (d == null || d < 0) { unassigned++; continue; }
    if (d >= k) { outOfRange++; continue; }
    dPop[d] += ctx.pop[i]; dUnits[d].push(i);
  }
  const empty = dUnits.filter(u => !u.length).length;
  add('seats', `${k} single-member districts, every unit assigned`, 'law',
    unassigned === 0 && outOfRange === 0 && empty === 0,
    `${k - empty} of ${k} districts used; ${unassigned} unassigned units; ${outOfRange} units with an invalid district`);
  const sumPop = dPop.reduce((a, b) => a + b, 0);
  add('total-pop', 'District populations add up to the 2020 Census total', 'law',
    sumPop === total && total === 29145505, `${sumPop.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`);

  // Contiguity (shared boundary of positive length; point contact does not count).
  // Units whose territory is in several pieces (ctx.pieces: unit -> neighbour
  // list per piece) are checked piece by piece: every piece must connect to the
  // rest of its district. A piece that touches no other unit at all (an island
  // piece) is taken as joined to its own unit by water.
  const inD = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) inD[i] = assignment[i];
  const pieces = ctx.pieces || {};
  const discontig = [];
  let islandPieces = 0;
  for (const ps of Object.values(pieces)) for (const nb of ps) if (!nb.length) islandPieces++;
  for (let d = 0; d < k; d++) {
    if (!dUnits[d].length) continue;
    // Node ids: 'u' for a whole unit, 'u:p' for piece p of a multipart unit.
    const nodes = [];
    for (const u of dUnits[d]) { const ps = pieces[u]; if (ps) ps.forEach((_, p) => nodes.push(u + ':' + p)); else nodes.push(String(u)); }
    const nbrs = (id) => {
      const [us, ps] = id.split(':'); const u = +us;
      const out = [];
      const list = ps === undefined ? ctx.adj[u] : pieces[u][+ps];
      // Island pieces (no neighbours at all) are joined to the other pieces of
      // their own unit, in both directions.
      if (ps !== undefined) pieces[u].forEach((nb, q) => { if (q !== +ps && (!list.length || !nb.length)) out.push(u + ':' + q); });
      for (const v of list) {
        if (inD[v] !== d) continue;
        const pv = pieces[v];
        if (!pv) { out.push(String(v)); continue; }
        pv.forEach((nb, q) => { if (nb.includes(u)) out.push(v + ':' + q); });
      }
      return out;
    };
    const seen = new Set([nodes[0]]), q = [nodes[0]];
    for (let i = 0; i < q.length; i++) for (const w of nbrs(q[i])) if (!seen.has(w)) { seen.add(w); q.push(w); }
    if (seen.size !== nodes.length) discontig.push(d + 1);
  }
  add('contiguity', 'Every district is contiguous (touching at more than a point)', chamber === 'congress' ? 'practice' : 'law',
    discontig.length === 0, (discontig.length ? `not contiguous: district ${discontig.join(', ')}` : 'all districts contiguous') +
      (islandPieces ? ` (${islandPieces} island pieces of VTDs count as joined to their own VTD by water)` : ''));

  // Every 2020 census VTD in exactly one district (units may carry several).
  if (ctx.geoid) {
    const seenG = new Map(); let dup = 0, missingD = 0;
    for (let i = 0; i < N; i++) for (const g of ctx.geoid[i].split('|')) { if (seenG.has(g)) dup++; seenG.set(g, assignment[i]); if (!(assignment[i] >= 0)) missingD++; }
    stats.censusVTDs = seenG.size;
    add('census-vtds', 'Every 2020 Census VTD is in exactly one district', 'law', dup === 0 && missingD === 0,
      `${seenG.size.toLocaleString('en-US')} census VTDs assigned${dup ? `, ${dup} duplicated` : ''}${missingD ? `, ${missingD} unassigned` : ''}`);
  }

  // Population.
  let mx = -Infinity, mn = Infinity;
  for (let d = 0; d < k; d++) { if (dPop[d] > mx) mx = dPop[d]; if (dPop[d] < mn) mn = dPop[d]; }
  const range = mx - mn;
  const pct = (x) => (x * 100).toFixed(2) + '%';
  const devs = Array.from(dPop, x => (x - P.ideal) / P.ideal);
  Object.assign(stats, { ideal: P.ideal, max: mx, min: mn, range, rangePct: range / P.ideal, maxDev: Math.max(...devs), minDev: Math.min(...devs), districtPop: Array.from(dPop) });
  if (chamber === 'house') {
    const out = [];
    for (let d = 0; d < k; d++) if (dPop[d] < P.lo || dPop[d] > P.hi) out.push(d + 1);
    add('band', `Every district within the band (${P.lo.toLocaleString('en-US')} to ${P.hi.toLocaleString('en-US')}, ${pct((P.lo - P.ideal) / P.ideal)} to +${pct((P.hi - P.ideal) / P.ideal)})`, 'practice',
      out.length === 0, out.length ? `outside the band: district ${out.slice(0, 12).join(', ')}${out.length > 12 ? ' …' : ''}` : `deviation ${pct(stats.minDev)} to +${pct(stats.maxDev)}`);
    add('range', 'Overall range under 10% of the ideal', 'presumptive',
      k * 10 * range < total, `${range.toLocaleString('en-US')} people = ${(100 * range / P.ideal).toFixed(4)}%`);
  } else if (chamber === 'senate') {
    add('range', 'Overall range under 10% of the ideal', 'presumptive',
      range <= P.maxRange, `${range.toLocaleString('en-US')} people = ${(100 * range / P.ideal).toFixed(4)}% (limit ${P.maxRange.toLocaleString('en-US')})`);
  } else {
    add('equal-pop', 'Equal population as nearly as practicable (enacted plans: 0 to 1 person)', 'law',
      range <= 1, `range ${range.toLocaleString('en-US')} people (${(100 * range / P.ideal).toFixed(4)}%); whole-VTD plans cannot reach 1 person without splitting VTDs`);
  }

  // County line rule (Texas House only).
  const perCounty = new Map();   // county -> { pop, dists: Map(d -> units) }
  for (let i = 0; i < N; i++) {
    const c = ctx.county[i];
    let e = perCounty.get(c); if (!e) { e = { pop: 0, dists: new Map() }; perCounty.set(c, e); }
    e.pop += ctx.pop[i];
    const d = assignment[i]; if (d >= 0) e.dists.set(d, (e.dists.get(d) || 0) + 1);
  }
  const countiesOfD = Array.from({ length: k }, () => new Set());
  for (let i = 0; i < N; i++) if (assignment[i] >= 0) countiesOfD[assignment[i]].add(ctx.county[i]);
  const splitCounties = [...perCounty.values()].filter(e => e.dists.size > 1).length;
  stats.splitCounties = splitCounties;
  if (P.countyLine) {
    const viol = { small: [], one: [], self: [], surplus: [], composition: [] };
    const cls = new Map();
    for (const [c, e] of perCounty) {
      const cl = TX.classifyCounty(e.pop, P.lo, P.hi);
      if (cl.type === 'whole' && cl.seats[0] === 1 && cl.seats[1] === 1) cl.type = 'one';
      cls.set(c, cl);
      const D = [...e.dists.keys()];
      const W = D.filter(d => countiesOfD[d].size === 1), X = D.filter(d => countiesOfD[d].size > 1);
      if (cl.type === 'small' && D.length !== 1) viol.small.push(`${cname(c)} split into ${D.length}`);
      if (cl.type === 'one' && !(D.length === 1 && X.length === 0)) viol.one.push(`${cname(c)} is not a district by itself`);
      if (cl.type === 'whole' && (X.length > 0 || W.length < cl.seats[0] || W.length > cl.seats[1]))
        viol.self.push(`${cname(c)}: ${W.length} inside, ${X.length} crossing (needs ${cl.seats[0] === cl.seats[1] ? cl.seats[0] : cl.seats[0] + ' or ' + cl.seats[1]} inside, none crossing)`);
      if (cl.type === 'surplus') {
        const n = Math.floor(e.pop / P.ideal);
        if (W.length !== n || X.length !== 1) viol.surplus.push(`${cname(c)}: ${W.length} inside, ${X.length} crossing (needs ${n} inside, 1 crossing)`);
      }
    }
    const nSmallSplit = [...perCounty].filter(([c, e]) => cls.get(c).type === 'small' && e.dists.size > 1);
    const withinSmallException = nSmallSplit.length <= (opts.necessarySmallSplits || 0) && nSmallSplit.every(([, e]) => e.dists.size === 2);
    for (let d = 0; d < k; d++) {
      if (countiesOfD[d].size < 2) continue;
      for (const c of countiesOfD[d]) {
        const cl = cls.get(c), e = perCounty.get(c);
        const X = [...e.dists.keys()].filter(x => countiesOfD[x].size > 1);
        const okc = (cl.type === 'small' && (e.dists.size === 1 || (withinSmallException && e.dists.size === 2))) || (cl.type === 'surplus' && X.length === 1 && X[0] === d);
        if (!okc) viol.composition.push(`district ${d + 1} includes ${cname(c)} (${cl.type})`);
      }
    }
    const lines = (a) => a.length ? a.slice(0, 8).join('; ') + (a.length > 8 ? ` … (+${a.length - 8})` : '') : 'none';
    // A small county may be split only where no whole-county plan exists within the
    // band. opts.necessarySmallSplits is that proven minimum (house_clusters.json:
    // an exact solver shows zero is infeasible); each such split divides the county
    // between exactly two districts.
    const smallSplit = [...perCounty].filter(([c, e]) => cls.get(c).type === 'small' && e.dists.size > 1);
    const necessary = opts.necessarySmallSplits || 0;
    const withinException = smallSplit.length > 0 && smallSplit.length <= necessary && smallSplit.every(([, e]) => e.dists.size === 2);
    stats.smallCountySplits = smallSplit.map(([c]) => cname(c));
    add('clr-small', 'County line rule: counties smaller than a district are kept whole', 'law',
      !viol.small.length || withinException,
      !viol.small.length ? 'none split' : withinException
        ? `${lines(viol.small)}: allowed only because no whole-county plan exists within the band (proven minimum: ${necessary} statewide)`
        : lines(viol.small) + (necessary ? ` (proven minimum is ${necessary})` : ''));
    add('clr-one', 'County line rule: a county the size of one district is that district', 'law', !viol.one.length, lines(viol.one));
    add('clr-self', 'County line rule: counties that fit whole districts keep them all inside', 'law', !viol.self.length, lines(viol.self));
    add('clr-surplus', 'County line rule: each surplus county keeps floor(pop/ideal) districts and is crossed once', 'law', !viol.surplus.length, lines(viol.surplus));
    add('clr-composition', 'County line rule: multi-county districts join only whole small counties and surplus remainders', 'law', !viol.composition.length, lines(viol.composition));
    const notNearest = [];
    for (const [c, e] of perCounty) {
      const cl = cls.get(c);
      if (cl.type !== 'whole' || cl.seats[0] === cl.seats[1]) continue;
      const W = [...e.dists.keys()].filter(d => countiesOfD[d].size === 1).length, near = Math.round(e.pop / P.ideal);
      if (W !== near) notNearest.push(`${cname(c)} has ${W} (nearest to its population: ${near})`);
    }
    if (notNearest.length) add('clr-k-choice', 'Counties with a choice of district counts', 'report', true,
      `${notNearest.join('; ')}. Allowed; the constitution does not say which count to use.`);
    stats.countyLineViolations = viol.small.length + viol.one.length + viol.self.length + viol.surplus.length;
    stats.multiSurplusDistricts = 0;
    for (let d = 0; d < k; d++) { let s = 0; for (const c of countiesOfD[d]) if (cls.get(c).type === 'surplus') s++; if (s > 1 && countiesOfD[d].size > 1) stats.multiSurplusDistricts++; }
  } else {
    add('county-splits', 'Counties split (no legal limit for this chamber)', 'report', true, `${splitCounties} counties are in more than one district`);
  }

  // Race and ethnicity: reported only, never a constraint.
  if (ctx.vap) {
    const hv = new Float64Array(k), bv = new Float64Array(k), av = new Float64Array(k), tv = new Float64Array(k);
    for (let i = 0; i < N; i++) { const d = assignment[i]; if (d < 0) continue; hv[d] += ctx.vap.h[i]; bv[d] += ctx.vap.b[i]; av[d] += ctx.vap.a[i]; tv[d] += ctx.vap.t[i]; }
    let h50 = 0, b50 = 0, a50 = 0;
    for (let d = 0; d < k; d++) { if (hv[d] > tv[d] / 2) h50++; if (bv[d] > tv[d] / 2) b50++; if (av[d] > tv[d] / 2) a50++; }
    stats.majorityHVAP = h50; stats.majorityBVAP = b50; stats.majorityAVAP = a50;
    add('vra-report', 'Majority-minority districts by voting-age population (report only)', 'report', true,
      `Hispanic VAP > 50%: ${h50}; Black VAP > 50%: ${b50}; Asian VAP > 50%: ${a50}. These are total VAP shares from the census; for Latino voters courts use citizen VAP, which is lower and not in this data. Voting Rights Act compliance cannot be certified mechanically.`);
  }
  const ok = checks.filter(c => c.level === 'law' || c.level === 'presumptive' || c.level === 'practice').every(c => c.pass);
  return { chamber, ok, checks, stats, params: P };
};

if (typeof module !== 'undefined' && module.exports) module.exports = TX;
else root.TXRules = TX;
})(typeof self !== 'undefined' ? self : this);
