// Writes counties.json for house_clusters.py: every county's 2020 population and
// its neighbours (counties sharing a boundary of positive length), from the
// census layer's shipped unit adjacency.
//   node texas/tools/counties_json.mjs texas/regions/tx_census2020.topo.json counties.json
import fs from 'fs';
const [topoPath, outPath] = process.argv.slice(2);
const topo = JSON.parse(fs.readFileSync(topoPath));
const P = topo.objects.mahalle.geometries.map(g => g.properties);
const C = new Map();
P.forEach((p, i) => {
  if (!C.has(p.IL)) C.set(p.IL, { code: p.IL, name: p.IL_NAME, pop: 0, nbrs: new Set() });
  const c = C.get(p.IL);
  c.pop += p.POP;
  for (const j of topo.meta.adjacency[i]) if (P[j].IL !== p.IL) c.nbrs.add(P[j].IL);
});
const total = P.reduce((s, p) => s + p.POP, 0);
fs.writeFileSync(outPath, JSON.stringify({ total, counties: [...C.values()].map(c => ({ ...c, nbrs: [...c.nbrs].sort((a, b) => a - b) })) }));
console.error(`${C.size} counties, population ${total}`);
