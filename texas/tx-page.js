// tx-page.js: the Texas rules layer on top of the shared ReCom page.
//  - hard constraints for Senate and U.S. House runs (txHardImpl)
//  - Texas House runs under the county line rule, one worker job per county
//    cluster, each starting from a lawful seed plan (txStartRun)
//  - the Legal checks panel, filled by TXRules.validate after every run (txAfterRun)
//  - CSV export of census VTD -> district
'use strict';
(function () {
const CH = { cd: 'congress', sd: 'senate', hd: 'house' };
const CH_LABEL = { congress: 'U.S. House', senate: 'Texas Senate', house: 'Texas House' };
const chamber = () => CH[state.chamber];
const rkey = () => REGIONS[0].key;

// ── Static text for this dataset ──────────────────────────────────────────
$('hero-sub').textContent = TX_DATA.sub;
$('pop-note').innerHTML = TX_DATA.legal
  ? 'Population: 2020 Census total (PL 94-171).<br>Seat counts are fixed by law.'
  : 'Population: 2024 registered voters.<br>Exploratory view: no legal checks.';
$('hdr-pop-label').textContent = TX_DATA.legal ? 'Population (2020)' : 'Registered voters';
$('dr-pop-k').textContent = TX_DATA.popLabel;
$('tx-kicker').textContent = TX_DATA.legal ? 'ReCom Redistricting · Texas · 2020 Census' : 'ReCom Redistricting · Texas · 2024 precincts (exploratory)';

// House clustering picker, shown for the Texas House on census data.
const houseCtl = document.createElement('div');
houseCtl.id = 'house-ctl';
houseCtl.style.cssText = 'display:none;margin-top:12px';
houseCtl.innerHTML = `
  <div class="label">Standard</div>
  <select class="nin" id="house-std" style="width:100%;height:32px;padding:0 8px;margin-bottom:10px">
    <option value="std">Legislature's practice: every district within ±5%</option>
    <option value="strict">Strict county line: range under 10%, no county split</option>
  </select>
  <div class="label">County clustering (county line rule)</div>
  <select class="nin" id="house-cl" style="width:100%;height:32px;padding:0 8px"><option value="random">Random lawful clustering</option></select>
  <div class="hint" id="house-cl-info">Each clustering keeps every county whole except where the Texas Constitution allows a cut.</div>`;
$('enacted-info').after(houseCtl);

// CSV export next to the other exports.
const csvBtn = document.createElement('button');
csvBtn.className = 'cmd'; csvBtn.id = 'btn-export-csv'; csvBtn.disabled = true;
csvBtn.style.cssText = 'margin-top:8px;width:100%';
csvBtn.textContent = 'Export CSV (VTD → district)';
csvBtn.title = 'One row per 2020 Census VTD: GEOID20, district number.';
$('btn-export').parentElement.after(csvBtn);

// ── Context for the validator ─────────────────────────────────────────────
function ctx() {
  const r = state.regions[rkey()];
  if (!r || !r.features) return null;
  if (r._txctx) return r._txctx;
  const props = r.features.map(f => f.properties);
  r._txctx = {
    pop: Array.from(r.pop), rep: Array.from(r.ikt), dem: Array.from(r.muh), county: Array.from(r.il),
    countyName: state.ilNames, adj: r.adjGeo.map(s => Array.from(s)),
    vap: TX_DATA.legal ? { h: props.map(p => p.HVAP || 0), b: props.map(p => p.BVAP || 0), a: props.map(p => p.AVAP || 0), t: props.map(p => p.VAP || 0) } : null,
    geoid: TX_DATA.legal ? props.map(p => String(p.GEOID20)) : null,
    pieces: (r.topo.meta && r.topo.meta.pieces) || {},
    pieceGraph: r.pg || null,
  };
  return r._txctx;
}

// ── Hard constraints for statewide runs ───────────────────────────────────
window.txHardImpl = function (key) {
  if (!TX_DATA.legal || key !== rkey()) return null;
  const r = state.regions[key];
  const P = TXRules.chamberParams(chamber(), r.totalPop);
  if (seatsFor() !== P.seats) return null;
  if (chamber() === 'senate') return { lo: P.lo, hi: P.hi };
  if (chamber() === 'congress') { const t = state.tol; return { lo: Math.floor(P.ideal * (1 - t)), hi: Math.ceil(P.ideal * (1 + t)) }; }
  return null;
};

// Chamber switch: per-chamber tolerance defaults and the House controls.
function onChamber() {
  const ch = chamber();
  $('enacted-info').textContent = 'Scores the enacted plan with the same checks as generated maps.';
  setTolUI(ch === 'congress' ? 0.005 : 0.05);
  houseCtl.style.display = (ch === 'house' && TX_DATA.legal) ? '' : 'none';
  if (ch === 'house' && TX_DATA.legal) loadHouseLib();
  renderRules();
}
document.querySelectorAll('[data-chamber]').forEach(b => b.addEventListener('click', onChamber));
setTolUI(0.005);

// ── Legal checks panel ────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LEVEL = { law: 'binding', presumptive: 'presumptive', practice: 'practice', report: 'report only' };
function renderRules(label) {
  const r = state.regions[rkey()];
  const list = $('rules-list'), sum = $('rules-summary');
  list.innerHTML = '';
  csvBtn.disabled = !(r && r.assignment);
  if (!TX_DATA.legal) { sum.textContent = 'Legal checks are off in the 2024 exploratory view: its population is registered voters, not the 2020 Census.'; return; }
  if (!r || !r.assignment) { sum.textContent = 'Run or load a plan to check it.'; return; }
  const ch = chamber();
  const P = TXRules.chamberParams(ch, r.totalPop);
  if (r.k !== P.seats) { sum.textContent = `This map has ${r.k} districts; the ${CH_LABEL[ch]} has ${P.seats}. Pick a chamber and run to check a plan.`; return; }
  const lib = ch === 'house' ? (houseLibs[r.houseStd || houseStd()] || null) : null;
  const res = TXRules.validate(ch, ctx(), r.assignment, lib ? { necessarySmallSplits: lib.minSmallSplits, band: [lib.lo, lib.hi] } : {});
  r._txcheck = res;
  const binding = res.checks.filter(c => c.level !== 'report');
  const failed = binding.filter(c => !c.pass);
  const enacted = label && /^Plan/.test(label);
  sum.innerHTML = enacted
    ? `<b>${esc(label)}</b> carried to 2020 VTDs. The enacted plan follows census blocks and splits VTDs, so its population checks here are approximate; its county structure is exact.`
    : failed.length === 0
      ? `<b>This ${esc(CH_LABEL[ch])} plan meets every rule the tool checks.</b> Voting Rights Act compliance still needs legal review.`
      : `<b>${failed.length} rule${failed.length > 1 ? 's' : ''} not met.</b>`;
  if (ch === 'congress' && !enacted) {
    sum.innerHTML += ' Whole-VTD congressional plans cannot reach the 1-person range the courts require; that needs census blocks, which this dataset does not include.';
  }
  for (const c of res.checks) {
    const row = document.createElement('div');
    row.className = 'rule-row';
    const tag = c.level === 'report' ? 'info' : c.pass ? 'pass' : 'fail';
    row.innerHTML = `<span class="rule-tag ${tag}">${tag === 'info' ? 'INFO' : tag === 'pass' ? 'PASS' : 'FAIL'}</span>
      <span class="rule-body"><span class="rule-name">${esc(c.label)}</span> <span class="rule-level">${LEVEL[c.level]}</span><br><span class="rule-detail">${esc(c.detail)}</span></span>`;
    list.appendChild(row);
  }
}
window.txAfterRun = function (key, label) {
  if (key !== rkey()) return;
  // A statewide run or an enacted plan replaced any county-cluster House plan.
  delete state.regions[key].houseIdx;
  delete state.regions[key].houseStd;
  renderRules(label);
};
const style = document.createElement('style');
style.textContent = `
  .rules-panel { margin-top: 14px; }
  .rule-row { display: flex; gap: 10px; align-items: flex-start; padding: 6px 0; border-top: 1px solid var(--rule-soft); font-size: 13px; line-height: 1.4; }
  .rule-tag { font-family: var(--mono); font-size: 10.5px; font-weight: 700; padding: 2px 6px; border: 1px solid currentColor; flex-shrink: 0; min-width: 40px; text-align: center; }
  .rule-tag.pass { color: var(--ink); }
  .rule-tag.fail { color: var(--red); }
  .rule-tag.info { color: var(--muted); }
  .rule-level { font-family: var(--mono); font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .rule-detail { color: var(--ink-dim); font-size: 12.5px; }`;
document.head.appendChild(style);

// ── Texas House: county clusters ──────────────────────────────────────────
const HOUSE_FILES = { std: 'regions/house_clusters.json', strict: 'regions/house_clusters_strict.json' };
const houseLibs = {}, houseLibPs = {};
let houseLib = null;             // library of the selected standard
const houseStd = () => $('house-std').value;
function fillClusterings(lib) {
  const sel = $('house-cl');
  sel.innerHTML = '<option value="random">Random lawful clustering</option>';
  lib.clusterings.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `Clustering ${i + 1} · ${c.stats.splitSmall.length ? 'splits ' + c.stats.splitSmall.join(', ') : 'every county whole'}`;
    sel.appendChild(o);
  });
  const band = `${lib.lo.toLocaleString('en-US')} to ${lib.hi.toLocaleString('en-US')} people per district`;
  $('house-cl-info').textContent = lib.minSmallSplits
    ? `${lib.clusterings.length} lawful clusterings, ${band}. At ±5% no plan can keep every county whole: an exact solver proves at least ${lib.minSmallSplits} small county must be split (Kaufman County cannot be completed with whole neighbours), as the enacted PlanH2316 does. Each clustering splits exactly that many.`
    : `${lib.clusterings.length} lawful clusterings, ${band} (−4.57% to +5.43%, range 9.9998%). This band keeps every county whole; no court has said whether the county line rule requires it over the Legislature's ±5%. See RULES.md.`;
}
function loadHouseLib(std) {
  std = std || houseStd();
  if (!houseLibPs[std]) {
    houseLibPs[std] = fetch(HOUSE_FILES[std]).then(r => { if (!r.ok) throw new Error(HOUSE_FILES[std] + ': ' + r.status); return r.json(); })
      .then(lib => { houseLibs[std] = lib; return lib; })
      .catch(e => { delete houseLibPs[std]; status('Could not load the House clusterings: ' + e.message, '', true); throw e; });
  }
  return houseLibPs[std].then(lib => { if (std === houseStd()) { houseLib = lib; fillClusterings(lib); } return lib; });
}
$('house-std').addEventListener('change', () => { loadHouseLib(); renderRules(); });
const decodeSeed = (s) => { const a = new Int32Array(s.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 36); return a; };

let pool = null;
function getPool() {
  if (pool) return pool;
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  pool = Array.from({ length: n }, () => new Worker(state.workerUrl));
  return pool;
}
function callWorker(w, msg, until) {
  return new Promise((resolve) => {
    w.onmessage = (e) => { const m = e.data; if (until.includes(m.type)) resolve(m); };
    w.postMessage(msg);
  });
}

// Step runs one move on the statewide worker: not for a House plan built from
// county clusters, and not for a plan of another chamber.
window.txStepAllowed = function () {
  const r0 = state.regions[rkey()];
  if (r0 && r0.assignment && r0.k !== seatsFor()) { status(`This map has ${r0.k} districts. Pick its chamber again to step it.`, '', true); return false; }
  if (TX_DATA.legal && chamber() === 'house' && seatsFor() === 150) { status('Step is not available for the Texas House: use Run, Optimize or Polish, which keep the county line rule.', '', true); return false; }
  return true;
};

window.txStartRun = function (mode) {
  // Continue and polish work on the plan on screen: its district count must
  // match the chamber picked now, or the wrong chamber's rules would apply.
  const r0 = state.regions[rkey()];
  if (mode !== 'run' && r0 && r0.assignment && r0.k !== seatsFor()) {
    status(`This map has ${r0.k} districts. Pick its chamber again to continue or polish it, or run a new plan.`, '', true);
    return true;
  }
  if (!TX_DATA.legal || chamber() !== 'house' || state.active !== rkey() || seatsFor() !== 150) return false;
  const r = state.regions[rkey()];
  if (!r || !r.features || state.running.has(rkey())) return true;
  if ((mode === 'polish' || mode === 'continue') && r.houseIdx == null) {
    status('Run the Texas House first: polishing and continuing work on a county-line plan.', '', true);
    return true;
  }
  runHouse(mode).catch(e => { status('House run failed: ' + e.message, '', true); state.running.delete(rkey()); r.status = 'idle'; renderRegionList(); updateButtons(); });
  return true;
};

async function runHouse(mode) {
  const key = rkey(), r = state.regions[key], C = ctx();
  const std = mode === 'run' ? houseStd() : r.houseStd;
  const lib = await loadHouseLib(std);
  let idx;
  if (mode === 'run') {
    const v = $('house-cl').value;
    idx = v === 'random' ? Math.floor(Math.random() * lib.clusterings.length) : +v;
  } else idx = r.houseIdx;
  const entry = lib.clusterings[idx];
  const seed = (mode !== 'run' && r.assignment) ? r.assignment : decodeSeed(entry.seed);
  const jobs = TXRules.houseJobs(entry.clusters, C);
  r.status = 'running'; state.running.add(key);
  renderRegionList(); updateButtons();
  const weights = { ...state.weights };
  const itersTotal = +$('in-iters').value || 2000;
  const assignment = new Int32Array(r.N).fill(-1);
  // Number districts cluster by cluster (clusters in library order).
  let offset = 0;
  const work = [];
  // The seed must fit the clustering: every job holds exactly its own seed
  // districts (checked over every unit), and no district spans two jobs.
  const jobOfDistrict = new Map();
  for (let jn = 0; jn < jobs.length; jn++) {
    const job = jobs[jn];
    const base = offset; offset += job.seats;
    const unitOfNode = (nd) => nd.units.length ? nd.units[0] : nd.pieceOf;
    const ids = new Set();
    for (const nd of job.nodes) {
      for (const u of nd.units) ids.add(seed[u]);
      if (nd.units.length > 1 && nd.units.some(u => seed[u] !== seed[nd.units[0]])) ids.add(-1);   // a whole county split by the seed
    }
    for (const d of ids) {
      if (jobOfDistrict.has(d) && jobOfDistrict.get(d) !== jn) ids.add(-1);
      jobOfDistrict.set(d, jn);
    }
    if (ids.has(-1) || ids.size !== job.seats) {
      r.status = 'done'; state.running.delete(key); renderRegionList(); updateButtons();
      status(`This plan does not fit clustering ${idx + 1}; run the Texas House again to start from a lawful plan.`, '', true);
      return;
    }
    const local = new Map([...ids].sort((a, b) => a - b).map((d, i) => [d, i]));
    if (job.seats === 1) { for (const nd of job.nodes) for (const u of nd.units) assignment[u] = base; continue; }
    work.push({ job, base, init: Int32Array.from(job.nodes, nd => local.get(seed[unitOfNode(nd)])) });
  }
  const workers = getPool();
  const failedJobs = [];
  let done = 0;
  status(`Texas House: ${jobs.length} county clusters, ${work.length} to optimize`, `clustering ${idx + 1}`);
  const runJob = async (w, item, jid) => {
    const { job } = item;
    const k = job.seats, hard = { lo: lib.lo, hi: lib.hi, cross: job.cross };   // the library's band
    const keyJ = 'hj' + jid;
    w.postMessage({ type: 'init', key: keyJ, adj: job.adj, pop: job.pop, iktidar: job.r, muhalefet: job.d, il: job.il, glue: job.glue });
    await callWorker(w, { type: 'load', key: keyJ, k, label: 'seed', assignment: item.init.slice().buffer, weights, hard }, ['loaded', 'error']);
    const iters = Math.max(200, Math.round(itersTotal * k / 150 * 3));
    const res = await callWorker(w, {
      type: 'continue', key: keyJ, k, tol: 0.05, weights, iters, hard,
      seed: getRunSeed(keyJ, k), T0: +$('in-temp').value || 0, Tend: +$('in-Tend').value || 0,
      coolRate: +$('in-cooling').value || 0.9995, anneal: state.anneal, accept: state.accept,
      polish: mode === 'polish', polishFlips: +$('in-flips').value || 3, maxRetries: +$('in-retries').value || 50,
    }, ['done', 'error']);
    // A job that errors or ends with any violation keeps its lawful start.
    const ok = res.type === 'done' && res.metrics && res.metrics.viol === 0;
    if (!ok) failedJobs.push(job.counties.slice(0, 3).map(c => state.ilNames?.get(c) || c).join(', '));
    const a = ok ? new Int32Array(res.assignment) : item.init;
    job.nodes.forEach((nd, i) => { for (const u of nd.units) assignment[u] = item.base + a[i]; });
    done++;
    status(`Texas House: ${done} / ${work.length} multi-district clusters`, `clustering ${idx + 1}`);
  };
  // Largest clusters first across the pool.
  const queue = work.map((w, i) => [w, i]).sort((a, b) => b[0].job.seats - a[0].job.seats);
  await Promise.all(workers.map(async (w) => { while (queue.length) { const [item, i] = queue.shift(); await runJob(w, item, i); } }));
  r.assignment = assignment; r.k = 150; r.houseIdx = idx; r.houseStd = std;
  r.status = 'done'; state.running.delete(key);
  invalidateDistrictStats(r);
  r.metrics = TXRules.planMetrics(C, assignment, 150);
  r.scoreHist = []; r.iter = 0;
  recolorRegion(key); redrawDistrictLabels();
  if (state.active === key) { state.scoreHist = []; drawScoreChart(); updateMetricsPanel(); drawLegend(); }
  renderRegionList(); updateButtons();
  status(`Texas House plan built from clustering ${idx + 1}`, failedJobs.length ? `kept the lawful start in: ${failedJobs.join('; ')}` : `${jobs.length} county clusters`);
  renderRules();
}

// ── CSV export: one row per census VTD ───────────────────────────────────
csvBtn.onclick = () => {
  const r = state.regions[rkey()];
  if (!r || !r.assignment) return;
  const C = ctx();
  const rows = ['GEOID20,district'];
  const ids = C.geoid || r.features.map(f => String(f.properties.MAH_NAME));
  rows[0] = C.geoid ? 'GEOID20,district' : 'CNTYVTD,district';
  for (let i = 0; i < r.N; i++) for (const g of ids[i].split('|')) rows.push(`${g},${r.assignment[i] + 1}`);
  const blob = new Blob([rows.join('\n') + '\n'], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tx_${chamber()}_${r.k}d_${TX_DATA.legal ? 'census2020' : '2024'}.csv`;
  a.click();
};
})();
