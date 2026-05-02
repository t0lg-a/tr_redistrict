# TR ReCom — browser

ReCom redistricting on Turkey 2023 milletvekili data, mahalle level. All 7
geographic regions on one national map; one shared "voters per district"
target apportions seats to each region. Single HTML, vanilla JS, Web Worker
for the algorithm.

## Run locally

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open http://localhost:8000/. Browsers block fetch over `file://`, so a static
server is required.

## How it works

1. **Page boot**: fetches all 7 regional topojsons in parallel (~6.6 MB total
   over the wire), decodes geometry, renders to a single SVG with
   `d3.geoIdentity().reflectY(true)` fit to a Turkey bbox.
2. **Adjacency** built from shared topojson arcs; islands bridged by
   centroid-nearest neighbor (Bozcaada, Princes' Islands, etc.).
3. **Voters per district** (default 100,000) drives per-region seat counts:
   `seats[region] = round(electorate[region] / vpd)`.
4. **National view by default**: aggregate metrics across all 7 regions.
   Click a region card or any of its polygons to drill into one region.
5. **Run all 7** runs ReCom on each region serially. **Run [region]** runs
   just the active region. Per-region progress shown in the sidebar dots.
6. **Algorithm**:
   - Initial partition via **recursive bipartition** (split into halves down
     to leaves) with random spanning trees. Robust at any district count.
   - ReCom step: pick a random cut edge → merge the two districts → random
     spanning tree on the merged subgraph → balanced cut → reassign.
   - Greedy by default (T0=0); flip to positive `T0` in `runRegion()` for
     simulated annealing.
7. **Score** = weighted sum of: cut edges, population deviation², mean–median²,
   efficiency gap², il-splits. All toggleable.

## Performance

The worker maintains state incrementally — pops, ikts, muhs, cut-edge list,
il-split count, per-district node lists are all updated in O(merged) per step
rather than O(V+E). The main thread receives diff messages (~30 changed
mahalles per tick) instead of full assignments, and recolors only the
changed paths.

At Marmara (6,577 mahalles, k=191): ~0.5 ms/iter in worker. 2,000 iterations
complete in ~1 second on a modern laptop.

## Score conventions

Muhalefet sits on the "Dem" slot. Positive efficiency gap → Muhalefet wastes
more votes → Iktidar advantage. Mean–median similarly signed.

## National-view aggregation

When the National card is selected:

- **Pop dev**: maximum across regions (worst-case per-district imbalance)
- **Cut edges**: sum
- **İl splits**: sum
- **Seats M / İ**: sum
- **Efficiency gap, mean–median**: not aggregated (regions elect
  independently, so a single national value isn't meaningful — drill into
  a region to see them)

## Known rough edges

- Initial seed produces popDev of ~30–50% at high k. ReCom rebalances to
  ~10–15% over 500–2,000 iterations with default popDev weight.
- "Districts" color mode uses golden-angle hues. With 191 districts adjacent
  ones can look similar; switch to "Partisan" to read political geography.
- No Polsby-Popper (compactness) yet — easy to add to `totalScore()`.
- No district locking, no county-edge bias.

## Files

```
index.html               whole tool
regions/
├── tr_marmara.topo.json
├── tr_ege.topo.json
├── tr_akdeniz.topo.json
├── tr_ic_anadolu.topo.json
├── tr_karadeniz.topo.json
├── tr_dogu_anadolu.topo.json
└── tr_guneydogu_anadolu.topo.json
```
