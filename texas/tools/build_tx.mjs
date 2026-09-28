// Builds texas/regions/tx_texas.topo.json from a checkout of t0lg-a/test_tx04:
// 2024 VTD polygons + 2024 presidential R/D (precincts_2024.plate), 2024
// registered voters as population, county codes, and the enacted 2021 CD/SD/HD
// assignments. Output uses the same property names as the Turkish region files
// (POP, IL, IKTIDAR=R, MUHALEFET=D, ...) so the app code is shared.
//   npm i topojson-server topojson-simplify topojson-client
//   node texas/tools/build_tx.mjs ../test_tx04 texas/regions/tx_texas.topo.json

import path from 'path'; import { pathToFileURL } from 'url';
import fs from 'fs'; import zlib from 'zlib';
const { parsePlate } = await import(pathToFileURL(path.join(process.argv[2] || '.', 'plate-format.js')).href);
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
const [DATA_REPO, OUT, KEEP] = process.argv.slice(2);
if (!DATA_REPO || !OUT) { console.error('usage: node build_tx.mjs <test_tx04 checkout> <out.topo.json> [keep=0.08]'); process.exit(1); }
const D = path.join(DATA_REPO, 'data') + '/';
const gz = (f) => zlib.gunzipSync(fs.readFileSync(D + f));
const json = (f) => JSON.parse(gz(f).toString());
const b = gz('precincts_2024.plate.gz');
const p = parsePlate(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const col = (n) => p.props[n];
const val = (n, i) => { const c = col(n); if (c.type === 'dict') return c.dict[c.values[i]]; const v = c.values[i]; return (v === -2147483648 || Number.isNaN(v)) ? 0 : v; };

const reg = json('contests/2024/t2024-general-1428.json.gz');
const regBy = new Map(reg.keys.map((k, i) => [k, reg.votes[0][i]]));
const fips = json('county_fips.json.gz');
const cname = Object.fromEntries(Object.entries(fips).map(([n, c]) => [c, n]));
const cd = json('districts/c2021_assign.json.gz'), sd = json('districts/s2021_assign.json.gz'), hd = json('districts/h2021_assign.json.gz');

const n = p.meta.features, feats = [];
let miss = 0, missCd = 0, empty = 0;
for (let i = 0; i < n; i++) {
  const fm = p.featureMeta[i];
  const polys = [];
  for (let r = fm.ringStart; r < fm.ringStart + fm.ringCount; r++) {
    const s0 = p.rings.start[r], len = p.rings.count[r];
    const ring = [];
    for (let j = 0; j < len; j++) ring.push([+p.raw[(s0 + j) * 2].toFixed(6), +p.raw[(s0 + j) * 2 + 1].toFixed(6)]);
    ring.push(ring[0]);
    // d3 spherical convention: exterior rings clockwise (negative planar area), holes counter-clockwise.
    let a = 0; for (let j = 0; j < ring.length - 1; j++) a += ring[j][0] * ring[j + 1][1] - ring[j + 1][0] * ring[j][1];
    const isHole = p.rings.hole[r] && polys.length;
    if ((!isHole && a > 0) || (isHole && a < 0)) ring.reverse();
    if (!p.rings.hole[r] || !polys.length) polys.push([ring]); else polys[polys.length - 1].push(ring);
  }
  if (!polys.length) { empty++; continue; }
  const id = val('id', i), cnty = val('cnty', i);
  const pop = regBy.get(id); if (pop == null) miss++;
  if (cd[id] == null) missCd++;
  feats.push({ type: 'Feature', geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys },
    properties: { POP: pop || 0, MAHID: i, IL: +cnty, IL_NAME: cname[cnty] || cnty, ILCE_NAME: cname[cnty] || cnty, MAH_NAME: id,
      VALID: val('2024pd', i) + val('2024pr', i) + val('2024po', i), IKTIDAR: val('2024pr', i), MUHALEFET: val('2024pd', i),
      CD: +cd[id] || 0, SD: +sd[id] || 0, HD: +hd[id] || 0 } });
}
console.error({ n, kept: feats.length, empty, miss, missCd, pop: feats.reduce((s, f) => s + f.properties.POP, 0) });
let topo = topology({ mahalle: { type: 'FeatureCollection', features: feats } }, 1e6);
topo = presimplify(topo);
const w = quantile(topo, +KEEP || 0.08);
topo = simplify(topo, w);
// Re-quantize output for size (delta-encoded integer arcs).
const { quantize } = await import('topojson-client');
topo = quantize(topo, 2e5);
fs.writeFileSync(OUT, JSON.stringify(topo));
console.error('bytes', fs.statSync(OUT).size, 'arcs', topo.arcs.length, 'pts', topo.arcs.reduce((s, a) => s + a.length, 0));
