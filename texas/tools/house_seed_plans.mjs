// Turns county clusterings (house_clusters.py output) into the library the page
// loads: texas/regions/house_clusters.json. For every clustering it draws one
// complete, lawful Texas House plan at VTD level (the "seed") by running the
// page's own ReCom worker on each cluster with the hard constraints, then checks
// the whole plan with TX.validate. Clusterings whose seed does not pass every
// binding check are dropped. The page starts every House run from a seed, and
// no worker move can increase a violation, so page runs stay lawful.
//
//   node texas/tools/house_seed_plans.mjs <census topo> <clusters.json> <out.json> [iters]
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const TX = require(path.join(here, '..', 'tx-rules.js'));

const [topoPath, clustersPath, outPath, itersArg] = process.argv.slice(2);
const iters = +(itersArg || 3000);
const topo = JSON.parse(fs.readFileSync(topoPath));
const geoms = topo.objects.mahalle.geometries;
const P = geoms.map(g => g.properties);
const N = P.length;

// Shared-arc adjacency, used only when the layer does not ship its own.
const arcMap = new Map();
geoms.forEach((g, i) => {
  const visit = (rings) => { for (const ring of rings) for (const a of ring) { const k = a < 0 ? ~a : a; (arcMap.get(k) || arcMap.set(k, []).get(k)).push(i); } };
  if (g.type === 'Polygon') visit(g.arcs); else if (g.type === 'MultiPolygon') for (const p of g.arcs) visit(p);
});
const adjS = Array.from({ length: N }, () => new Set());
for (const us of arcMap.values()) { const u = [...new Set(us)]; for (let a = 0; a < u.length; a++) for (let b = a + 1; b < u.length; b++) { adjS[u[a]].add(u[b]); adjS[u[b]].add(u[a]); } }
const ctx = {
  pop: P.map(p => p.POP), rep: P.map(p => p.IKTIDAR), dem: P.map(p => p.MUHALEFET), county: P.map(p => p.IL),
  countyName: new Map(P.map(p => [p.IL, p.IL_NAME])),
  adj: topo.meta && topo.meta.adjacency ? topo.meta.adjacency : adjS.map(s => [...s]),
  pieces: (topo.meta && topo.meta.pieces) || {}, geoid: P.map(p => String(p.GEOID20)),
  vap: { h: P.map(p => p.HVAP), b: P.map(p => p.BVAP), a: P.map(p => p.AVAP), t: P.map(p => p.VAP) },
};

const html = fs.readFileSync(path.join(here, '..', 'index.html'), 'utf8');
const wsrc = html.split('<script id="worker-src" type="javascript/worker">')[1].split('</script>')[0];
function worker() {
  const msgs = [];
  const self = { postMessage: (m) => msgs.push(m) };
  const W = new Function('self', 'performance', wsrc + '\nreturn self.onmessage;')(self, { now: () => Date.now() });
  const call = (msg) => { msgs.length = 0; W({ data: msg }); return new Promise(res => { const t = setInterval(() => { const d = msgs.find(m => m.type === 'done' || m.type === 'error' || m.type === 'loaded'); if (d) { clearInterval(t); res(d); } }, 5); }); };
  return { W, call };
}

const lib = JSON.parse(fs.readFileSync(clustersPath));
const out = { ideal: lib.ideal, lo: lib.lo, hi: lib.hi, minSmallSplits: lib.minSmallSplits, clusterings: [] };
const enc = (a) => Array.from(a, d => d.toString(36).padStart(2, '0')).join('');

for (let ci = 0; ci < lib.clusterings.length; ci++) {
  const clustering = lib.clusterings[ci];
  const jobs = TX.houseJobs(clustering, ctx);
  const assignment = new Int32Array(N).fill(-1);
  let next = 0, failed = null;
  const t0 = Date.now();
  for (const job of jobs) {
    if (job.seats === 1) { for (const nd of job.nodes) for (const u of nd.units) assignment[u] = next; next++; continue; }
    const { W, call } = worker();
    W({ data: { type: 'init', key: 'j', adj: job.adj, pop: job.pop, iktidar: job.r, muhalefet: job.d, il: job.il, glue: job.glue } });
    const hard = { lo: lib.lo, hi: lib.hi, cross: job.cross };
    let done = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      done = await call({ type: 'run', key: 'j', k: job.seats, tol: 0.05, weights: { cutEdges: 1, popDev: 50 }, iters, seed: 11 + attempt * 101, hard, maxRetries: 80 });
      if (done.type === 'error') continue;
      if (done.metrics.viol <= 1e-9) break;
      done = await call({ type: 'continue', key: 'j', k: job.seats, tol: 0.05, weights: { cutEdges: 1, popDev: 50 }, iters, seed: 7 + attempt, hard, maxRetries: 80, polish: true, polishFlips: 6 });
      if (done.type !== 'error' && done.metrics.viol <= 1e-9) break;
    }
    if (!done || done.type === 'error' || done.metrics.viol > 1e-9) {
      failed = `${job.kind} cluster of ${job.seats} seats (${job.counties.slice(0, 5).map(c => ctx.countyName.get(c)).join(', ')}) stayed infeasible`;
      break;
    }
    const a = new Int32Array(done.assignment);
    job.nodes.forEach((nd, i) => { for (const u of nd.units) assignment[u] = next + a[i]; });
    next += job.seats;
  }
  if (failed) { console.error(`clustering ${ci}: dropped, ${failed}`); continue; }
  const r = TX.validate('house', ctx, assignment, { necessarySmallSplits: lib.minSmallSplits, band: [lib.lo, lib.hi] });
  const bad = r.checks.filter(c => c.level !== 'report' && !c.pass);
  if (bad.length && process.env.DUMP) fs.writeFileSync(process.env.DUMP + ci + '.json', JSON.stringify(Array.from(assignment)));
  if (bad.length) { console.error(`clustering ${ci}: dropped, ${bad.map(c => c.id + ': ' + c.detail).join(' | ')}`); continue; }
  out.clusterings.push({ clusters: clustering, seed: enc(assignment), stats: { range: r.stats.range, splitSmall: r.stats.smallCountySplits } });
  console.error(`clustering ${ci}: lawful seed plan in ${((Date.now() - t0) / 1000).toFixed(1)}s, range ${r.stats.range}, small-county split ${r.stats.smallCountySplits.join(', ') || 'none'}`);
}
fs.writeFileSync(outPath, JSON.stringify(out));
console.error(`${out.clusterings.length} of ${lib.clusterings.length} clusterings kept`);
