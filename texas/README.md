# Texas — ReCom redistricting under the Texas rules

The same ReCom playground as the Türkiye tool (`../index.html`), run on Texas
and held to the legal rules for each chamber. Every plan the page draws is
checked, rule by rule, in the **Legal checks** panel under the map. The rules,
their sources and exactly how each is tested are in [RULES.md](RULES.md).

## Open

```bash
python3 -m http.server 8000   # from the repo root
```

Then open http://localhost:8000/texas/. `?data=2024` opens the exploratory 2024
view (below).

## What it enforces

| chamber | seats | enforced while drawing | checked after every run |
| --- | --- | --- | --- |
| Texas House | 150 | county line rule (Tex. Const. art. III, sec. 26) through county clusters; every district within ±5% (184,589 to 204,018); contiguity | seats, census totals, contiguity, ±5% band, range under 10%, all five county line rule tests |
| Texas Senate | 31 | every district within ±5%, so the overall range is under 10%; contiguity (art. III, sec. 25) | seats, census totals, contiguity, range under 10% (at most 94,017 people) |
| U.S. House | 38 | tolerance you set (default ±0.5%), then population polishing; contiguity | seats, census totals, contiguity, equal population (a range of at most 1 person) |

"Contiguous" means touching along a boundary of positive length, not at a
point. It is checked on the pieces of each VTD: some census VTDs are in several
pieces, and a district must connect every piece. Moves that would break a rule
are never accepted, so a run that starts lawful stays lawful.

Racial make-up (majority Hispanic, Black and Asian voting-age population) is
reported, never used as a target. Voting Rights Act compliance cannot be decided
by a tool and is not claimed.

### Texas House: the county line rule

Counties fall into four kinds at ±5%: small (kept whole and grouped with
neighbours), one district by itself (Ellis), self-contained (Harris 24 or 25,
Dallas 13 or 14, Tarrant 11, Bexar 10, Williamson 3, Bell 2, Brazoria 2: no
district crosses their line) and surplus (17 counties: floor(pop/ideal)
districts inside and one district crossing the line with whole neighbours).

`regions/house_clusters.json` holds lawful county clusterings found by an exact
solver (`tools/house_clusters.py`, OR-Tools CP-SAT), each with a complete lawful
seed plan (`tools/house_seed_plans.mjs`). A House run picks a clustering, starts
every cluster from its seed and optimises each cluster in a worker.

The solver proves that **no plan can keep every small county whole at ±5%**:
Kaufman County (145,310) cannot be completed with whole neighbours (Van Zandt,
the smallest, gives 204,851, which is 833 over the band) and no surplus county
can reach it. So one small county must be split, as PlanH2316 does with
Henderson; every clustering here splits exactly one (Kaufman, Henderson, Hunt or
Rockwall) into exactly two districts. The ±5% band is the Legislature's practice,
not a court rule; see RULES.md for the alternative reading.

### U.S. House: what whole VTDs cannot do

Congressional districts must be equal to within one person (37 districts of
766,987 and one of 766,986). Whole VTDs, up to 25,582 people each, cannot get
there; the Legislature splits VTDs along census blocks. This data has no census
blocks, so U.S. House plans here reach a few thousand people of range and the
checks say so plainly. Adding 2020 census block populations and block-to-VTD
assignments would allow the final block-level balancing step.

## Data

`regions/tx_census2020.topo.json` (the default) is built by
`tools/build_tx_census.mjs`:

| field | meaning |
| --- | --- |
| units | 8,989 units carrying all 9,007 2020 Census VTDs |
| `POP` | 2020 Census total population, PL 94-171 (statewide 29,145,505) |
| `VAP`, `HVAP`, `BVAP`, `AVAP`, `WVAP` | voting-age population by group (reported only) |
| `IKTIDAR` / `MUHALEFET` | 2020 president: Trump (R) / Biden (D), VEST, retabulated to 2020 VTDs |
| `IL` / `IL_NAME` | county code / name |
| `GEOID20` | the census VTD GEOID(s) the unit carries (`a|b` when several) |
| `CD` / `SD` / `HD` | enacted 2021 plans (PlanC2193, PlanS2168, PlanH2316) carried to VTDs |
| `meta.adjacency` | neighbours sharing a boundary of positive length (full-resolution geometry) |
| `meta.pieces` | for VTDs in several pieces, the neighbours of each piece |

Population and demographics come from
[alarm-redist/census-2020](https://github.com/alarm-redist/census-2020)
(`census-vest-2020/tx_2020_vtd.csv`). Geometry is the Legislative Council's
2020 VTD layer from [t0lg-a/test_tx04](https://github.com/t0lg-a/test_tx04)
(`precincts_2020`). The two agree on 8,843 VTDs; 145 census VTDs are split into
A/B parts there and are merged back; 12 tiny Brazos VTDs (63 people) are carried
together by one unit; 7 census VTDs the Council folded into neighbours (75
people, all in their own county) are attached to the nearest-numbered VTD of
their county; two precincts created after the census are merged into their
neighbour. Every census VTD is in exactly one unit and the statewide total is
exact; the build fails otherwise. The enacted plans were drawn on census blocks,
so their populations here are approximate; the Senate plan still matches its
official range exactly (57,661 people).

`regions/tx_texas.topo.json` (`?data=2024`) is the exploratory layer: 9,712
precincts on the 2024 lines, 2024 president, balanced on 2024 registered
voters. Legal checks are off there, because the rules count census population.

## Files

- `index.html`: generated from `../index.html` by `tools/make_texas_page.py`
  (asserted replacements, so fixes to the main app carry over)
- `tx-rules.js`: county classes, House clusters to worker jobs, piece graph,
  plan metrics and the validator
- `tx-page.js`: chamber rules, House runs, the Legal checks panel, CSV export
- `RULES.md`: every rule with its source and test
- `tools/`: data builders and the House clustering solver

## Rebuilding

```bash
npm i topojson-server topojson-simplify topojson-client
node texas/tools/build_tx_census.mjs ../test_tx04 tx_2020_vtd.csv texas/regions/tx_census2020.topo.json
python3 texas/tools/make_texas_page.py
python3 -m venv venv && venv/bin/pip install ortools
venv/bin/python texas/tools/house_clusters.py counties.json clusters.json 16 240
node texas/tools/house_seed_plans.mjs texas/regions/tx_census2020.topo.json clusters.json texas/regions/house_clusters.json
```

`counties.json` (county populations and adjacency) comes from the census layer;
`tools/counties_json.mjs` writes it.
