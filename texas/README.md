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
| Texas House | 150 | county line rule (Tex. Const. art. III, sec. 26) in full, every county whole; districts 185,421 to 204,851 (range under 10%); contiguity | seats, census totals, contiguity, band, range under 10%, all five county line rule tests |
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

The county line rule comes first; population only has to stay within the
lawful range (under 10% overall). Every Texas House plan keeps every county
whole: no small county is ever split, the counties that fit whole districts
(Harris 24 or 25, Dallas 14, Tarrant 11, Bexar 10, Williamson 3, Brazoria 2,
Ellis 1) keep them all inside, and each of the 18 surplus counties (Travis,
Collin, Denton, Hidalgo, El Paso, Fort Bend, Montgomery, Cameron, Bell and 9
others) keeps
floor(pop/ideal) districts inside and is crossed by exactly one district joined
with whole neighbouring counties.

Districts run from 185,421 to 204,851 people (−4.57% to +5.43%, an overall range
of at most 19,430, which is 9.9998% and so under 10%). The Legislature's usual
±5% band cannot keep every county whole: an exact solver proves that at ±5%
Kaufman County (145,310) has no whole partner (Van Zandt gives 204,851, 833 over),
which is why the enacted PlanH2316 splits Henderson. This tool never makes that
split.

`regions/house_clusters.json` holds 11 lawful county clusterings found by an
exact solver (`tools/house_clusters.py`, OR-Tools CP-SAT, run with
`HOUSE_LO=185421 HOUSE_HI=204851`), each with a complete lawful seed plan
(`tools/house_seed_plans.mjs`). A House run picks a clustering, starts every
cluster from its seed and optimises each cluster in a worker; no move can break
the county line rule.

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
HOUSE_LO=185421 HOUSE_HI=204851 venv/bin/python texas/tools/house_clusters.py counties.json clusters.json 12 240
node texas/tools/house_seed_plans.mjs texas/regions/tx_census2020.topo.json clusters.json texas/regions/house_clusters.json
```

`counties.json` (county populations and adjacency) comes from the census layer;
`tools/counties_json.mjs` writes it.
