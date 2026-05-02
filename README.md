# Türkiye 2023 Milletvekili — ReCom Redistricting Tool

Browser-based redistricting playground using ReCom (Recombination) on real
Turkey 2023 milletvekili election data, mahalle-level (precinct), 7 regions,
51,358 mahalles total.

## Open

`index.html` — drag into browser. No build step. No server needed (or run
`python3 -m http.server` from this folder if your browser blocks file:// fetches
of the topojsons).

## What it does

- Builds a population-balanced congressional map for each of the 7 NUTS-1
  geographic regions (Marmara, İç Anadolu, Ege, Akdeniz, Karadeniz,
  Doğu Anadolu, Güneydoğu Anadolu).
- Districts are seeded via recursive bipartition of a random spanning tree.
- ReCom optimizer iteratively merges two adjacent districts, builds a fresh
  spanning tree on the merge, finds a balanced cut, and accepts moves that
  reduce a weighted score (cut edges, population deviation, mean-median,
  efficiency gap, il-splits — all configurable).
- All 7 regions run in **parallel** workers — "Run all 7" finishes in roughly
  the time of the slowest single region, not 7× that.

## Performance

- Marmara (k=191, 2000 iters): ~500ms
- Karadeniz (N=11K mahalle, k=60, 2000 iters): ~600ms
- All 7 regions in parallel: ~600ms wall time

Optimizations:
- One Web Worker per region (parallel run)
- Maintained incremental state (cut edges, district pop/vote totals, il counts)
  so each ReCom step is O(merged size) instead of O(V+E)
- Pre-allocated reused typed-array buffers in the hot loop (no GC pressure)
- ArrayBuffer transfer + diff-only ticks for the main thread

## Data sources

- Polygons: TÜİK mahalle shapefiles (Q1E4 simplified)
- Vote totals: YSK 2023 milletvekili results, mahalle level
- 96.8% match rate after 11-pass name-normalization joiner

## Files

- `index.html` — the app (vanilla JS, single file, ~1900 lines)
- `regions/tr_*.topo.json` — 7 compact regional TopoJSONs (3-7MB each)
