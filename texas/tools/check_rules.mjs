// Regression checks for the Texas rules layer. Exits non-zero on any failure.
//   node texas/tools/check_rules.mjs
// 1. Data gates on the census layer.
// 2. Every seed plan in both House libraries passes every binding check.
// 3. Enacted-plan fixtures: PlanS2168's range is 57,661 people; PlanH2316's
//    county line exceptions are exactly Henderson (split) and Cameron.
// 4. Worker invariants under hostile settings (partisan weights, annealing):
//    runs that start lawful end lawful, and the incremental violation equals
//    a full recomputation.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const TX = require(path.join(root, 'tx-rules.js'));

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };

const topo = JSON.parse(fs.readFileSync(path.join(root, 'regions', 'tx_census2020.topo.json')));
const P = topo.objects.mahalle.geometries.map(g => g.properties);
const N = P.length;
const ctx = {
  pop: P.map(p => p.POP), rep: P.map(p => p.IKTIDAR), dem: P.map(p => p.MUHALEFET), county: P.map(p => p.IL),
  countyName: new Map(P.map(p => [p.IL, p.IL_NAME])), adj: topo.meta.adjacency, pieces: topo.meta.pieces,
  geoid: P.map(p => String(p.GEOID20)),
  vap: { h: P.map(p => p.HVAP), b: P.map(p => p.BVAP), a: P.map(p => p.AVAP), t: P.map(p => p.VAP) },
};

// 1. Data gates
const geoids = ctx.geoid.flatMap(g => g.split('|'));
check(geoids.length === 9007 && new Set(geoids).size === 9007, `9,007 distinct census VTDs (${new Set(geoids).size})`);
check(ctx.pop.reduce((a, b) => a + b, 0) === 29145505, 'population 29,145,505');
check(ctx.vap.t.reduce((a, b) => a + b, 0) === 21866700, 'voting-age population 21,866,700');
check(new Set(ctx.county).size === 254, '254 counties');
check(topo.meta.adjacency.length === N, 'adjacency for every unit');
const pieceIslands = Object.values(topo.meta.pieces).flat().filter(nb => !nb.length).length;
check(pieceIslands === 0, `no VTD piece without a neighbour (${pieceIslands})`);

// 2. House libraries
const dec = (s) => { const a = new Int32Array(s.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 36); return a; };
for (const f of ['house_clusters.json', 'house_clusters_strict.json']) {
  const lib = JSON.parse(fs.readFileSync(path.join(root, 'regions', f)));
  let pass = 0;
  for (const c of lib.clusterings) {
    const r = TX.validate('house', ctx, dec(c.seed), { necessarySmallSplits: lib.minSmallSplits, band: [lib.lo, lib.hi] });
    if (r.checks.every(x => x.level === 'report' || x.pass)) pass++;
  }
  check(pass === lib.clusterings.length && pass > 0, `${f}: ${pass} of ${lib.clusterings.length} seed plans pass every binding check (band ${lib.lo}-${lib.hi}, necessary small splits ${lib.minSmallSplits})`);
}

// 3. Enacted fixtures (VTD approximations of block-level plans)
{
  const s = TX.validate('senate', ctx, Int32Array.from(P, p => p.SD - 1));
  check(s.stats.range === 57661, `PlanS2168 range ${s.stats.range} (official 57,661)`);
  const h = TX.validate('house', ctx, Int32Array.from(P, p => p.HD - 1));
  const small = h.checks.find(c => c.id === 'clr-small'), sur = h.checks.find(c => c.id === 'clr-surplus'), self = h.checks.find(c => c.id === 'clr-self');
  check(/Henderson split into 2/.test(small.detail) && !small.pass, `PlanH2316 small-county split: ${small.detail}`);
  check(/^Cameron: 1 inside, 2 crossing/.test(sur.detail), `PlanH2316 surplus exception: ${sur.detail}`);
  check(self.pass, 'PlanH2316 keeps every self-contained county whole');
}

// 4. Worker invariants
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wsrc = html.split('<script id="worker-src" type="javascript/worker">')[1].split('</script>')[0];
function worker() {
  const msgs = [];
  const self = { postMessage: (m) => msgs.push(m) };
  const W = new Function('self', 'performance', wsrc + '\nreturn { on: self.onmessage, saved: () => savedState, recompute: hardRecompute };')(self, { now: () => Date.now() });
  const call = (msg) => { msgs.length = 0; W.on({ data: msg }); return new Promise(res => { const t = setInterval(() => { const d = msgs.find(m => ['done', 'error', 'loaded'].includes(m.type)); if (d) { clearInterval(t); res(d); } }, 5); }); };
  return { W, call };
}
const hostile = { cutEdges: 10, popDev: 0, partisanAdv: 100, lopsidedWins: 50, effGap: -50 };
{
  const lib = JSON.parse(fs.readFileSync(path.join(root, 'regions', 'house_clusters.json')));
  const jobs = TX.houseJobs(lib.clusterings[0].clusters, ctx);
  const seed = dec(lib.clusterings[0].seed);
  let worst = 0, drift = 0, tested = 0;
  for (const job of jobs.filter(j => j.seats > 1).slice(0, 8)) {
    const { W, call } = worker();
    W.on({ data: { type: 'init', key: 'j', adj: job.adj, pop: job.pop, iktidar: job.r, muhalefet: job.d, il: job.il, glue: job.glue } });
    const unit = (nd) => nd.units.length ? nd.units[0] : nd.pieceOf;
    const ids = [...new Set(job.nodes.map(nd => seed[unit(nd)]))].sort((a, b) => a - b);
    const local = new Map(ids.map((d, i) => [d, i]));
    const init = Int32Array.from(job.nodes, nd => local.get(seed[unit(nd)]));
    const hard = { lo: lib.lo, hi: lib.hi, cross: job.cross };
    await call({ type: 'load', key: 'j', k: job.seats, assignment: init.buffer, weights: hostile, hard });
    for (const polish of [false, true]) {
      const d = await call({ type: 'continue', key: 'j', k: job.seats, tol: 0.05, weights: hostile, iters: 400, seed: 3, hard, T0: 5000, anneal: 'const', polish, polishFlips: 4, maxRetries: 40 });
      if (d.type !== 'done') { worst = Infinity; continue; }
      worst = Math.max(worst, d.metrics.viol);
      const S = W.saved(), inc = S.viol; W.recompute(S);
      drift = Math.max(drift, Math.abs(inc - S.viol));
      tested++;
    }
  }
  check(worst === 0, `House cluster jobs from lawful seeds stay lawful under hostile weights and T=5000 (${tested} runs, worst violation ${worst})`);
  check(drift < 1e-6, `incremental violation equals recomputation (max drift ${drift})`);
}
{
  // Senate statewide: fresh run with the band, then hostile continue.
  const PG = TX.pieceGraph(N, ctx.adj, ctx.pieces);
  const pad = (a, f) => a.concat(PG.extraOf.map(f));
  const { W, call } = worker();
  W.on({ data: { type: 'init', key: 's', adj: PG.adj, pop: pad(ctx.pop, () => 0), iktidar: pad(ctx.rep, () => 0), muhalefet: pad(ctx.dem, () => 0), il: pad(ctx.county, u => ctx.county[u]), glue: PG.glue } });
  const Pm = TX.chamberParams('senate', 29145505);
  const hard = { lo: Pm.lo, hi: Pm.hi };
  let d = await call({ type: 'run', key: 's', k: 31, tol: 0.05, weights: { cutEdges: 1, popDev: 50 }, iters: 3000, seed: 5, hard, maxRetries: 60 });
  check(d.type === 'done' && d.metrics.viol === 0, `Senate run reaches a lawful plan (violation ${d.metrics && d.metrics.viol})`);
  d = await call({ type: 'continue', key: 's', k: 31, tol: 0.05, weights: hostile, iters: 600, seed: 9, hard, T0: 5000, anneal: 'const', maxRetries: 40 });
  check(d.type === 'done' && d.metrics.viol === 0, 'Senate plan stays lawful under hostile weights and T=5000');
  const a = new Int32Array(d.assignment).subarray(0, N);
  const r = TX.validate('senate', ctx, a);
  check(r.checks.every(x => x.level === 'report' || x.pass), `validator agrees: ${r.checks.filter(x => x.level !== 'report' && !x.pass).map(x => x.id).join(', ') || 'all binding checks pass'}`);
  const S = W.saved(), inc = S.viol; W.recompute(S);
  check(Math.abs(inc - S.viol) < 1e-6, 'Senate incremental violation equals recomputation');
  const bad = await call({ type: 'continue', key: 's', k: 38, tol: 0.05, weights: hostile, iters: 10, seed: 1, hard });
  check(bad.type === 'error', 'continue with the wrong district count is refused');
}
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
