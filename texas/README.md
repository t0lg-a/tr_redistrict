# Texas — ReCom Redistricting Tool

The same ReCom playground as the Türkiye tool (`../index.html`), run on Texas
precincts.

## Open

```bash
python3 -m http.server 8000   # from the repo root
```

Then open http://localhost:8000/texas/.

## Data (`regions/tx_texas.topo.json`, 4.6 MB)

Built from [t0lg-a/test_tx04](https://github.com/t0lg-a/test_tx04) (Texas
Legislative Council / TED sources) by `tools/build_tx.mjs`:

| field | meaning |
| --- | --- |
| units | 9,712 VTDs on the 2024 precinct lines (`precincts_2024`), simplified to ~227K points |
| `POP` | **2024 registered voters** (18,686,517). No census counts are in the source data, so population balance is by registered voters. |
| `IKTIDAR` / `MUHALEFET` | 2024 president: Trump (R) / Harris (D) |
| `IL` / `IL_NAME` | county code / name (the county plays the role of the Turkish il) |
| `MAH_NAME` | VTD key (`CNTYVTD`) |
| `CD` / `SD` / `HD` | enacted 2021-cycle plans: PlanC2193, PlanS2168, PlanH2316 |

## What's different from the Türkiye tool

- **Chamber picker**: U.S. House (38), Texas Senate (31), Texas House (150), or
  any k. No regions: the whole state is one graph.
- **Load enacted plan** scores the 2021 plan for the chosen chamber with the
  same metrics as generated maps (2024 presidential: CD 11 D / 27 R, SD 10 / 21,
  HD 54 / 96). Because population here is registered voters, not census
  population, the enacted plans show a large pop deviation (30–48%).
- **Optimize from current map** continues ReCom from the loaded plan (or a
  finished run) instead of a fresh random partition.
- **Single county** mode (was single il): default k = 4 (commissioners court).
- Partisan labels: İktidar → Republican (red), Muhalefet → Democratic (blue).
- Map uses a flat lon/lat projection with longitude scaled by cos 31°.

## Regenerating

`index.html` is generated from the Türkiye `../index.html` by
`tools/make_texas_page.py` (asserted string replacements), so fixes to the
main app carry over:

```bash
python3 texas/tools/make_texas_page.py
```

Data:

```bash
npm i topojson-server topojson-simplify topojson-client
node texas/tools/build_tx.mjs ../test_tx04 texas/regions/tx_texas.topo.json
```
