"""Generate texas/index.html from the Turkish app (index.html).

Every replacement is asserted, so if index.html changes underneath a
replacement the script stops instead of silently producing a broken page.
Run from anywhere: python3 texas/tools/make_texas_page.py
"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
s = src
def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'expected {count} got {n}: {old[:90]!r}')
    s = s.replace(old, new)

# ── head / hero
rep('<title>Türkiye 2023 ReCom — Almanac</title>', '<title>Texas ReCom — Almanac</title>')
rep('<div class="kicker">ReCom Redistricting · TR 2023 Milletvekili</div>',
    '<div class="kicker" id="tx-kicker">ReCom Redistricting · Texas</div>')
rep('<h1 class="hero-title">Türkiye 2023 — mahalle-level seat maps</h1>',
    '<h1 class="hero-title">Texas — district maps under the Texas rules</h1>')
rep('<div class="hero-sub">Recombination on 51,358 mahalles, 7 regions, with Antimander fair-redistricting objectives.</div>',
    '<div class="hero-sub"><span id="hero-sub">Loading…</span> <a href="../" style="color:inherit">Türkiye version</a></div>')
rep('<div class="micro">National electorate</div>', '<div class="micro" id="hdr-pop-label">Population</div>')

# ── apportionment panel -> chamber picker
rep('''      <div class="panel">
        <h3>Voters per district</h3>
        <input class="nin" type="number" id="in-vpd" value="100000" min="10000" max="2000000" step="1000">
        <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5">
          Apportionment target. Each region's<br>district count = round(electorate / target).
        </div>
      </div>

      <div class="panel">
        <h3>Regions</h3>
        <div class="region-list" id="region-list"></div>
      </div>
''', '''      <div class="panel">
        <h3>Chamber</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
          <button class="toggle-btn active" data-chamber="cd" title="U.S. House: 38 districts">U.S. House</button>
          <button class="toggle-btn" data-chamber="sd" title="Texas Senate: 31 districts">Senate</button>
          <button class="toggle-btn" data-chamber="hd" title="Texas House: 150 districts">House</button>
        </div>
        <div class="label" style="margin-top:10px">Districts (k)</div>
        <input class="nin" type="number" id="in-k" value="38" min="2" max="600" step="1">
        <input type="hidden" id="in-vpd" value="0">
        <div id="pop-note" style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5"></div>
        <button class="cmd" id="btn-enacted" disabled style="margin-top:10px;width:100%" title="Load the enacted 2021-cycle plan for this chamber (PlanC2193 / PlanS2168 / PlanH2316) and score it.">Load enacted PlanC2193</button>
        <div class="hint" id="enacted-info">Scores the current map against the same metrics.</div>
      </div>

      <div class="panel">
        <h3>State</h3>
        <div class="region-list" id="region-list"></div>
      </div>
''')

# ── run panel: single region, hide multi-region buttons
rep('<button class="cmd go" id="btn-runall" disabled style="margin-bottom:8px">Run all 7</button>',
    '<button class="cmd go" id="btn-runall" disabled style="display:none">Run all</button>')
rep('''<button class="cmd go" id="btn-runtr" disabled style="margin-bottom:8px" title="Run ReCom on the entire country as ONE graph (51K mahalle, k = total national seats). Cross-region adjacency built from shared polygon vertices.">Run Türkiye (national)</button>''',
    '''<button class="cmd go" id="btn-runtr" disabled style="display:none">Run national</button>
        <button class="cmd" id="btn-continue" disabled style="margin-bottom:8px" title="Keep running ReCom from the current map (for example the enacted plan) instead of starting from a fresh random partition.">Optimize from current map</button>''')
rep('title="Single-mahalle flip moves', 'title="Single-precinct flip moves')
rep('<button class="cmd" id="btn-reset" disabled style="margin-bottom:8px">Reset region</button>',
    '<button class="cmd" id="btn-reset" disabled style="margin-bottom:8px">Reset map</button>')

# ── single il -> single county
rep('<h3>Single İl · mayoral council</h3>', '<h3>Single county · commissioners / council</h3>')
rep('<div class="label">İl (province)</div>', '<div class="label">County</div>')
rep('<option value="">— pick an il —</option>\n        </select>', '<option value="">— pick a county —</option>\n        </select>')
rep('<div class="label" style="margin-top:10px">Council seats (k)</div>\n        <input class="nin" type="number" id="il-k" value="40" min="3" max="500" step="1">',
    '<div class="label" style="margin-top:10px">Seats (k)</div>\n        <input class="nin" type="number" id="il-k" value="4" min="2" max="500" step="1">')
rep('<div class="hint" id="il-info">Pick an il to see population / mahalle count.</div>',
    '<div class="hint" id="il-info">Pick a county to see voters / precinct count.</div>')
rep('<div class="label">Allow mahalle splitting</div>', '<div class="label">Allow precinct splitting</div>')
rep("<div class=\"hint\">Mahalleler larger than threshold × ideal split into halves with identical partisan margins — lets popDev drop in small il's where one mahalle exceeds an ideal district.</div>",
    "<div class=\"hint\">Precincts larger than threshold × ideal split into halves with identical partisan margins — lets popDev drop in small counties where one precinct exceeds an ideal district.</div>")
rep('<button class="cmd go" id="btn-runil" disabled style="margin-top:10px;width:100%">Run İl (current weights)</button>',
    '<button class="cmd go" id="btn-runil" disabled style="margin-top:10px;width:100%">Run county (current weights)</button>')
rep('title="Council elections are PR in real life. This run applies heavy fairness weights (target seat-share = vote share + mean-median + competitiveness) so the council mirrors the actual vote split.">Run İl proportional (PR)</button>',
    'title="Applies heavy fairness weights (target seat-share = vote share + mean-median + competitiveness) so the seats mirror the county vote split.">Run county proportional</button>')
rep('<button class="cmd" id="btn-exit-il" disabled style="margin-top:6px;width:100%">Exit İl mode</button>',
    '<button class="cmd" id="btn-exit-il" disabled style="margin-top:6px;width:100%">Exit county mode</button>')
rep('— run an il to see —', '— run a county to see —', 3)

# ── map overlays, drawer, metrics
rep('<div class="progress-pct" id="progress-pct">0 / 7</div>', '<div class="progress-pct" id="progress-pct">0 / 1</div>')
rep('<div class="drawer-stat"><div class="v" id="dr-share">—</div><div class="k">Muh share</div></div>',
    '<div class="drawer-stat"><div class="v" id="dr-share">—</div><div class="k">D share</div></div>')
rep('<div class="drawer-stat"><div class="v" id="dr-pop">—</div><div class="k">Population</div></div>',
    '<div class="drawer-stat"><div class="v" id="dr-pop">—</div><div class="k" id="dr-pop-k">Population</div></div>')
rep('<div class="drawer-stat"><div class="v" id="dr-mahs">—</div><div class="k">Mahalleler</div></div>',
    '<div class="drawer-stat"><div class="v" id="dr-mahs">—</div><div class="k">Precincts</div></div>')
rep('<div class="drawer-label">Margin distribution (this region)</div>', '<div class="drawer-label">Margin distribution (this map)</div>')
rep('Bars left-of-center = Iktidar margin; right = Muhalefet.', 'Bars left-of-center = Republican margin; right = Democratic.')
rep('<div class="k">Seats: M / İ</div>', '<div class="k">Seats: D / R</div>')

# ── settings text
rep('<div class="label">Stop when İkt seats ≥</div>', '<div class="label">Stop when R seats ≥</div>')
rep('<input class="nin" type="number" id="stop-ikt" value="350"', '<input class="nin" type="number" id="stop-ikt" value="25"')
rep('<div class="label">Stop when Muh seats ≥</div>', '<div class="label">Stop when D seats ≥</div>')
rep('<input class="nin" type="number" id="stop-muh" value="350"', '<input class="nin" type="number" id="stop-muh" value="19"')
rep('<button class="toggle-btn" data-preset="provinces" title="Keep districts inside il boundaries.">İl-preserving</button>',
    '<button class="toggle-btn" data-preset="provinces" title="Keep districts inside county boundaries.">County-preserving</button>')
rep('<button class="toggle-btn" data-preset="proiktidar" title="UNFAIR: maximize İktidar seats.">Pro-İktidar</button>',
    '<button class="toggle-btn" data-preset="proiktidar" title="UNFAIR: maximize Republican seats.">Pro-R</button>')
rep('<button class="toggle-btn" data-preset="promuh" title="UNFAIR: maximize Muhalefet seats.">Pro-Muhalefet</button>',
    '<button class="toggle-btn" data-preset="promuh" title="UNFAIR: maximize Democratic seats.">Pro-D</button>')
rep('<span class="weight-name">İl-split penalty</span>', '<span class="weight-name">County-split penalty</span>')
rep('<span class="weight-name">Partisan tilt (− Muh ← 0 → + İkt)</span>', '<span class="weight-name">Partisan tilt (− D ← 0 → + R)</span>')
rep('title="Internally ×10. Positive = İkt gerry; negative = Muh gerry."', 'title="Internally ×10. Positive = R gerrymander; negative = D gerrymander."')
rep('<span class="weight-name">Mahalle border</span>', '<span class="weight-name">Precinct border</span>')
rep('<div class="label">İl (province) borders</div>', '<div class="label">County borders</div>')
rep('<button class="toggle-btn" data-bg="iltint">İl tint</button>', '<button class="toggle-btn" data-bg="iltint">County tint</button>')
rep("Saves the active region's assignment plus current weights, tolerance, and VPD target.",
    "Saves the current map's assignment plus weights, tolerance, and district count.")

# ── worker: 'load' an existing assignment (enacted plan)
rep("""  if (m.type === 'pause')  { paused = true; return; }""",
"""  if (m.type === 'load') {
    const R = regions[m.key];
    if (!R) { self.postMessage({ type: 'error', key: m.key, msg: 'region not initialized' }); return; }
    R.totalDist = m.k;
    const S = buildState(R, m.k, new Int32Array(m.assignment));
    S.score = scoreFromState(S, m.weights);
    S.bestScore = S.score;
    S.bestAssignment.set(S.assignment);
    savedState = S; savedKey = m.key;
    const buf = S.assignment.slice().buffer;
    self.postMessage({ type: 'loaded', key: m.key, k: m.k, label: m.label,
      assignment: buf, score: S.score, metrics: metricsFromState(S) }, [buf]);
    return;
  }
  if (m.type === 'pause')  { paused = true; return; }""")

# ── main thread config
rep("""const REGIONS = [
  { key: 'marmara',           label: 'Marmara' },
  { key: 'ic_anadolu',        label: 'İç Anadolu' },
  { key: 'ege',               label: 'Ege' },
  { key: 'akdeniz',           label: 'Akdeniz' },
  { key: 'karadeniz',         label: 'Karadeniz' },
  { key: 'guneydogu_anadolu', label: 'Güneydoğu Anadolu' },
  { key: 'dogu_anadolu',      label: 'Doğu Anadolu' },
];

const TR_BBOX_FEATURE = {
  type: 'Feature', properties: {},
  geometry: { type: 'Polygon', coordinates: [[
    [25.5, 35.7], [45.2, 35.7], [45.2, 42.4], [25.5, 42.4], [25.5, 35.7]
  ]]}
};
""", """// Dataset: the 2020 Census layer (legal rules apply) by default; ?data=2024 is
// the exploratory 2024 precinct layer balanced on registered voters.
const TX_DATA = (() => {
  let q = '';
  try { q = new URLSearchParams(location.search).get('data') || ''; } catch {}
  return q === '2024'
    ? { key: 'texas', legal: false, popLabel: 'Reg. voters', rLabel: 'Trump (R) 2024', dLabel: 'Harris (D) 2024',
        sub: 'Exploratory: 9,712 precincts on the 2024 lines, 2024 president, balanced on 2024 registered voters. Legal checks are off in this view.' }
    : { key: 'census2020', legal: true, popLabel: 'Population', rLabel: 'Trump (R) 2020', dLabel: 'Biden (D) 2020',
        sub: '2020 Census population on all 9,007 census VTDs, 2020 president; every plan is checked against the Texas and federal rules.' };
})();
const REGIONS = [
  { key: TX_DATA.key, label: 'Texas' },
];

// Lon/lat extent of the precinct layer. Longitude is scaled by cos(31°) so
// Texas isn't stretched east-west (planar, so ring winding never matters).
const TX_BBOX = [-106.65, 25.83, -93.5, 36.51];
const TX_COS = Math.cos(31 * Math.PI / 180);
function makeFlatProj(w, h, pad) {
  const [x0, y0, x1, y1] = TX_BBOX;
  const s = Math.min((w - 2 * pad) / ((x1 - x0) * TX_COS), (h - 2 * pad) / (y1 - y0));
  const ox = (w - (x1 - x0) * TX_COS * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  const proj = (c) => [ox + (c[0] - x0) * TX_COS * s, oy + (y1 - c[1]) * s];
  proj.stream = d3.geoTransform({ point(x, y) { const p = proj([x, y]); this.stream.point(p[0], p[1]); } }).stream;
  return proj;
}

// Chambers: k plus the precinct property holding the enacted 2021-cycle plan.
const CHAMBERS = {
  cd: { label: 'U.S. House',   k: 38,  field: 'CD', plan: 'PlanC2193' },
  sd: { label: 'Texas Senate', k: 31,  field: 'SD', plan: 'PlanS2168' },
  hd: { label: 'Texas House',  k: 150, field: 'HD', plan: 'PlanH2316' },
};
const seatsFor = () => Math.max(2, state.kTarget | 0);
""")
rep("  vpd: 100000,\n", "  vpd: 0,\n  chamber: 'cd',\n  kTarget: 38,\n")

# seat count everywhere comes from the chamber / k input
rep("totalSeats += Math.max(2, Math.round(r.totalPop / state.vpd));", "totalSeats += seatsFor();")
rep("const seats = r?.totalPop ? Math.max(2, Math.round(r.totalPop / state.vpd)) : '—';", "const seats = r?.totalPop ? seatsFor() : '—';")
rep("const k = r.k || Math.max(2, Math.round((r.totalPop || 1) / state.vpd));", "const k = r.k || seatsFor();")
rep("                   : Math.max(2, Math.round(r.totalPop / state.vpd));", "                   : seatsFor();")
rep("    seats += Math.max(2, Math.round(r.totalPop / state.vpd));", "    seats += seatsFor();")

# region list: no national card for a single-region state
rep("""  // National card at top — default selection, shows aggregate metrics.
  const nat = document.createElement('div');""", """  // National card at top — default selection, shows aggregate metrics.
  // Skipped when there's only one region (Texas): it would duplicate it.
  const nat = document.createElement('div');
  if (REGIONS.length > 1) {""")
rep("""    <div class="meta"><span class="dot ${natDot}"></span>${popLabel} · ${completed}/${REGIONS.length} computed</div>
  `;
  el.appendChild(nat);""", """    <div class="meta"><span class="dot ${natDot}"></span>${popLabel} · ${completed}/${REGIONS.length} computed</div>
  `;
  el.appendChild(nat);
  }""")

rep("""$('in-vpd').oninput = (e) => {
  state.vpd = Math.max(10000, Math.min(2000000, +e.target.value || 100000));
  renderRegionList(); updateHeaderTotals();
};""", """function setKTarget(k) {
  state.kTarget = Math.max(2, Math.min(600, k | 0 || 38));
  $('in-k').value = state.kTarget;
  renderRegionList(); updateHeaderTotals(); updateButtons();
}
$('in-k').oninput = (e) => {
  if (!(+e.target.value >= 2)) return;  // don't fight the user mid-typing
  setKTarget(+e.target.value);
  document.querySelectorAll('[data-chamber]').forEach(b =>
    b.classList.toggle('active', CHAMBERS[b.dataset.chamber].k === state.kTarget && b.dataset.chamber === state.chamber));
};
$('in-k').onchange = (e) => setKTarget(+e.target.value);
document.querySelectorAll('[data-chamber]').forEach(b => {
  b.onclick = () => {
    state.chamber = b.dataset.chamber;
    document.querySelectorAll('[data-chamber]').forEach(x => x.classList.toggle('active', x === b));
    setKTarget(CHAMBERS[state.chamber].k);
    $('btn-enacted').textContent = `Load enacted ${CHAMBERS[state.chamber].plan}`;
    const sp = { cd: [25, 19], sd: [20, 16], hd: [88, 76] }[state.chamber];
    $('stop-ikt').value = sp[0]; $('stop-muh').value = sp[1];
  };
});

// Load the enacted 2021-cycle plan for the current chamber into the worker
// so it's scored with exactly the same metrics as generated maps.
function loadEnactedPlan() {
  const key = REGIONS[0].key;
  const r = state.regions[key];
  if (!r?.features || state.running.has(key)) return;
  const ch = CHAMBERS[state.chamber];
  const M = r.pg ? r.pg.M : r.N;
  const assignment = new Int32Array(M);
  for (let i = 0; i < r.N; i++) assignment[i] = (r.features[i].properties[ch.field] | 0) - 1;
  for (let n = r.N; n < M; n++) assignment[n] = assignment[r.pg.unitOf(n)];
  if (assignment.some(d => d < 0 || d >= ch.k)) { status(`${ch.plan}: incomplete assignment`, '', true); return; }
  setKTarget(ch.k);
  if (state.active !== key) selectRegion(key);
  state.workers[key].postMessage({
    type: 'load', key, k: ch.k, label: ch.plan,
    assignment: assignment.buffer, weights: { ...state.weights }, hard: txHard(key),
  }, [assignment.buffer]);
}
$('btn-enacted').onclick = loadEnactedPlan;
// Hooks filled in by tx-page.js (loaded after this script).
function txHard(key) { return (typeof txHardImpl === 'function') ? txHardImpl(key) : null; }

// Continue ReCom from whatever assignment the worker holds (enacted plan or
// a finished run) rather than a fresh random partition.
function startContinue() {
  const key = state.active;
  const r = state.regions[key];
  if (!r || r.status !== 'done' || state.running.has(key)) return;
  r.status = 'running';
  state.running.add(key);
  state.runStartTs = Date.now();
  state._plateau = { bestSeen: Infinity, lastImproveIter: 0 };
  renderRegionList(); updateButtons();
  state.workers[key].postMessage({
    type: 'continue', key,
    tol: state.tol, weights: { ...state.weights },
    iters: +$('in-iters').value || 2000,
    seed: getRunSeed(key, r.k || 1),
    T0: +$('in-temp').value || 0,
    polishFlips: +$('in-flips').value || 3,
    anneal: state.anneal, throttleMs: state.throttleMs,
    Tend: +$('in-Tend').value || 0,
    coolRate: +$('in-cooling').value || 0.9995,
    accept: state.accept,
    maxRetries: +$('in-retries').value || 50,
    hard: txHard(key),
  });
}
$('btn-continue').onclick = () => { if (typeof txStartRun === 'function' && txStartRun('continue')) return; startContinue(); };""")

# help tips
rep("'in-flips': 'Number of single-mahalle flip moves", "'in-flips': 'Number of single-precinct flip moves")
rep("'stop-ikt': 'Abort when İktidar seat count reaches this number.',", "'stop-ikt': 'Abort when the Republican seat count reaches this number.',")
rep("'stop-muh': 'Abort when Muhalefet seat count reaches this number.',", "'stop-muh': 'Abort when the Democratic seat count reaches this number.',")
rep("'map-mahopacity': 'Opacity of the fine per-mahalle border lines.',", "'map-mahopacity': 'Opacity of the fine per-precinct border lines.',")
rep("For aggressive gerrymandering or large k=600 nationally you want 20K-100K", "For aggressive gerrymandering or the 150-seat House you want 20K-100K")
rep("ilSplits:        'Province (İl) splits: number of il boundaries crossed by district boundaries. Higher weight = districts respect province lines.',",
    "ilSplits:        'County splits: number of extra districts each county is divided into, summed. Higher weight = districts respect county lines.',")
rep("partisanAdv:     'Partisan tilt (SIGNED). Positive = gerrymander toward İktidar (minimize Muh seats). Negative = gerrymander toward Muhalefet. Internally ×10 in the score.',",
    "partisanAdv:     'Partisan tilt (SIGNED). Positive = gerrymander toward Republicans (minimize D seats). Negative = gerrymander toward Democrats. Internally ×10 in the score.',")
rep("const SCN_KEY = 'tr-scenarios-v1';", "const SCN_KEY = 'tx-scenarios-v1';")
rep("""  if (typeof scn.vpd === 'number') {
    state.vpd = scn.vpd;
    $('in-vpd').value = scn.vpd;
    renderRegionList(); updateHeaderTotals();
  }""", """  if (typeof scn.k === 'number' && scn.region !== 'il') setKTarget(scn.k);""")
rep("""    r.assignment = new Int32Array(scn.assignment);
    r.metrics = scn.metrics || null;""", """    r.assignment = new Int32Array(scn.assignment);
    if (scn.k) r.k = scn.k;
    invalidateDistrictStats(r);
    r.metrics = scn.metrics || null;""")

# drawer
rep("""  if (regionKey === 'il')        regionLabel = state.regions.il?.label || 'İl';
  else if (regionKey === 'national') regionLabel = 'Türkiye';""", """  if (regionKey === 'il')        regionLabel = state.regions.il?.label || 'County';
  else if (regionKey === 'national') regionLabel = 'Texas';""")
rep("$('dr-winner').textContent = s.winner === 'Muhalefet' ? 'Muh' : s.winner === 'Iktidar' ? 'İkt' : '—';",
    "$('dr-winner').textContent = s.winner === 'Muhalefet' ? 'D' : s.winner === 'Iktidar' ? 'R' : '—';")
s = s.replace("toLocaleString('tr-TR')", "toLocaleString('en-US')")

# buttons
rep("""  if (isNat) $('btn-start').textContent = 'Pick region or Run Türkiye';
  else if (isIl) $('btn-start').textContent = `Run ${state.regions.il?.label || 'İl'}`;""",
"""  if (isNat) $('btn-start').textContent = 'Pick a region';
  else if (isIl) $('btn-start').textContent = `Run ${state.regions.il?.label || 'county'}`;""")
rep("""  $('btn-export-png').disabled = isNat ? !natR?.assignment : !r?.assignment;""",
"""  $('btn-export-png').disabled = isNat ? !natR?.assignment : !r?.assignment;
  $('btn-enacted').disabled = !r?.features || isIl || activeRunning;
  $('btn-continue').disabled = isNat || isIl || !r || r.status !== 'done' || activeRunning;""")
rep("  else $('btn-start').textContent = `Run ${REGIONS.find(m => m.key === state.active)?.label || ''}`;",
    "  else $('btn-start').textContent = `Run ${CHAMBERS[state.chamber]?.label || ''} · k=${seatsFor()}`;")
rep('<div class="map-overlay-tr" id="map-tip">click region · then Run</div>', '<div class="map-overlay-tr" id="map-tip">click a district for details</div>')

# boot
rep("""  $('progress-pct').textContent = '0 / 7';""", """  $('progress-pct').textContent = `0 / ${REGIONS.length}`;""")
rep("fetch(`regions/tr_${meta.key}.topo.json`)", "fetch(`regions/tx_${meta.key}.topo.json`)")
rep("      $('progress-pct').textContent = `${done} / 7`;", "      $('progress-pct').textContent = `${done} / ${REGIONS.length}`;")
rep("""  $('progress').style.display = 'none';
  // Build the merged-Türkiye graph + spawn its worker so "Run Türkiye" is
  // immediately available once the regional fetches complete.
  $('progress-ttl').textContent = 'Building national graph…';""", """  $('progress').style.display = 'none';
  // Single-region state: no merged national graph to build.
  if (REGIONS.length > 1) {
  $('progress-ttl').textContent = 'Building national graph…';""")
rep("""  $('progress').style.display = 'none';
  populateIlSelect();
  selectRegion('national');
  updateButtons();
  status('Ready. Pick a region and Run, or Run all 7 / Türkiye, or pick an il.', '');""", """  $('progress').style.display = 'none';
  }
  populateIlSelect();
  selectRegion(REGIONS.length > 1 ? 'national' : REGIONS[0].key);
  updateButtons();
  status('Ready. Pick a chamber and Run, load the enacted plan, or pick a county.', '');""")
rep("  return `${n.toLocaleString('en-US')} mahalle`;", "  return `${n.toLocaleString('en-US')} precincts`;")
rep("  state.proj = d3.geoIdentity().reflectY(true).fitExtent([[8, 8], [w - 8, h - 8]], TR_BBOX_FEATURE);",
    "  state.proj = makeFlatProj(w, h, 8);")

# worker msg: 'loaded'
rep("""  if (m.type === 'partition' || m.type === 'done') {
    // Full assignment arrived as transferable ArrayBuffer""", """  if (m.type === 'loaded') {
    r.assignment = new Int32Array(m.assignment);
    invalidateDistrictStats(r);
    r.k = m.k; r.metrics = m.metrics; r.iter = 0;
    r.bestScore = m.score; r.scoreHist = [m.score];
    r.status = 'done'; r._polishedThisRun = true;
    recolorRegion(m.key);
    if (state.active === m.key) {
      state.scoreHist = r.scoreHist;
      drawScoreChart(); updateMetricsPanel(); drawLegend();
    }
    renderRegionList(); updateButtons(); redrawDistrictLabels();
    const mm = m.metrics;
    $('enacted-info').textContent = `${m.label} at VTD level (the enacted plan follows census blocks and splits VTDs, so its populations here are approximate): ${mm.muhSeats} D / ${mm.iktSeats} R · max dev ${(mm.popDev * 100).toFixed(1)}%`;
    status(`${m.label} loaded`, `score ${m.score.toFixed(0)}`);
    return;
  }

  if (m.type === 'partition' || m.type === 'done') {
    // Full assignment arrived as transferable ArrayBuffer""")

# il (county) mode text
rep("    label: state.ilNames?.get(ilCode) ? `İl ${state.ilNames.get(ilCode)}` : `İl ${ilCode}`,",
    "    label: state.ilNames?.get(ilCode) ? `${state.ilNames.get(ilCode)} County` : `County ${ilCode}`,")
rep("if (!G) { status('No mahalleler found for il ' + ilCode, 'err'); return; }", "if (!G) { status('No precincts found for county ' + ilCode, 'err'); return; }")
rep("  // Sort by Turkish locale name\n  const entries = Array.from(state.ilNames.entries()).sort((a, b) => a[1].localeCompare(b[1], 'tr'));",
    "  const entries = Array.from(state.ilNames.entries()).sort((a, b) => a[1].localeCompare(b[1], 'en'));")
rep("  sel.innerHTML = '<option value=\"\">— pick an il —</option>';", "  sel.innerHTML = '<option value=\"\">— pick a county —</option>';")
rep("    o.textContent = `${name}  ·  ${popM}M  ·  ${cnt} mh`;", "    o.textContent = `${name}  ·  ${popM}M  ·  ${cnt} pct`;")
rep("  const name = state.ilNames?.get(ilCode) || ('İl ' + ilCode);", "  const name = state.ilNames?.get(ilCode) || ('County ' + ilCode);")
rep("    $('il-info').textContent = 'Pick an il to see population / mahalle count.';", "    $('il-info').textContent = 'Pick a county to see voters / precinct count.';")
rep("  const k = Math.max(2, +$('il-k').value | 0 || 40);", "  const k = Math.max(2, +$('il-k').value | 0 || 4);")
rep("""    <div><b>${facts.name}</b> · ${(facts.pop / 1e6).toFixed(2)}M pop · ${facts.cnt} mh</div>
    <div>Max mahalle = ${facts.maxMah.toLocaleString('en-US')} (${ratio}× ideal at k=${k})</div>
    <div>Vote split: İkt <b>${iktPct.toFixed(1)}%</b> / Muh <b>${muhPct.toFixed(1)}%</b></div>
    <div>Proportional target at k=${k}: İkt <b>${fairIkt}</b> / Muh <b>${fairMuh}</b></div>`;""",
"""    <div><b>${facts.name}</b> · ${(facts.pop / 1e6).toFixed(2)}M reg. voters · ${facts.cnt} pct</div>
    <div>Largest precinct = ${facts.maxMah.toLocaleString('en-US')} (${ratio}× ideal at k=${k})</div>
    <div>Vote split: R <b>${iktPct.toFixed(1)}%</b> / D <b>${muhPct.toFixed(1)}%</b></div>
    <div>Proportional target at k=${k}: R <b>${fairIkt}</b> / D <b>${fairMuh}</b></div>`;""")
# county seat suggestion: commissioners court = 4; bigger counties get city-council sizes
rep("""  let suggestK = 25;
  if (pop > 5e6)      suggestK = 200;
  else if (pop > 1e6) suggestK = 75;
  else if (pop > 5e5) suggestK = 55;
  else if (pop > 2e5) suggestK = 37;
  else if (pop > 1e5) suggestK = 31;
  else if (pop > 5e4) suggestK = 25;
  else                suggestK = 15;""", """  // Commissioners court: every Texas county has 4 precincts.
  const suggestK = 4;""")
rep("  const k = +$('il-k').value || 40;", "  const k = +$('il-k').value || 4;")

# tooltip
rep("""function buildTooltipHTML(regionLabel, d, stats, mahalle_n, il_code) {""",
    """function buildTooltipHTML(regionLabel, d, stats, mahalle_n, il_code, feat) {""")
rep("""    <div class="tt-row"><span>Population</span><span class="v">${_fmtNum(Math.round(s.pop))}</span></div>""",
    """    <div class="tt-row"><span>${TX_DATA.popLabel}</span><span class="v">${_fmtNum(Math.round(s.pop))}</span></div>""")
rep("""    <div class="tt-row"><span>Mahalleler</span><span class="v">${_fmtNum(s.n)}</span></div>""",
    """    <div class="tt-row"><span>Precincts</span><span class="v">${_fmtNum(s.n)}</span></div>""")
rep("""    <div class="tt-row"><span>Muhalefet</span><span class="v tt-pos">${muhPct}%</span></div>
    <div class="tt-row"><span>Iktidar</span><span class="v tt-neg">${iktPct}%</span></div>""",
    """    <div class="tt-row"><span>${TX_DATA.dLabel}</span><span class="v tt-pos">${muhPct}%</span></div>
    <div class="tt-row"><span>${TX_DATA.rLabel}</span><span class="v tt-neg">${iktPct}%</span></div>""")
rep("""  const winnerLabel = (winnerCls === 'tt-tossup') ? 'Tossup' : s.winner;""",
    """  const winnerLabel = (winnerCls === 'tt-tossup') ? 'Tossup' : (s.winner === 'Muhalefet' ? 'D' : s.winner === 'Iktidar' ? 'R' : s.winner);""")
rep("""    <div class="tt-hdr" style="margin-bottom:0">Mahalle #${mahalle_n} · İl ${il_code}</div>""",
    """    <div class="tt-hdr" style="margin-bottom:0">${feat ? `VTD ${feat.MAH_NAME} · ${feat.IL_NAME} Co. · ${_fmtNum(feat.POP)} reg. · R ${feat.IKTIDAR} / D ${feat.MUHALEFET}` : `Precinct #${mahalle_n}`}</div>""")
rep("  tip.innerHTML = buildTooltipHTML(r.label, d, stats, idx, r.il[idx]);",
    "  tip.innerHTML = buildTooltipHTML(r.label, d, stats, idx, r.il[idx], r.features[idx]?.properties);")

# legend
rep("""<span class="legend-chip"><span class="sw" style="background:var(--red-deep)"></span>Iktidar</span>""",
    """<span class="legend-chip"><span class="sw" style="background:var(--red-deep)"></span>Republican</span>""")
rep("""<span class="legend-chip"><span class="sw" style="background:var(--blue-deep)"></span>Muhalefet</span>""",
    """<span class="legend-chip"><span class="sw" style="background:var(--blue-deep)"></span>Democratic</span>""")

# exports
s = s.replace("a.download = `tr_", "a.download = `tx_")


# ── Worker: hard constraints for the Texas rules ───────────────────────────
# A continuous violation V (population outside [lo, hi] in percentage points of
# the ideal, plus county crossings over each county's limit) enters every score
# with weight HARD_W, so a feasible plan always beats an infeasible one and no
# accepted move can make a feasible plan infeasible. S.viol is kept exact
# incrementally by recomStepInc and flipStep.
rep("""// ── Maintained-state ReCom ─────────────────────────────────────────""",
"""// ── Hard constraints (Texas rules) ───────────────────────────────────
const HARD_W = 1e6;
function hardExcess(H, p) { return (p < H.lo ? H.lo - p : p > H.hi ? p - H.hi : 0) / H.ideal * 100; }
// Glue: nodes that are pieces of one indivisible unit (a census VTD whose
// territory is in several pieces) must share a district. Each group adds
// (districts it touches - 1) to the violation.
function glueCount(S, g) {
  let a = S.assignment[g[0]], n = 1;
  if (g.length === 2) return S.assignment[g[1]] === a ? 0 : 1;
  const seen = [a];
  for (let i = 1; i < g.length; i++) { const d = S.assignment[g[i]]; if (!seen.includes(d)) { seen.push(d); n++; } }
  return n - 1;
}
function hardAttach(S, hard) {
  const R = S.R;
  if (!hard && !R.glue) { S.hard = null; S.viol = 0; return; }
  hard = hard || { lo: -Infinity, hi: Infinity };
  const lim = {};
  for (const [il, l] of (hard.cross || [])) lim[il] = l;
  S.hard = { lo: hard.lo, hi: hard.hi, ideal: R.totalPop / S.k, lim: (hard.cross && hard.cross.length) ? lim : null };
  hardRecompute(S);
}
function hardRecompute(S) {
  const H = S.hard; let v = 0;
  for (let d = 0; d < S.k; d++) v += hardExcess(H, S.pops[d]);
  S.crossCnt = new Map();
  if (H.lim) {
    for (const [key, cnt] of S.ilDistCount) {
      const il = (key / S.k) | 0, d = key - il * S.k;
      if (H.lim[il] === undefined) continue;
      if (cnt > 0 && cnt < S.districtNodes[d].length) S.crossCnt.set(il, (S.crossCnt.get(il) || 0) + 1);
    }
    for (const [il, c] of S.crossCnt) v += Math.max(0, c - H.lim[il]);
  }
  if (S.R.glue) for (const g of S.R.glue) v += glueCount(S, g);
  S.viol = v;
}

// ── Maintained-state ReCom ─────────────────────────────────────────""")
rep("""  if (weights.ilSplits) s += weights.ilSplits * S.ilSplits;
  return s;
}""", """  if (weights.ilSplits) s += weights.ilSplits * S.ilSplits;
  if (S.hard) s += HARD_W * S.viol;
  return s;
}""")
rep("""    ilSplits: S.ilSplits,
  };""", """    ilSplits: S.ilSplits,
    viol: S.hard ? S.viol : 0,
  };""")
# recomStepInc: violation delta before the proposed score
rep("""  // ── Proposed score
  let proposed = 0;""", """  // ── Hard-constraint delta (only d1, d2 change)
  let newViol = S.viol || 0;
  const hardCrossUpd = [];
  if (S.hard) {
    const H = S.hard;
    newViol += hardExcess(H, newPop_d1) + hardExcess(H, newPop_d2) - hardExcess(H, S.pops[d1]) - hardExcess(H, S.pops[d2]);
    if (H.lim) {
      const o1 = list1.length, o2 = list2.length, n1 = r.nStrict, n2 = arrLen - r.nStrict;
      const chg = new Map();
      for (const [key, , newC] of ilCountChanges) chg.set(key, newC);
      const seenIl = new Set();
      for (let i = 0; i < arrLen; i++) {
        const il = R.il[arr[i]];
        if (seenIl.has(il)) continue;
        seenIl.add(il);
        const lim = H.lim[il];
        if (lim === undefined) continue;
        const k1 = il * S.k + d1, k2 = il * S.k + d2;
        const c1o = S.ilDistCount.get(k1) || 0, c2o = S.ilDistCount.get(k2) || 0;
        const c1n = chg.has(k1) ? chg.get(k1) : c1o, c2n = chg.has(k2) ? chg.get(k2) : c2o;
        const fo = (c1o > 0 && c1o < o1 ? 1 : 0) + (c2o > 0 && c2o < o2 ? 1 : 0);
        const fn = (c1n > 0 && c1n < n1 ? 1 : 0) + (c2n > 0 && c2n < n2 ? 1 : 0);
        if (fo === fn) continue;
        const oldCross = S.crossCnt.get(il) || 0, newCross = oldCross + fn - fo;
        newViol += Math.max(0, newCross - lim) - Math.max(0, oldCross - lim);
        hardCrossUpd.push(il, newCross);
      }
    }
    if (R.glue) {
      const doneG = new Set();
      for (let ci = 0; ci < nChanged; ci++) {
        const gi = R.glueOf[changedNodes[ci]];
        if (gi < 0 || doneG.has(gi)) continue;
        doneG.add(gi);
        const g = R.glue[gi];
        const before = glueCount(S, g);
        const seen = [];
        for (const n of g) { const d = isChanged[n] ? (inStrict[n] ? d1 : d2) : S.assignment[n]; if (!seen.includes(d)) seen.push(d); }
        newViol += (seen.length - 1) - before;
      }
    }
  }

  // ── Proposed score
  let proposed = 0;""")
rep("""  if (weights.ilSplits) proposed += weights.ilSplits * newIlSplits;
""", """  if (weights.ilSplits) proposed += weights.ilSplits * newIlSplits;
  if (S.hard) proposed += HARD_W * newViol;
""")
rep("""  S.ilSplits = newIlSplits;
  S.cutEdges = newCutEdges;""", """  S.ilSplits = newIlSplits;
  S.cutEdges = newCutEdges;
  if (S.hard) {
    S.viol = newViol;
    for (let i = 0; i < hardCrossUpd.length; i += 2) S.crossCnt.set(hardCrossUpd[i], hardCrossUpd[i + 1]);
  }""")
# flipStep: violation delta
rep("""    const newIlSplits = S.ilSplits + dIlSplits;

    // Proposed score
    let newScore = 0;""", """    const newIlSplits = S.ilSplits + dIlSplits;

    // Hard-constraint delta: pops of dFrom/dTo, and crossing status of every
    // limited county present in either district (sizes change by one).
    let newViol = S.viol || 0;
    const hardCrossUpd = [];
    if (S.hard) {
      const H = S.hard;
      newViol += hardExcess(H, newPopFrom) + hardExcess(H, newPopTo) - hardExcess(H, S.pops[dFrom]) - hardExcess(H, S.pops[dTo]);
      if (H.lim) {
        const toList0 = S.districtNodes[dTo];
        const oF = fromList.length, oT = toList0.length, nF = oF - 1, nT = oT + 1;
        const seenIl = new Set();
        const visit = (lst) => {
          for (let q = 0; q < lst.length; q++) {
            const ilq = R.il[lst[q]];
            if (seenIl.has(ilq)) continue;
            seenIl.add(ilq);
            const lim = H.lim[ilq];
            if (lim === undefined) continue;
            const cFo = S.ilDistCount.get(ilq * S.k + dFrom) || 0, cTo = S.ilDistCount.get(ilq * S.k + dTo) || 0;
            const cFn = ilq === il ? cFo - 1 : cFo, cTn = ilq === il ? cTo + 1 : cTo;
            const fo = (cFo > 0 && cFo < oF ? 1 : 0) + (cTo > 0 && cTo < oT ? 1 : 0);
            const fn = (cFn > 0 && cFn < nF ? 1 : 0) + (cTn > 0 && cTn < nT ? 1 : 0);
            if (fo === fn) continue;
            const oldCross = S.crossCnt.get(ilq) || 0, newCross = oldCross + fn - fo;
            newViol += Math.max(0, newCross - lim) - Math.max(0, oldCross - lim);
            hardCrossUpd.push(ilq, newCross);
          }
        };
        visit(fromList); visit(toList0);
      }
      if (R.glue && R.glueOf[node] >= 0) {
        const g = R.glue[R.glueOf[node]];
        const before = glueCount(S, g);
        const seen = [];
        for (const n of g) { const d = n === node ? dTo : S.assignment[n]; if (!seen.includes(d)) seen.push(d); }
        newViol += (seen.length - 1) - before;
      }
    }

    // Proposed score
    let newScore = 0;""")
rep("""    if (weights.ilSplits) newScore += weights.ilSplits * newIlSplits;
""", """    if (weights.ilSplits) newScore += weights.ilSplits * newIlSplits;
    if (S.hard) newScore += HARD_W * newViol;
""")
rep("""    S.ilSplits = newIlSplits;

    // cutFlat updates""", """    S.ilSplits = newIlSplits;
    if (S.hard) {
      S.viol = newViol;
      for (let q = 0; q < hardCrossUpd.length; q += 2) S.crossCnt.set(hardCrossUpd[q], hardCrossUpd[q + 1]);
    }

    // cutFlat updates""")
# attach hard constraints on load / run / continue
rep("""    const S = buildState(R, m.k, new Int32Array(m.assignment));
    S.score = scoreFromState(S, m.weights);""", """    const S = buildState(R, m.k, new Int32Array(m.assignment));
    hardAttach(S, m.hard);
    S.score = scoreFromState(S, m.weights);""")
rep("""      S = savedState;
      // Re-evaluate score under current weights (in case they changed)
      S.score = scoreFromState(S, weights);""", """      S = savedState;
      hardAttach(S, m.hard);
      // Re-evaluate score under current weights (in case they changed)
      S.score = scoreFromState(S, weights);
      S.bestScore = S.score;
      S.bestAssignment.set(S.assignment);""")
rep("""      S = buildState(R, m.k, assignment);
      S.score = scoreFromState(S, weights);""", """      S = buildState(R, m.k, assignment);
      hardAttach(S, m.hard);
      S.score = scoreFromState(S, weights);""")


# ── Hooks for tx-page.js: hard constraints, run overrides, validation ──────
rep("""    type: 'run', key, k,
""", """    type: 'run', key, k, hard: txHard(key),
""")
rep("""    type: r.assignment ? 'continue' : 'run', key, k,
""", """    type: r.assignment ? 'continue' : 'run', key, k, hard: txHard(key),
""")
rep("""function startPolish() {
  const key = state.active;""", """function startPolish() {
  if (typeof txStartRun === 'function' && txStartRun('polish')) return;
  const key = state.active;""")
rep("""    type: 'continue', key,
    tol: state.tol, weights: { ...state.weights },""", """    type: 'continue', key, hard: txHard(key),
    tol: state.tol, weights: { ...state.weights },""", 2)
rep("""function startRun() {
  if (state.active === 'national') return;  // national has its own CTA""", """function startRun() {
  if (typeof txStartRun === 'function' && txStartRun('run')) return;
  if (state.active === 'national') return;  // national has its own CTA""")
rep("""      onRunFinished(m.key, !!m.aborted);""", """      onRunFinished(m.key, !!m.aborted);
      if (typeof txAfterRun === 'function') txAfterRun(m.key);""")
rep("""    status(`${m.label} loaded`, `score ${m.score.toFixed(0)}`);
    return;""", """    status(`${m.label} loaded`, `score ${m.score.toFixed(0)}`);
    if (typeof txAfterRun === 'function') txAfterRun(m.key, m.label);
    return;""")
# Legal checks panel under the status line.
rep("""      <div class="status">
        <span class="lhs" id="status-l">Idle.</span>
        <span id="status-r">—</span>
      </div>
    </div>
  </div>
""", """      <div class="status">
        <span class="lhs" id="status-l">Idle.</span>
        <span id="status-r">—</span>
      </div>

      <div class="panel rules-panel" id="rules-panel">
        <h3>Legal checks</h3>
        <div class="hint" id="rules-summary" style="margin-top:0">Run or load a plan to check it.</div>
        <div id="rules-list"></div>
      </div>
    </div>
  </div>
""")
rep("""<script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>""", """<script src="https://cdn.jsdelivr.net/npm/topojson-client@3"></script>
<script src="tx-rules.js"></script>""")
rep("""bootRegions();
</script>
</body>""", """bootRegions();
</script>
<script src="tx-page.js"></script>
</body>""")
# Finer tolerance for congressional runs (down to 0.1%).
rep("""  tolLabel.textContent = `±${(t * 100).toFixed(1)}%`;""", """  tolLabel.textContent = `±${(t * 100).toFixed(t < 0.01 ? 2 : 1)}%`;""")
rep("""  const t = Math.max(0.01, Math.min(0.30, x * 0.30));
  setTolUI(Math.round(t * 200) / 200);""", """  const t = Math.max(0.001, Math.min(0.30, x * 0.30));
  setTolUI(t < 0.01 ? Math.round(t * 1000) / 1000 : Math.round(t * 200) / 200);""")


rep("""      il: new Int32Array(m.il),
      N: m.pop.length,
      totalPop: m.pop.reduce((a, b) => a + b, 0),
    };""", """      il: new Int32Array(m.il),
      N: m.pop.length,
      totalPop: m.pop.reduce((a, b) => a + b, 0),
    };
    if (m.glue && m.glue.length) {
      const R = regions[m.key];
      R.glue = m.glue.map(g => Int32Array.from(g));
      R.glueOf = new Int32Array(R.N).fill(-1);
      R.glue.forEach((g, gi) => { for (const n of g) R.glueOf[n] = gi; });
    }""")

# Adjacency shipped with the census layer (full-resolution geometry, shared
# boundary of positive length) replaces arc sharing on the simplified layer.
rep("""  const adj = buildAdjacency(tj);
  const adjGeo = adj.map(s => new Set(s));""", """  const adj = tj.meta && tj.meta.adjacency ? tj.meta.adjacency.map(a => Int32Array.from(a)) : buildAdjacency(tj);
  const adjGeo = adj.map(s => new Set(s));""")


# Worker graph with one node per piece of multipart census VTDs (glued to
# their unit), so every district stays contiguous at the level of territory.
rep("""  state.workers[meta.key].postMessage({
    type: 'init', key: meta.key,
    adj: adj.map(a => Array.from(a)),
    pop: Array.from(pop),
    iktidar: Array.from(ikt),
    muhalefet: Array.from(muh),
    il: Array.from(il),
  });
""", """  let pg = null;
  let wInit = { adj: adj.map(a => Array.from(a)), pop: Array.from(pop), iktidar: Array.from(ikt), muhalefet: Array.from(muh), il: Array.from(il) };
  if (tj.meta && tj.meta.pieces && Object.keys(tj.meta.pieces).length) {
    pg = TXRules.pieceGraph(N, tj.meta.adjacency, tj.meta.pieces);
    const pad = (a, f) => a.concat(pg.extraOf.map(f));
    wInit = { adj: pg.adj, pop: pad(Array.from(pop), () => 0), iktidar: pad(Array.from(ikt), () => 0),
      muhalefet: pad(Array.from(muh), () => 0), il: pad(Array.from(il), u => il[u]), glue: pg.glue };
  }
  state.workers[meta.key].postMessage({ type: 'init', key: meta.key, ...wInit });
""")
rep("""    topo: tj, features: fc.features, pop, ikt, muh, il, N, totalPop, adj, adjGeo,""",
    """    topo: tj, features: fc.features, pop, ikt, muh, il, N, totalPop, adj, adjGeo, pg,""")
rep("""    for (let i = 0; i < diff.length; i += 2) {
      const n = diff[i], d = diff[i + 1];
      els[n].setAttribute('fill', pal[d]);
    }""", """    for (let i = 0; i < diff.length; i += 2) {
      const n = diff[i], d = diff[i + 1];
      if (n < els.length) els[n].setAttribute('fill', pal[d]);   // extra piece nodes have no path
    }""")

open(os.path.join(ROOT, 'texas', 'index.html'), 'w', encoding='utf-8').write(s)
print('ok')
