# Türkiye 2023 Milletvekili — ReCom Redistricting Tool

Browser-based redistricting playground using ReCom (Recombination) on real
Turkey 2023 milletvekili election data, mahalle-level (precinct), 7 regions,
51,358 mahalles total.

**Texas version:** [`texas/`](texas/) — same tool on 9,712 Texas precincts
(2024 president, U.S. House / Senate / House chambers, enacted 2021 plans).

## Open

`index.html` — drag into browser. No build step. No server needed (or run
`python3 -m http.server` from this folder if your browser blocks file:// fetches
of the topojsons).

## Workflow

1. **Run sel.** or **Run all 7** — recursive bipartition seed + ReCom optimization
   for each region. All 7 regions run in parallel workers.
2. **Polish (drop popDev)** — when a region shows status `done`, hit Polish.
   This keeps the assignment you have and runs single-mahalle flip moves to push
   popDev below ReCom's tolerance floor.

## Why two modes

ReCom is good at big restructuring but stalls when sliver districts (3–6 mahalles)
appear. With so few mahalles, the merged-tree pop sums are too coarse to find a
balanced cut within tolerance — popDev gets stuck around 10–15% no matter how
many iterations you run.

Polish mode does the right thing for that regime: it picks the worst district,
finds a boundary mahalle in an opposite-sign neighbor, BFS-checks connectivity,
and flips one mahalle at a time. During flips it temporarily uses
`{cutEdges:0, popDev:1}` so cut-edge minimization can't block tiny popDev gains.
A ReCom step is mixed in every 4 iterations to escape local minima.

## Performance

- All 7 regions in parallel: ~600ms wall time (Marmara is k=191, Karadeniz N=11K)
- Polish: ~0.2ms/iter (3 flips + 1 ReCom = ~4 sub-ops per iter)

Optimizations:
- One Web Worker per region (parallel run)
- Maintained incremental state (cut edges, district pop/vote totals, il counts)
  so each ReCom step is O(merged size) instead of O(V+E)
- Pre-allocated reused typed-array buffers in the hot loop (no GC pressure)
- ArrayBuffer transfer + diff-only ticks for the main thread
- Worker keeps the optimized state across runs so Polish continues from there

## Data sources

- Polygons: TÜİK mahalle shapefiles (Q1E4 simplified)
- Vote totals: YSK 2023 milletvekili results, mahalle level
- 96.8% match rate after 11-pass name-normalization joiner

## Files

- `index.html` — the app (vanilla JS, single file)
- `regions/tr_*.topo.json` — 7 compact regional TopoJSONs (3-7MB each)
