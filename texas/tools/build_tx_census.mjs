// Builds texas/regions/tx_census2020.topo.json: the legal-rules layer.
//
// Units are the 9,007 2020 Census VTDs, carrying exact 2020 Census (PL 94-171)
// total population. Geometry comes from the precincts_2020 plate of
// t0lg-a/test_tx04 (the Legislative Council's 2020 VTDs): 8,843 of its keys are
// census VTDs as-is and the rest are A/B parts of 164 census VTDs, which are
// merged back into one unit here. Population, voting-age population by race and
// the 2020 presidential vote (VEST, retabulated to 2020 VTDs) come from
// alarm-redist/census-2020 (census-vest-2020/tx_2020_vtd.csv).
//
// The enacted 2021 plans (CD/SD/HD) are carried over from the 2024-precinct
// assignment tables by an interior point of each VTD. Enacted plans were drawn
// on census blocks and split some VTDs, so these are VTD-level approximations
// used only for comparison, never for validating the rules.
//
//   npm i topojson-server topojson-simplify topojson-client
//   node texas/tools/build_tx_census.mjs <test_tx04 checkout> <tx_2020_vtd.csv> <out.topo.json> [keep=0.08]
import path from 'path'; import { pathToFileURL } from 'url';
import fs from 'fs'; import zlib from 'zlib';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { mergeArcs, quantize } from 'topojson-client';

const [DATA_REPO, CSV, OUT, KEEP] = process.argv.slice(2);
if (!DATA_REPO || !CSV || !OUT) { console.error('usage: node build_tx_census.mjs <test_tx04> <tx_2020_vtd.csv> <out.topo.json> [keep]'); process.exit(1); }
const { parsePlate } = await import(pathToFileURL(path.join(DATA_REPO, 'plate-format.js')).href);
const D = path.join(DATA_REPO, 'data') + '/';
const gz = (f) => zlib.gunzipSync(fs.readFileSync(D + f));
const json = (f) => JSON.parse(gz(f).toString());
const plate = (f) => { const b = gz(f); return parsePlate(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const ids = (p) => Array.from(p.props.id.values, v => p.props.id.dict[v]);
const fail = (m) => { console.error('FAIL: ' + m); process.exit(2); };

// ── census table
const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n');
const H = lines[0].split(',');
const col = Object.fromEntries(H.map((h, i) => [h, i]));
const census = new Map();
for (const l of lines.slice(1)) {
  const r = l.split(',');
  const g = r[col.GEOID20];
  // 48 + 3-digit county + 6-char VTD -> the Council's CNTYVTD key (VTD without leading zeros, at least 4 chars)
  const key = g.slice(2, 5) + g.slice(5).replace(/^0+(?=.{4})/, '');
  if (census.has(key)) fail('duplicate key ' + key);
  census.set(key, { geoid: g, county: g.slice(2, 5), r });
}
const num = (c, name) => +c.r[col[name]];
const sumOf = (keys, name) => keys.reduce((t, k) => t + num(census.get(k), name), 0);

// ── geometry: 2020 VTD plate, parts mapped to census VTDs
const p20 = plate('precincts_2020.plate.gz');
const k20 = ids(p20);
const baseOf = k20.map(k => census.has(k) ? k : (/[A-Z]$/.test(k) && census.has(k.slice(0, -1)) ? k.slice(0, -1) : null));
// Reconcile the few places where the Council's 2020 VTDs and the census VTDs differ:
// - a census VTD with no plate geometry is grouped with the county's orphan plate
//   feature (e.g. Brazos 0103 covers 12 tiny census VTDs); the unit then carries
//   every census VTD in the group;
// - an orphan plate feature with no uncovered census VTD in its county (a precinct
//   created after the census, e.g. Dallas 4650, Harris 0922) is geometry only and
//   is merged into the neighbouring unit it shares the longest border with.
const covered = new Set(baseOf.filter(Boolean));
const uncoveredByCounty = new Map();
for (const k of census.keys()) if (!covered.has(k)) {
  const c = k.slice(0, 3); if (!uncoveredByCounty.has(c)) uncoveredByCounty.set(c, []); uncoveredByCounty.get(c).push(k);
}
const groupOf = new Map();   // unit key -> census keys it carries
for (const k of census.keys()) if (covered.has(k)) groupOf.set(k, [k]);
const geometryOnly = [];     // plate indices to merge into a neighbour
const notesGrouped = [];
k20.forEach((k, i) => {
  if (baseOf[i]) return;
  const c = k.slice(0, 3), unc = uncoveredByCounty.get(c);
  const orphansHere = k20.filter((kk, j) => !baseOf[j] && kk.slice(0, 3) === c);
  if (unc && unc.length && orphansHere.length === 1) {
    baseOf[i] = k; groupOf.set(k, unc); uncoveredByCounty.delete(c);
    notesGrouped.push({ unit: k, census: unc.map(u => census.get(u).geoid), pop: unc.reduce((s, u) => s + num(census.get(u), 'pop'), 0) });
    console.error(`grouped ${unc.length} census VTDs (pop ${unc.reduce((s, u) => s + num(census.get(u), 'pop'), 0)}) under plate ${k}`);
  } else if (!unc) geometryOnly.push(i);
  else fail(`county ${c}: ${orphansHere.length} orphan features and ${unc.length} uncovered census VTDs, no unique pairing`);
});
// Census VTDs the Council folded into a neighbouring precinct (no geometry and no
// orphan feature in the county): attach each to the same-county unit with the
// nearest VTD number. Their placement inside the county is the only uncertainty
// in the population of any unit, so it is reported in the output metadata.
const notes = { attachedByNearestCode: [], mergedPostCensus: [], grouped: [] };
for (const [c, unc] of uncoveredByCounty) for (const u of unc) {
  const code = parseInt(u.slice(3), 10);
  let best = null, bd = Infinity;
  for (const k of groupOf.keys()) if (k.slice(0, 3) === c) {
    const d = Math.abs(parseInt(k.slice(3), 10) - code);
    if (d < bd) { bd = d; best = k; }
  }
  if (!best) fail('no unit in county ' + c + ' for ' + u);
  groupOf.get(best).push(u);
  notes.attachedByNearestCode.push({ census: census.get(u).geoid, pop: num(census.get(u), 'pop'), unit: best });
  console.error(`attached census ${u} (pop ${num(census.get(u), 'pop')}) to ${best}`);
}

function featurePolys(p, i) {
  const fm = p.featureMeta[i], polys = [];
  for (let r = fm.ringStart; r < fm.ringStart + fm.ringCount; r++) {
    const s0 = p.rings.start[r], len = p.rings.count[r], ring = [];
    for (let j = 0; j < len; j++) ring.push([+p.raw[(s0 + j) * 2].toFixed(6), +p.raw[(s0 + j) * 2 + 1].toFixed(6)]);
    ring.push(ring[0]);
    let a = 0; for (let j = 0; j < ring.length - 1; j++) a += ring[j][0] * ring[j + 1][1] - ring[j + 1][0] * ring[j][1];
    const isHole = p.rings.hole[r] && polys.length;
    // d3 spherical convention: exterior clockwise, holes counter-clockwise.
    if ((!isHole && a > 0) || (isHole && a < 0)) ring.reverse();
    if (!isHole) polys.push([ring]); else polys[polys.length - 1].push(ring);
  }
  return polys;
}
// Interior point: centroid of the feature's largest triangle (always inside it).
function interiorPoint(p, i) {
  const fm = p.featureMeta[i];
  let best = -1, bx = 0, by = 0;
  for (let t = fm.idxStart; t < fm.idxStart + fm.idxCount; t += 3) {
    const a = p.tri[t], b = p.tri[t + 1], c = p.tri[t + 2];
    const ax = p.raw[a * 2], ay = p.raw[a * 2 + 1], bx_ = p.raw[b * 2], by_ = p.raw[b * 2 + 1], cx = p.raw[c * 2], cy = p.raw[c * 2 + 1];
    const ar = Math.abs((bx_ - ax) * (cy - ay) - (cx - ax) * (by_ - ay));
    if (ar > best) { best = ar; bx = (ax + bx_ + cx) / 3; by = (ay + by_ + cy) / 3; }
  }
  return [bx, by];
}

// ── enacted plans on the 2024 layer, looked up by point-in-polygon
const p24 = plate('precincts_2024.plate.gz');
const k24 = ids(p24);
const plans = { CD: json('districts/c2021_assign.json.gz'), SD: json('districts/s2021_assign.json.gz'), HD: json('districts/h2021_assign.json.gz') };
function pip(p, i, x, y) {
  const fm = p.featureMeta[i];
  if (x < fm.minX || x > fm.maxX || y < fm.minY || y > fm.maxY) return false;
  let inside = false;
  for (let r = fm.ringStart; r < fm.ringStart + fm.ringCount; r++) {
    const s0 = p.rings.start[r], len = p.rings.count[r];
    for (let j = 0, k = len - 1; j < len; k = j++) {
      const xj = p.raw[(s0 + j) * 2], yj = p.raw[(s0 + j) * 2 + 1], xk = p.raw[(s0 + k) * 2], yk = p.raw[(s0 + k) * 2 + 1];
      if ((yj > y) !== (yk > y) && x < (xk - xj) * (y - yj) / (yk - yj) + xj) inside = !inside;
    }
  }
  return inside;
}
// Grid index over 2024 feature bboxes.
const G = 0.05, grid = new Map();
for (let i = 0; i < k24.length; i++) {
  const fm = p24.featureMeta[i];
  for (let gx = Math.floor(fm.minX / G); gx <= Math.floor(fm.maxX / G); gx++)
    for (let gy = Math.floor(fm.minY / G); gy <= Math.floor(fm.maxY / G); gy++) {
      const key = gx + ',' + gy; if (!grid.has(key)) grid.set(key, []); grid.get(key).push(i);
    }
}
const lookup24 = (x, y) => (grid.get(Math.floor(x / G) + ',' + Math.floor(y / G)) || []).find(i => pip(p24, i, x, y));

// Each census VTD's enacted district: take the part with the most population-free
// weight available (the largest triangle among its parts decides).
const partsOf = new Map();
k20.forEach((k, i) => { const b = baseOf[i]; if (!b) return; if (!partsOf.has(b)) partsOf.set(b, []); partsOf.get(b).push(i); });

const fips = json('county_fips.json.gz');
const cname = Object.fromEntries(Object.entries(fips).map(([n, c]) => [c, n]));

const feats = [], order = [...groupOf.keys()];
let noPlan = 0;
for (let f = 0; f < k20.length; f++) {
  feats.push({ type: 'Feature', properties: { part: f }, geometry: (() => {
    const polys = featurePolys(p20, f);
    return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
  })() });
}
let topo = topology({ parts: { type: 'FeatureCollection', features: feats } }, 1e6);
const partGeoms = topo.objects.parts.geometries;
// Longest shared border for each geometry-only feature.
{
  const arcLen = topo.arcs.map(a => { let x = 0, y = 0, L = 0; a.forEach(([dx, dy], j) => { if (j) L += Math.hypot(dx - x, dy - y); x = dx; y = dy; }); return L; });
  const users = new Map();
  partGeoms.forEach((g, i) => {
    const walk = (a) => Array.isArray(a) ? a.forEach(walk) : (() => { const id = a < 0 ? ~a : a; if (!users.has(id)) users.set(id, new Set()); users.get(id).add(i); })();
    walk(g.arcs);
  });
  for (const i of geometryOnly) {
    const shared = new Map();
    for (const [id, set] of users) if (set.has(i)) for (const j of set) if (j !== i && baseOf[j]) shared.set(j, (shared.get(j) || 0) + arcLen[id]);
    const best = [...shared].sort((a, b) => b[1] - a[1])[0];
    if (!best) fail('orphan ' + k20[i] + ' has no neighbour');
    partsOf.get(baseOf[best[0]]).push(i);
    notes.mergedPostCensus.push({ plate: k20[i], unit: baseOf[best[0]] });
    console.error(`merged post-census precinct ${k20[i]} into ${baseOf[best[0]]}`);
  }
}
const geoms = [];
for (const key of order) {
  const group = groupOf.get(key);
  const c = census.get(group[0]);
  const parts = partsOf.get(key);
  const g = parts.length === 1 ? { ...partGeoms[parts[0]] } : mergeArcs(topo, parts.map(i => partGeoms[i]));
  // Enacted districts from the largest part's interior point.
  let biggest = parts[0], bestN = -1;
  for (const i of parts) { const n = p20.featureMeta[i].idxCount; if (n > bestN) { bestN = n; biggest = i; } }
  const [x, y] = interiorPoint(p20, biggest);
  const j = lookup24(x, y);
  const pk = j != null ? k24[j] : null;
  if (pk == null) noPlan++;
  const R = sumOf(group, 'pre_20_rep_tru'), Dm = sumOf(group, 'pre_20_dem_bid');
  g.properties = {
    POP: sumOf(group, 'pop'), GEOID20: group.map(k => census.get(k).geoid).join('|'), MAHID: geoms.length,
    IL: +c.county, IL_NAME: cname[c.county] || c.county, ILCE_NAME: cname[c.county] || c.county, MAH_NAME: key,
    VAP: sumOf(group, 'vap'), HVAP: sumOf(group, 'vap_hisp'), BVAP: sumOf(group, 'vap_black'), AVAP: sumOf(group, 'vap_asian'), WVAP: sumOf(group, 'vap_white'),
    IKTIDAR: Math.round(R * 10) / 10, MUHALEFET: Math.round(Dm * 10) / 10, VALID: Math.round((R + Dm) * 10) / 10,
    CD: pk ? +plans.CD[pk] || 0 : 0, SD: pk ? +plans.SD[pk] || 0 : 0, HD: pk ? +plans.HD[pk] || 0 : 0,
  };
  delete g.id;
  geoms.push(g);
}
topo.objects = { mahalle: { type: 'GeometryCollection', geometries: geoms } };

// Adjacency from the full-resolution geometry, before simplification: two units
// are adjacent only if they share a boundary of positive length (point contact
// is not contiguity). Units whose territory is in several pieces also get the
// neighbours of each piece, so contiguity can be checked piece by piece.
const [qsx, qsy] = topo.transform.scale;
const cosLat = Math.cos(31 * Math.PI / 180);
const arcLenM = topo.arcs.map(a => {
  let x = 0, y = 0, px = null, py = null, L = 0;
  for (const [dx, dy] of a) { x += dx; y += dy; if (px !== null) L += Math.hypot((x - px) * qsx * cosLat, (y - py) * qsy); px = x; py = y; }
  return L * 111320;
});
const arcUnits = new Map();
const polysOf = (g) => g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
geoms.forEach((g, i) => polysOf(g).forEach(rings => rings.forEach(ring => ring.forEach(a => {
  const k = a < 0 ? ~a : a; if (!arcUnits.has(k)) arcUnits.set(k, new Set()); arcUnits.get(k).add(i);
}))));
const MIN_SHARED_M = 1;   // a shared boundary shorter than a metre is treated as a point
const shared = new Map();
for (const [k, us] of arcUnits) {
  if (us.size < 2) continue;
  const u = [...us];
  for (let a = 0; a < u.length; a++) for (let b = a + 1; b < u.length; b++) {
    const key = Math.min(u[a], u[b]) * 100000 + Math.max(u[a], u[b]);
    shared.set(key, (shared.get(key) || 0) + arcLenM[k]);
  }
}
const adjacency = geoms.map(() => []);
let pointOnly = 0;
for (const [key, L] of shared) {
  const a = Math.floor(key / 100000), b = key % 100000;
  if (L < MIN_SHARED_M) { pointOnly++; continue; }
  adjacency[a].push(b); adjacency[b].push(a);
}
// Pieces: for a unit in several pieces, each piece's neighbours. A neighbour
// that is itself in several pieces is named piece by piece as [unit, piece].
const pieceOfArc = new Map();                 // arc -> [[unit, piece], ...]
geoms.forEach((g, i) => polysOf(g).forEach((rings, p) => rings.forEach(ring => ring.forEach(a => {
  const k = a < 0 ? ~a : a; if (!pieceOfArc.has(k)) pieceOfArc.set(k, []); pieceOfArc.get(k).push([i, p]);
}))));
const multi = new Set(geoms.map((g, i) => polysOf(g).length > 1 ? i : -1).filter(i => i >= 0));
const pieces = {};
for (const i of multi) {
  pieces[i] = polysOf(geoms[i]).map((rings, p) => {
    const nb = new Map();
    for (const ring of rings) for (const a of ring) {
      const k = a < 0 ? ~a : a;
      for (const [j, q] of pieceOfArc.get(k)) if (j !== i) { const key = multi.has(j) ? j + ':' + q : String(j); nb.set(key, (nb.get(key) || 0) + arcLenM[k]); }
    }
    return [...nb].filter(([, L]) => L >= MIN_SHARED_M).map(([key]) => key.includes(':') ? key.split(':').map(Number) : +key);
  });
}
// A piece with no shared arc at all may still border a unit along its whole
// edge when the two outlines do not share vertices (an enclave drawn inside a
// neighbour). Find such neighbours geometrically: a unit whose outline carries
// the piece's boundary (its vertices lie on that outline, within 1 cm).
{
  const decoded = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => [(x += dx) * qsx + topo.transform.translate[0], (y += dy) * qsy + topo.transform.translate[1]]); });
  const ringCoords = (ring) => { const out = []; for (const a of ring) { const c = a < 0 ? decoded[~a].slice().reverse() : decoded[a]; out.push(...(out.length ? c.slice(1) : c)); } return out; };
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const TOL = 1e-7;   // degrees, about 1 cm
  const outlines = geoms.map(g => polysOf(g).map(rings => rings.map(ringCoords)));
  const bbox = outlines.map(ps => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const rs of ps) for (const r of rs) for (const [x, y] of r) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; });
  for (const i of multi) pieces[i].forEach((nb, p) => {
    if (nb.length) return;
    const pts = outlines[i][p][0];
    const pb = [Math.min(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), Math.max(...pts.map(q => q[1]))];
    for (let j = 0; j < geoms.length; j++) {
      if (j === i) continue;
      const b = bbox[j];
      if (b[0] > pb[2] + TOL || b[2] < pb[0] - TOL || b[1] > pb[3] + TOL || b[3] < pb[1] - TOL) continue;
      outlines[j].forEach((rs, q) => {
        let on = 0;
        for (const pt of pts) { let hit = false; for (const r of rs) { for (let s2 = 1; s2 < r.length && !hit; s2++) if (segDist(pt, r[s2 - 1], r[s2]) < TOL) hit = true; if (hit) break; } if (hit) on++; }
        if (on < 2) return;
        nb.push(multi.has(j) ? [j, q] : j);
        // Symmetric: unit adjacency, and the neighbour's own piece list.
        if (!adjacency[i].includes(j)) { adjacency[i].push(j); adjacency[j].push(i); }
        if (multi.has(j) && !pieces[j][q].some(v => Array.isArray(v) && v[0] === i && v[1] === p)) pieces[j][q].push([i, p]);
      });
    }
    notes.enclaveNeighbours = notes.enclaveNeighbours || [];
    notes.enclaveNeighbours.push({ unit: geoms[i].properties.MAH_NAME, piece: p, neighbours: nb.map(v => Array.isArray(v) ? geoms[v[0]].properties.MAH_NAME + '#' + v[1] : geoms[v].properties.MAH_NAME) });
  });
}
adjacency.forEach(a => a.sort((x, y) => x - y));
console.error({ adjacentPairs: adjacency.reduce((s, a) => s + a.length, 0) / 2, pointOnlyPairsDropped: pointOnly, multipartUnits: Object.keys(pieces).length, enclaves: notes.enclaveNeighbours || [] });
notes.grouped = notesGrouped;
// Every census VTD must be in exactly one unit.
{
  const seen = new Map();
  for (const [k, g] of groupOf) for (const u of g) { if (seen.has(u)) fail('census VTD ' + u + ' in two units'); seen.set(u, k); }
  if (seen.size !== census.size) fail(`units carry ${seen.size} census VTDs, expected ${census.size}`);
}
const pop = geoms.reduce((s, g) => s + g.properties.POP, 0);
if (pop !== 29145505) fail('statewide population ' + pop + ' != 29,145,505');
console.error({ units: geoms.length, censusVTDs: census.size, parts: k20.length, multiPart: order.filter(k => partsOf.get(k).length > 1).length, pop, noPlan });
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, +KEEP || 0.08));
topo = quantize(topo, 2e5);
topo.meta = {
  source: 'Census 2020 PL 94-171 total population and VAP by VTD (alarm-redist/census-2020); geometry from the Texas Legislative Council 2020 VTDs (t0lg-a/test_tx04 precincts_2020); 2020 president (VEST).',
  statewidePop: pop, censusVTDs: census.size, units: geoms.length, reconciliation: notes,
  adjacency, pieces,
};
fs.writeFileSync(OUT, JSON.stringify(topo));
console.error('bytes', fs.statSync(OUT).size);
