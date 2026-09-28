# Texas redistricting rules: what the law requires and what this tool does

This document lists the legal rules for the three Texas plans: the Texas House (150 seats), the Texas Senate (31 seats) and the U.S. House (38 seats). For each rule it gives the source and says exactly how the tool treats it. The tool can treat a rule in three ways:

- **enforced while drawing**, either structurally (the move cannot happen) or through a penalty (the move is scored as a violation);
- **checked** after every run in the Legal checks panel;
- **reported** for information only.

The document also says what the tool cannot do and which legal questions are still open.

Status: compiled September 28, 2026, from a research pass with adversarial review, then revised after a second review of the code. The code references are to these files:
- `texas/tx-rules.js`: the validator and the House clustering helpers
- `texas/tx-page.js`: House runs and the Legal checks panel
- `texas/tools/make_texas_page.py`: the worker's hard-constraint layer
- `texas/tools/house_clusters.py`: the county clustering solver
- `texas/tools/house_seed_plans.mjs`, `texas/tools/build_tx_census.mjs` and `texas/tools/check_rules.mjs`

The tool does not certify that any plan is lawful. It checks only the rules that can be computed from population, counties and geography. It cannot compute Voting Rights Act compliance, intent or racial predominance, and it never claims them.

## How to read this document

Categories:

- **Binding**: a constitutional or statutory rule, or a controlling holding.
- **Presumptive**: a threshold set by the courts. It shifts the burden of proof but can be rebutted.
- **Practice**: something the Legislature or the Texas Legislative Council (TLC) does, or a design choice of this tool. It is not law in itself.
- **Judgment only**: a legal standard that turns on evidence or intent and cannot be decided by a tool.

Evidence labels:

- **verified**: the text was read, either from the official source or from a verbatim copy. For most U.S. Supreme Court opinions the copy is a GitHub mirror of the opinion text.
- **excerpt**: seen only as a search-engine excerpt, because the site was blocked. All TLC, Texas statute, Texas court and Fifth Circuit sites were blocked during research. Treat these as unconfirmed.
- **computed**: arithmetic on the 2020 census data in this repository.

The Legal checks panel uses four level names: `binding` (code level `law`), `presumptive`, `practice` and `report only`. The panel says a plan "meets every rule the tool checks" when every check at the first three levels passes. The panel's level for a check is not always the same as the legal category in this document. Where they differ, the tables below say so.

**Enforcement while drawing is not a guarantee.** Population bands and county crossing limits are enforced through a very large penalty (section 3.5, step 4). A run can still end with a plan that breaks them: for example, a fresh Senate or U.S. House run that never reached zero violations, or a run with an extreme temperature. The validator after the run is the only guarantee.

## Summary

All three chambers use the 2020 Census PL 94-171 total population (29,145,505). The units are whole 2020 VTDs. Two units are contiguous only if they share a boundary of at least 1 metre. That length is measured approximately, on a quantized topology (section 1.3). For VTDs whose territory is in several pieces, contiguity is checked piece by piece.

### Texas House (150 seats; ideal 194,303.37)

| Rule | Category | Enforced while drawing | Checked after every run (check id) | Reported only |
| --- | --- | --- | --- | --- |
| 150 districts, every unit and census VTD assigned | binding (150 members). Single-member districts are practice, but the panel tags `seats` binding | yes | `seats`, `census-vtds` | |
| Population sums to 29,145,505 | a data-integrity check. The panel tags it binding (code level `law`) | | `total-pop` | |
| Overall range under 10% of ideal (at most 19,430 people) | presumptive | penalized (follows from the band) | `range` | |
| Every district within the band: 184,589 to 204,018 (±5%, default) or 185,421 to 204,851 (strict option) | practice (tool design choice) | penalized (not guaranteed) | `band` | |
| Contiguity | sec. 26 for county groups; practice for the whole district | yes | `contiguity` (the panel tags it binding) | |
| County line rule: small counties kept whole | binding. The ±5% exception for one split is the tool's reading, and it may not be legally necessary (section 7.2) | yes, structurally (each small county that must stay whole is one node) | `clr-small` | which small county is split, if any |
| County line rule: a county the size of one district is that district | binding | yes, structurally | `clr-one` | |
| County line rule: self-contained counties keep all their districts inside | binding | yes, structurally (separate jobs) | `clr-self` | |
| County line rule: a surplus county has floor(P/I) districts inside and is crossed once | binding (from the text; not decided in court for the current plan) | penalized (crossing limit 1) | `clr-surplus` | |
| County line rule: multi-county districts join only whole small counties and surplus remainders | binding | yes (cluster structure) | `clr-composition` | |
| Seat count for Harris (24 or 25) and Dallas (13 or 14) | judgment | fixed by each clustering | | `clr-k-choice` |
| Majority Hispanic, Black and Asian voting-age population | judgment (VRA) | never used | | `vra-report` |

### Texas Senate (31 seats; ideal 940,177.58)

| Rule | Category | Enforced while drawing | Checked after every run (check id) | Reported only |
| --- | --- | --- | --- | --- |
| 31 single-member districts, every unit and census VTD assigned | binding (art. III, secs. 2 and 25) | yes | `seats`, `census-vtds` | |
| Population sums to 29,145,505 | a data-integrity check. The panel tags it binding | | `total-pop` | |
| Overall range under 10% (at most 94,017 people) | presumptive; the hard reject is tool policy | penalized through a ±5% band (893,169 to 987,186); not guaranteed | `range` | |
| Contiguity | binding (art. III, sec. 25) | yes | `contiguity` | |
| County splits | no legal requirement | | | `county-splits` |
| Majority-minority VAP | judgment (VRA) | never used | | `vra-report` |

### U.S. House (38 seats; ideal 766,986.97)

| Rule | Category | Enforced while drawing | Checked after every run (check id) | Reported only |
| --- | --- | --- | --- | --- |
| 38 single-member districts, every unit and census VTD assigned | binding (2 U.S.C. 2c) | yes | `seats`, `census-vtds` | |
| Population sums to 29,145,505 | a data-integrity check. The panel tags it binding | | `total-pop` | |
| Equal population as nearly as practicable: range at most 1 person | binding standard (Art. I, sec. 2); "at most 1" is the tool's pass test | a tolerance you set (default about ±0.5%, rounded outward), penalized and not guaranteed, then population polishing | `equal-pop` (whole-VTD plans fail it) | |
| Contiguity | practice (not required by Texas or federal law) | yes | `contiguity` (tagged practice) | |
| County splits | no legal requirement | | | `county-splits` |
| Majority-minority VAP | judgment (VRA) | never used | | `vra-report` |

## 1. Rules that apply to all chambers

### 1.1 Population basis

- **Rule.** A district's population is the unadjusted 2020 Census PL 94-171 total population (all persons; table P1). The tool never uses voting-age population, citizen voting-age population, registered voters, ACS estimates, post-2020 estimates or the apportionment count.
- **Legal status by chamber.**
  - **House: binding.** Art. III, sec. 26 sets the ratio by "the population of the State, as ascertained by the most recent United States census" (verified; quoted in White v. Regester n.2).
  - **Senate.** Evenwel v. Abbott (2016), a Texas Senate case, held that a state "may draw its legislative districts based on total population". It left open whether other bases are allowed (verified).
  - **Congress.** The Supreme Court has never approved another base; Kirkpatrick doubted one "can ever be permissible". Karcher calls the census the only reliable basis, and every state uses total population (verified).
  - Evenwel n.3 lists ten states whose laws allow removing groups from the census count, and Texas is not one of them (verified). No Texas reallocation of prisoners was found.
- **Decade.** Plans are measured on 2020 counts until the 2030 redistricting data are released. TLC's Red-100T report for the 2025 congressional plan (PlanC2333) runs on "Data: 2020 Census" (verified; GitHub copy of the TLC report).
- **What the tool does.**
  - The census layer (`regions/tx_census2020.topo.json`) carries PL 94-171 total population.
  - The build fails unless the statewide total is exactly 29,145,505 and each of the 9,007 census VTDs is in exactly one unit.
  - The validator's `total-pop` check requires the district populations to add up to 29,145,505. It runs at code level `law`, so the panel shows it as binding. In substance it is a data-integrity check, not a separate legal rule.
  - Legal checks are off on the exploratory 2024 layer (`?data=2024`), because its population field is 2024 registered voters (18,686,517).
- **Ideals and integer limits (computed).** The tool uses the exact ideal (total divided by seats) for every test. TLC reports print a rounded ideal (194,303; 940,178; 766,987), so the tool's deviations can differ from TLC's by less than one person.
  - For the `range` checks this never changes a result: 10% of the ideal gives the same whole-person limits (19,430 and 94,017) under either ideal.
  - For the House `band` check it can change a result. The lower edge is ceil(0.95 × 194,303.3667) = 184,589. With TLC's rounded ideal of 194,303 the lower edge would be 184,588. A district of 184,588 is −4.99992% against TLC's ideal but −5.00001% against the exact one. It fails the tool's `band` check although it is within ±5% by TLC's convention.

| Chamber | Exact ideal | Decomposition | 10% of ideal | Tool limit |
| --- | --- | --- | --- | --- |
| House | 194,303.3667 | 150 × 194,303 + 55 | 19,430.34 | range at most 19,430 |
| Senate | 940,177.5806 | 31 × 940,177 + 18 | 94,017.76 | range at most 94,017 |
| U.S. House | 766,986.9737 | 38 × 766,986 + 37 | not used | range at most 1 (37 districts of 766,987 and 1 of 766,986) |

The panel prints the overall range as a percentage with 4 decimals. At 2 decimals, both 19,429 (9.9993%) and 19,431 (10.0003%) would print as "10.00%".

### 1.2 Complete partition and seat counts

- **Rule.**
  - Tex. Const. art. III, sec. 2: "The Senate shall consist of thirty-one members. The House of Representatives shall consist of 150 members." (verified against copies of the current text)
  - Sec. 25: "The State shall be divided into Senatorial Districts of contiguous territory, and each district shall be entitled to elect one Senator." (amended Nov. 6, 2001; verified)
  - 2 U.S.C. 2c: Representatives "shall be elected only from districts so established, no district to elect more than one Representative" (verified).
  - Texas has 38 U.S. House seats after the 2020 apportionment.
- **House single-member districts.** No Texas text requiring single-member House districts was found. Federal law does not forbid multi-member or floterial districts as such (White v. Regester n.9, describing Kilgarlin). However, specific Texas multi-member and floterial districts were struck down. The current plan uses 150 single-member districts, and the tool treats that as a fixed design choice.
- **What the tool does.**
  - `seats` fails if any unit is unassigned, if any unit has a district number out of range, or if any district is empty. The panel tags it binding and labels it "single-member districts" for every chamber. For the House, only the count of 150 is binding. Single-member districts are practice.
  - `census-vtds` (binding) checks that each of the 9,007 census VTD GEOIDs is in exactly one district. This check exists because some units carry several census VTDs.
  - Units with zero population must be assigned like any other unit.

### 1.3 Contiguity

- **What the law requires.**
  - **Senate: binding.** Sec. 25 requires "contiguous territory".
  - **House.** Sec. 26 requires counties joined in a district to be "contiguous to each other" (verified). Contiguity of the whole district, including its part inside a single county, is universal Texas practice.
  - **U.S. House: no requirement** in Texas or federal law (Wood v. Broom; verified). Shaw v. Reno says traditional criteria are "not ... constitutionally required" (verified).
  - In practice, Texas legislators agreed in 1991 that all congressional districts would be contiguous (Bush v. Vera, Stevens, J., dissenting, n.16; verified). TLC's Red-100T for PlanC2333 reports "Districts Contiguous: Yes" (verified copy).
- **Definition used (an operational choice).**
  - Two units are adjacent only if their shared boundary measures at least 1 metre (`MIN_SHARED_M = 1` in `build_tx_census.mjs`). The result is stored in `meta.adjacency`.
  - Point contact does not count as contiguity. No Texas constitutional text, statute or court decision defining point contact was found.
  - TLC's glossary reportedly says a district is "usually considered to be contiguous if all parts of the district touch one another at more than a point" (excerpt, unverified).
  - Shaw v. Reno described a North Carolina district that "remains contiguous only because it intersects at a single point" (verified). So point contact is legally ambiguous. In principle, excluding it is the conservative choice, because a stricter reading would not reject a plan the tool accepts. The measurement limits below mean this holds only approximately for very short boundaries.
- **How the length is measured, and its limits.**
  - The build does not measure on the original coordinates. It builds a topology quantized at 1e6 (`build_tx_census.mjs`, line 170). Over Texas that grid is about 1.1 to 1.3 metres, which is coarser than the 1 metre threshold.
  - Lengths use one fixed longitude factor, cos(31°), for the whole state. Texas spans about 26° to 36.5° N, so east-west lengths can be off by up to about 10%.
  - As a result, two vertices that snap together on the grid can create a one-step shared arc of 1 metre or more between units that really meet only at a point. Snapping can also remove a real edge that is only a few metres long. Adjacency near the 1 metre threshold is therefore approximate.
- **Pieces.**
  - 108 units have territory in several pieces (computed). For these, `meta.pieces` lists the neighbours of each piece, and the validator checks that every piece connects to the rest of its district.
  - Two pieces shared no boundary with any other unit: one of McCulloch VTD 3070201 and one of Rusk VTD 4010314. At build time each was resolved as an enclave of the unit whose outline carries its boundary. The rule is that at least two of the piece's vertices lie on that outline within 1 cm, measured in the quantized coordinates. There is no length test.
  - `check_rules.mjs` asserts that no piece is left without a neighbour.
- **Water.** Census VTD polygons include water, so a boundary through a bay or lake counts like any other shared boundary. No Texas authority on contiguity across water was found.
- **What the tool does while drawing.**
  - ReCom splits keep districts connected.
  - Population polishing makes a flip only if the source district stays connected.
  - The worker graph has one node per VTD piece. The pieces of one VTD are glued: they must share a district, and each break adds a structural violation.
  - The statewide unit graph is a single connected component, so the page adds no synthetic bridge edges on this layer.
- **What the tool checks after each run.**
  - The `contiguity` check tests every district. The panel tags it `binding` for the House and Senate and `practice` for the U.S. House. Strictly, for the House only county-group contiguity is constitutional text.
  - The validator normally uses only geographic adjacency, but it has one non-geographic fallback. A piece with no neighbour is treated as "joined to its own unit by water", and the check's message then counts such island pieces. This fallback is inactive on this layer, because no piece is without a neighbour.
- **County adjacency.**
  - Two counties are adjacent when some of their units are adjacent under the rule above. There are 661 such county pairs (computed).
  - The review reported about 63 more county pairs that touch only at a point, mostly at Panhandle grid corners. That figure came from a different test: the counties share a vertex but no topology arc. The shipped adjacency also drops arcs shorter than 1 metre, so the true number of point-only pairs under the tool's definition may be higher. No code in the repository computes county-level point-only pairs; the build logs only a unit-level count (`pointOnlyPairsDropped`). Treat 63 as unverified.
  - The county line rule treats point-only pairs as not adjacent.

### 1.4 VTD splitting and Tex. Elec. Code sec. 42.005

- **What the law says.**
  - No law requires districts to follow VTD lines.
  - Perry v. Perez (2012) faulted a court for refusing to split VTDs and noted that Texas' enacted plan "freely splits precincts" (verified).
  - Texas requires county election precincts to nest within districts. The Bush v. Vera plurality refers to "Texas' requirement that voting be arranged by precinct, with each precinct representing a community that shares local, state, and federal representatives" (verified).
  - Perry v. Perez notes that "Texas law expressly allows recasting precincts when redistricting", citing Elec. Code sec. 42.032 (verified).
  - The researchers attribute the nesting rule to Tex. Elec. Code sec. 42.005, but its text could not be opened. **The wording, the list of district types and any exceptions in sec. 42.005 are unverified.**
  - The rule binds counties, not the lines the Legislature draws.
- **What the tool does.**
  - Every plan is built from whole 2020 VTDs, so no plan splits a 2020 VTD.
  - Counties have redrawn precincts since 2020, so this says nothing about current precincts.
  - Using whole VTDs is a design choice of the tool, not a legal rule. A limitation that comes only from using whole VTDs is never evidence that breaking another rule was legally necessary.

### 1.5 No Section 5 preclearance

Shelby County v. Holder (2013) held the coverage formula in sec. 4(b) of the Voting Rights Act unconstitutional: it "can no longer be used as a basis for subjecting jurisdictions to preclearance" (verified). Texas plans therefore need no preclearance and face no retrogression test. No order bringing Texas back under preclearance through sec. 3(c) was found. The tool implements no retrogression test, and any comparison with a benchmark plan is information only.

### 1.6 Judgment-only rules for every chamber

The tool cannot decide any of these. It never uses race as a districting criterion: the worker receives only population, county, partisan vote and adjacency. Racial make-up is reported (`vra-report`) and never used as a target.

- **VRA sec. 2 after Callais.**
  - Section 2 (52 U.S.C. 10301) still applies.
  - Under Louisiana v. Callais, Nos. 24-109 and 24-110, 608 U.S. ___ (Apr. 29, 2026), sec. 2 "imposes liability only when the evidence supports a strong inference that the State intentionally drew its districts to afford minority voters less opportunity because of their race". The Court added that this reading "does not demand a finding of intentional discrimination" (verified).
  - The Gingles framework is kept in an updated form (verified):
    - illustrative maps "cannot use race as a districting criterion";
    - illustrative maps "must meet all the State's legitimate districting objectives", including political goals;
    - racially polarized voting must be shown with "an analysis that controls for party affiliation";
    - the totality inquiry looks at present-day intentional discrimination.
  - Compliance with sec. 2 "as properly construed" can still justify drawing lines by race, but only where sec. 2 actually requires the district (verified).
  - Section 2 does not require crossover districts below 50% (Bartlett v. Strickland, plurality; verified).
- **One group must form the majority (Petteway).**
  - The Fifth Circuit covers Texas. There, sec. 2 "does not authorize separately protected minority groups to aggregate their populations for purposes of a vote dilution claim" (Petteway v. Galveston County, 111 F.4th 596 (5th Cir. 2024) (en banc)). The holding is quoted verbatim in a secondary source; the official opinion was not opened.
  - So in Texas, a Black-plus-Hispanic coalition majority is not a basis for a sec. 2 claim.
- **Citizenship.**
  - For Latino voters, courts measure majority status in citizen voting-age population. LULAC v. Perry (2006), on Texas CD 23: Latinos were "a bare majority of the voting-age population ... but only in a hollow sense" (verified).
  - **This data does not include citizen voting-age population (HCVAP).** The tool's Hispanic count is VAP of any race, which overstates Latino electoral strength.
  - The tool's Black and Asian counts are non-Hispanic, single-race VAP. TLC counts Black more broadly, including Hispanic Black, so the tool's numbers will not match TLC reports.
- **Racial predominance.**
  - Strict scrutiny applies if race was "the predominant factor motivating the legislature's decision to place a significant number of voters within or without a particular district" (Miller v. Johnson; verified).
  - An announced racial target that overrides other criteria is significant evidence (Cooper v. Harris; verified).
  - Texas examples: HD90 of the 2013 House plan (Abbott v. Perez, 2018) and CDs 18, 29 and 30 of the 1991 plan (Bush v. Vera).
  - Courts "start with a presumption that the legislature acted in good faith" (Alexander v. S.C. State Conference of the NAACP, 2024; verified).
  - A plaintiff who offers no alternative map faces a "dispositive or near-dispositive adverse inference". Callais attributes this to Abbott v. LULAC, on Texas's 2025 congressional map (verified only through Callais's citation). Two rulings in that case are recorded: a stay of Dec. 4, 2025 (docket copy), and a reported summary reversal of Apr. 27, 2026 (secondary source only). Which of them contains the quoted language was not confirmed, and neither opinion was opened.
- **Intentional discrimination.** A plan drawn with a racially discriminatory purpose violates the Fourteenth and Fifteenth Amendments. This claim is separate from sec. 2 and from racial predominance. The challenger bears the burden, and the Legislature's good faith is presumed (Abbott v. Perez; verified).
- **Partisan gerrymandering.**
  - "Partisan gerrymandering claims present political questions beyond the reach of the federal courts" (Rucho v. Common Cause, 2019; verified).
  - Callais treats partisan advantage as "a constitutionally permissible criterion" (verified).
  - No Texas rule on partisan fairness was found. This is a negative finding, because the Texas statute site was blocked.
  - The tool's partisan metrics are optional objectives and reports, never checks.
- **Compactness.**
  - No Texas numeric compactness requirement was found for any chamber (a negative finding).
  - Compactness matters as evidence in racial predominance and Gingles analysis.
  - The tool reports cut edges and has no compactness check.

## 2. Texas House (150 seats)

### 2.1 Binding rules

**Tex. Const. art. III, sec. 26.** Verified: the full text is quoted in White v. Regester n.2, and the 1876 text has not been amended.

> The members of the House of Representatives shall be apportioned among the several counties, according to the number of population in each, as nearly as may be, on a ratio obtained by dividing the population of the State, as ascertained by the most recent United States census, by the number of members of which the House is composed; provided, that, whenever a single county has sufficient population to be entitled to a Representative, such county shall be formed into a separate Representative District, and when two or more counties are required to make up the ratio of representation, such counties shall be contiguous to each other; and when any one county has more than sufficient population to be entitled to one or more Representatives, such Representative or Representatives shall be apportioned to such county, and for any surplus of population it may be joined in a Representative District with any other contiguous county or counties.

**TLC's four-point restatement.** This is an excerpt of `redistricting.capitol.texas.gov/reqs`; the same wording appears verbatim in a secondary copy.
1. A county with enough population for exactly one district is one district.
2. A smaller county is kept whole and combined with contiguous counties.
3. A county with enough population for two or more whole districts is divided into that many, "with no district extending into another county".
4. A county with whole districts plus a fraction keeps the whole districts inside it. Its excess is added to contiguous counties to form one more district.

**Breaking the rule only when necessary.**
- The county line rule gives way to federal one person, one vote only as far as necessary.
- The 1965 Texas Attorney General construction was adopted by the district court and is reproduced in Kilgarlin v. Hill n.2 (verified). It says county lines "must be violated, but only to the extent necessary to carry out the mandate of the Supreme Court. In all other instances, county lines must remain intact".
- White v. Regester accepted county cuts where "to stay within tolerable population limits it was necessary to cut some county lines" (verified).
- Smith v. Craddick (Tex. 1971) and Clements v. Valles (Tex. 1981) struck House plans that cut county lines without showing necessity. These are excerpts only; the opinions were not opened.
- According to the same excerpts, the proponents of a plan must show the necessity (excerpt, unverified).

**No county cap.** Former sec. 26a capped each county at 7 representatives unless its population exceeded 700,000. It was repealed on Nov. 2, 1999 (verified in a copy of the amended constitution). The tool imposes no cap on the number of districts per county.

**Timing and process (not map geometry).**
- Sec. 28: the Legislature apportions House and Senate districts "at its first regular session after the publication of each United States decennial census". If it fails, the Legislative Redistricting Board does it (verified).
- PlanH2316 was enacted in 2021 (H.B. 1, 3rd called session) and ratified in the 2023 regular session (H.B. 1000) (excerpts).

### 2.2 Presumptive thresholds

- **Overall range under 10%.**
  - "Where the maximum population deviation between the largest and smallest district is less than 10%, the Court has held, a state or local legislative map presumptively complies with the one-person, one-vote rule. ... Maximum deviations above 10% are presumptively impermissible." (Evenwel; verified)
  - The maximum deviation is the sum of the percentage deviations of the largest and smallest districts (Evenwel n.2).
  - White v. Regester upheld a Texas House plan at 9.9%. Its districts ran from 71,597 to 78,943 people against an ideal of 74,645, that is, from −4.1% to +5.8% (verified).
  - Kilgarlin v. Hill rejected a Texas ratio of 1.31 to 1 that the county-line policy did not justify (verified).
- **Check `range` (presumptive).** It passes if 150 × 10 × (max − min) < 29,145,505, that is, if max − min is at most 19,430.
- **Not a safe harbor.**
  - A plan under 10% can still fail if challengers show it is more probable than not that the deviations reflect illegitimate factors. This comes from Harris v. Arizona Independent Redistricting Comm'n (2016), which describes the summary affirmance in Cox v. Larios (verified).
  - Such attacks "will succeed only rarely, in unusual cases".
  - This is a judgment question. The tool does not test for a pattern in the deviations.

### 2.3 Practice

- **The ±5% band (a design choice, not law).**
  - Every district must lie between ceil(0.95 × I) and floor(1.05 × I): **184,589 to 204,018** people (−4.9996% to +4.9997%). The edges use the exact ideal, so a district of 184,588 fails although it is within ±5% of TLC's rounded ideal (section 1.1).
  - The largest possible range is then 19,429 people (9.9993%), which is under 10%.
  - This matches the Legislature's practice. PlanH2316 reportedly runs from HD109 (184,600, −4.99%) to HD95 (203,993, +4.99%), a range of 19,393 people (9.98%) (excerpt, unverified).
  - No source states ±5% as a rule, and the Supreme Court accepted a district at +5.8% (White v. Regester).
  - The same band also decides each county's class under the county line rule (section 3). Linking the two is also a choice of the tool.
- **The strict option.**
  - The House controls offer a second standard. Its band is **185,421 to 204,851** people (−4.5714% to +5.4284%).
  - Its range is 19,430 people (9.9998%), still under 10%.
  - Its upper edge is exactly Kaufman plus Van Zandt (145,310 + 59,541 = 204,851). That is why this band lets every small county stay whole (section 3.4).
  - This band does **not** keep every county whole. Its 18 surplus counties, Bell included, are each still crossed by one district. The UI wording is therefore wrong: the option label "Strict county line: range under 10%, no county split" (`tx-page.js`, line 31) and the info text "This band keeps every county whole" (`tx-page.js`, line 158) should say that every *small* county is kept whole.
- **Check `band` (practice).** Every district must be within the band of the House standard selected when the plan is validated (section 3.5, step 5). **While drawing,** the worker's hard-constraint layer penalizes any district outside the same band. This is a penalty, not a guarantee.

### 2.4 Judgment only (House-specific)

- **Counties with a choice of seat count.**
  - At ±5%, Harris can hold 24 or 25 districts and Dallas 13 or 14 (computed).
  - Sec. 26's words "as nearly as may be" can be read to favour the count nearest P/I. The Legislature has not always followed that: Dallas has 13.45 ideal districts but 14 districts in PlanH2316. No court has decided the point.
  - Writing about the 2011 plan, a 2017 federal court said Harris's population "entitled it to 24.41 districts ... 24.41 is closer to 24 than 25" (excerpt).
  - Seat counts have been challenged as intentionally discriminatory.
  - The validator accepts any count in the feasible range. The `clr-k-choice` check (report only) names any county whose count differs from the nearest integer. What the generator can actually produce is narrower (section 6).
- **County line rule and VRA sec. 2.**
  - Federal law would win if sec. 2 actually required a county split.
  - Sec. 2 does not require breaking county lines to improve an existing minority district (Abbott v. Perez, on Nueces County HD32 and HD34; verified). After Callais this conflict is even less likely.
  - The tool never breaks the county line rule for a racial reason.
- **Racial predominance, intentional discrimination, VRA sec. 2, Rucho.** See section 1.6. The 2021 House plan was tried in LULAC v. Abbott (W.D. Tex., May to June 2025). No ruling was found (excerpt).

## 3. The county line rule as implemented

### 3.1 Definitions

- I = 29,145,505 / 150, kept exact.
- P_c = the total 2020 population of county c.
- Band [lo, hi]: 184,589 to 204,018 (default) or 185,421 to 204,851 (strict).
- C(d) = the counties in district d.
- Dist(c) = the districts that touch county c.
- W(c) = the districts lying wholly inside county c.
- X(c) = the districts that touch county c and also contain another county (crossing districts).

### 3.2 County classes (`TX.classifyCounty`)

1. Compute seatRange(P) = [max(1, ceil(P/hi)), floor(P/lo)].
2. If that range is not empty, the county is **self-contained** ("whole" in the code). If the range is exactly {1}, the county is **one-district** instead.
3. Otherwise, the county is **surplus** if P > hi, and **small** if not.
4. For a surplus county, n_c = floor(P_c / I), using the exact ideal.

Classes from the 2020 data (computed):

| Class | Default band (184,589 to 204,018) | Strict band (185,421 to 204,851) |
| --- | --- | --- |
| One-district | Ellis (192,455) | Ellis |
| Self-contained (allowed seat counts) | Harris 4,731,145 (24 or 25); Dallas 2,613,539 (13 or 14); Tarrant 2,110,640 (11); Bexar 2,009,324 (10); Williamson 609,017 (3); Brazoria 372,031 (2); Bell 370,647 (2) | the same, except Bell |
| Surplus (districts inside) | Travis 1,290,188 (6); Collin 1,064,465 (5); Denton 906,422 (4); Hidalgo 870,781 (4); El Paso 865,657 (4); Fort Bend 822,779 (4); Montgomery 620,443 (3); Cameron 421,017 (2); Nueces 353,178 (1); Galveston 350,682 (1); Lubbock 310,639 (1); Webb 267,114 (1); McLennan 260,579 (1); Jefferson 256,526 (1); Hays 241,067 (1); Brazos 233,849 (1); Smith 233,479 (1): 17 counties | the same 17, plus Bell (1): 18 counties |
| Small | 229 counties | 229 counties |

Bell changes class between the two bands. Its two districts would average 185,323.5 people (−4.62%), which is inside ±5% but below the strict band's lower edge. Travis is a boundary case at ±5%: seven districts would average −5.14%, so it is surplus.

### 3.3 Checks run after every House plan (`TX.validate`, all at panel level binding)

| Check | Passes when |
| --- | --- |
| `clr-small` | every small county has \|Dist(c)\| = 1, except under the exception below |
| `clr-one` | a one-district county is exactly one district, with nothing added |
| `clr-self` | a self-contained county has no crossing district, and \|W(c)\| is within its seat range |
| `clr-surplus` | a surplus county has \|W(c)\| = n_c and \|X(c)\| = 1 |
| `clr-composition` | every county in a multi-county district is either a whole small county (or a split one under the exception) or a surplus county whose single crossing district is this one; one-district and self-contained counties never appear |

**Small-county exception.**
- The House library file records a minimum number of small-county splits as `minSmallSplits`: 1 for the ±5% band and 0 for the strict band.
- The validator accepts at most that many small-county splits statewide, each into exactly two districts.
- **What supports the figure of 1 at ±5%.** The proof that at least one split is needed is the hand argument about Kaufman County (section 3.4), not the solver. The solver only shows that one split is enough within its own model.
- **What the solver does and does not prove.** Stage 1 of `house_clusters.py` minimizes splits in a restricted model:
  - each surplus county reaches its partners through one entry county;
  - no crossing district is made only of surplus remainders;
  - candidate groups are pruned by `pop_reach` with a cap of 2 × hi;
  - the solve has a 120-second limit, and a FEASIBLE result is accepted as well as an OPTIMAL one.
  So its result is a minimum within that model, and it is proved optimal only if the solver status was OPTIMAL. It is not a minimum over all lawful plans. For 0 in the strict band, no proof is needed, because the library contains plans with no small-county split.
- The validator does not check which small county is split. At ±5%, however, any passing plan must split Kaufman or one of its neighbours, because Kaufman cannot be placed otherwise (section 3.4).
- **Legal caveat.** The panel shows `clr-small` as a binding PASS for a ±5% plan with one split. Under the review's reading of Clements (section 7.2), that split may not be legally necessary, because the strict band shows a plan with every small county whole and a range under 10% exists. A PASS on `clr-small` means only that the plan meets the tool's ±5% standard.

**Two surplus remainders in one district.**
- The validator allows one district to join the remainders of two surplus counties, because each county is still crossed only once. PlanH2316's HD35, which joins parts of Hidalgo and Cameron, is an example.
- Sec. 26 speaks of a surplus joined with "any other contiguous county or counties". Whether that includes another county's remainder is unresolved.
- The number of such districts is computed (`stats.multiSurplusDistricts`) but is not shown as a check.

**Not checked.**
- Whether a surplus county's part of its crossing district is one connected piece. The district as a whole must still be contiguous.
- Whether Harris's or Dallas's seat count is the nearest integer. This is reported only.

### 3.4 Why one small county must be split at ±5%

Proof (computed from 2020 data):
1. Kaufman County has 145,310 people, below the band's lower edge of 184,589.
2. Its neighbours are Dallas (self-contained), Ellis (one-district), Rockwall (107,819), Hunt (99,956), Henderson (82,150) and Van Zandt (59,541).
3. Dallas and Ellis cannot be joined with another county, and no surplus county touches Kaufman.
4. The smallest possible addition, Van Zandt, gives 204,851, which is 833 over 204,018. Every other neighbour gives more.
5. So Kaufman cannot be in any district made only of whole counties. At least one small county, Kaufman or a neighbour, must be split.

This argument is the lower bound. The CP-SAT solver's first stage finds clusterings with exactly one split at ±5% and none in the strict band, so one split is enough at ±5% (within the solver's model; section 3.3). The 21 default clusterings split Kaufman (9 clusterings), Hunt (5), Henderson (5) or Rockwall (2), each into exactly two districts. The enacted PlanH2316 splits Henderson.

A related computed fact: no band with a range under 10% keeps Bell self-contained and also lets Kaufman stay whole. Bell needs a lower edge of at most 185,323, and Kaufman needs an upper edge of at least 204,851. That is a range of 19,528 people (10.05%). Each band therefore trades one county-line outcome for another (section 7).

### 3.5 How House plans are drawn

1. **Clustering solver** (`house_clusters.py`, OR-Tools CP-SAT).
   - It partitions the 254 counties into clusters of three kinds:
     - each self-contained or one-district county on its own;
     - each surplus county together with the small counties its crossing district takes;
     - groups of small counties that form exactly one district.
   - Every district must be able to fit in the band, and the seats must total 150.
   - A surplus county's partner counties enter it through one adjacent small county, the entry county.
   - Each cluster must be connected through county adjacency, using a hop-distance model. Corner contact does not count.
   - A split small county belongs to exactly two clusters. Each cluster takes a whole-number share of its population, at least one person.
   - Candidate groups are pruned by `pop_reach` with a cap of 2 × hi. Each solve has a 120-second limit and accepts FEASIBLE as well as OPTIMAL results.
   - Stage 1 minimizes the number of split small counties within this model. Stage 2 finds varied clusterings at that minimum. Stage 2 does not cover every feasible seat count (section 6).
   - The model has no crossing district made only of surplus remainders and no district with two surplus remainders. So the library never contains a district like HD35.
2. **Seed plans** (`house_seed_plans.mjs`).
   - For each clustering, the page's own worker draws every multi-district cluster at VTD level under the hard constraints.
   - The whole plan is then run through `TX.validate`. A clustering whose seed fails any binding check is dropped.
   - The resulting libraries:
     - `house_clusters.json`: 21 clusterings, seed ranges 18,458 to 19,358 people;
     - `house_clusters_strict.json`: 11 clusterings, every small county whole (each surplus county still crossed once), seed ranges 19,333 to 19,423 people.
3. **Runs** (`tx-page.js`, `TX.houseJobs`).
   - A run picks a clustering (random or chosen), starts from its seed and optimizes each cluster in a worker.
   - Clusters that share a split county are drawn together as one job.
   - Within a job, each small county that must stay whole is contracted to one node, so it cannot be split. Surplus and split counties keep their individual VTDs.
   - Each surplus county may be crossed by at most 1 district, and a split small county by at most 2. These limits are penalties (step 4).
   - Self-contained counties are separate jobs, so no district can cross their line.
4. **Hard-constraint layer** (the worker code generated by `make_texas_page.py`).
   - The violation V is the sum of three parts:
     - for each district outside [lo, hi]: 1 + (people outside the band / ideal × 100);
     - 1,000 for each crossing beyond a county's limit;
     - 1,000 for each extra district that the pieces of a glued VTD touch.
   - Every score adds 10^9 × V. The code assumes the objective terms stay well under 10^7.
   - While 10^9 × V is far larger than both the objective and the temperature, no accepted move turns a lawful plan into an unlawful one. This is not unconditional:
     - The temperature field `in-temp` has `max="10000"`, but the page reads `+$('in-temp').value` without clamping it. A typed starting temperature of about 10^9 or more lets Metropolis or Threshold acceptance (`dE <= T`) accept a move that breaks the band or a crossing limit.
     - V is a penalty, not a feasibility test. A run that starts from a plan with V > 0 (every fresh Senate or U.S. House run) may never reach V = 0. `bestState` returns the plan with the lowest score, which can still have V > 0.
   - In both cases only the validator after the run catches the problem.
   - V is updated incrementally in ReCom steps and flips. `check_rules.mjs` asserts that the incremental value equals a full recomputation.
   - "Continue" and "Polish" start from the best plan found, not from the chain's last state. They are refused if the plan's district count differs from the chosen chamber.
5. **Validation.** The assembled 150-district plan is checked with the band and `minSmallSplits` of the House standard selected at validation time (`houseLibs[r.houseStd || houseStd()]`). A run remembers the standard it was drawn with. An imported or enacted House plan has none, so it is checked against whichever standard is selected now. If that library has not been fetched yet, the validator falls back to the ±5% band with no small-county split allowed. Every plan from the default library then fails `clr-small` until the library loads.

## 4. Texas Senate (31 seats)

### 4.1 Binding rules

- 31 members (art. III, sec. 2), in single-member districts of contiguous territory that together cover the whole state (sec. 25, amended Nov. 6, 2001) (verified).
- **No county line rule.**
  - Sec. 26 governs only House members.
  - The 1876 sec. 25 apportioned senators "according to the number of qualified electors" and said "no single county shall be entitled to more than one senator".
  - A search result attributes the holding that these provisions are invalid to Kilgarlin v. Martin (S.D. Tex. 1966). That case was not opened, and the review flagged the attribution as unverified and probably mis-sourced. The only verified source cited here on this history is Kilgarlin v. Hill.
  - The provisions were deleted by the amendment of Nov. 6, 2001. The deletion is verified in copies of the 1876 and amended texts. The amending resolution (H.J.R. 75, Proposition 12) was not opened.
  - The tool applies no county limit and no per-county cap on senators.
- Timing (sec. 28) and the rule that a new Senate is elected after every apportionment (sec. 3) do not constrain the map.
- PlanS2168 was passed as S.B. 4 in 2021 and re-adopted by S.B. 375 in 2023 (excerpts).

### 4.2 Presumptive threshold

- **Overall range under 10%** of the ideal of 940,177.58 (Brown v. Thomson; Evenwel; White v. Regester; verified).
  - Brown: disparities "larger than 10%" create "a prima facie case of discrimination, and therefore must be justified by the State" (verified).
  - Mahan v. Howell approved a range of about 16% to keep political subdivision lines intact, while warning that this "may well approach tolerable limits" (quoted in Evenwel; verified).
  - Texas places no county rule on the Senate that could supply such a justification.
- **Check `range` (presumptive).** It passes if max − min is at most 94,017.
  - 29,145,505 / 310 = 94,017.76 is not a whole number. So "under 10%" and "not more than 10%" give the same test.
  - Rejecting a plan at 10% or more is the tool's policy. Legally, such a plan is only presumptively invalid.
- The under-10% presumption can be rebutted (Harris v. AIRC; section 2.2).

### 4.3 Practice

- **Generation band.**
  - Senate runs penalize any district outside ±5%: **893,169 to 987,186** people. The worst-case range in that band is 94,017.
  - The band is only a device for drawing, and a penalty rather than a guarantee (section 3.5, step 4). The validator checks the overall range, not the band. A plan with one district outside ±5% passes if its range is under 10%.
  - No law sets a ±5% limit for individual districts.
- **County splits.**
  - Keeping counties whole is a traditional, optional principle for the Senate. The tool reports the number of split counties (`county-splits`).
  - Some counties must be split under any plan. With a range under 10%, no district can exceed about 1,034,194 people (the ideal plus 94,017). Harris, Dallas, Tarrant, Bexar, Travis and Collin all exceed that (computed). They also exceed 987,186, the top of the tool's own generation band.
- **Enacted plan fixture.**
  - PlanS2168 (S.B. 4, 2021): the largest district, SD30, has 965,445 people (+2.69%); the smallest, SD31, has 907,784 (−3.45%).
  - The range is 57,661 people, 6.1330% of the exact ideal. TLC reported it as 6.14% (House committee bill analysis of S.B. 4; excerpt).
  - The layer's VTD approximation of PlanS2168 reproduces both extremes and the 57,661 range exactly, which corroborates the excerpt. `check_rules.mjs` asserts only the range; the two extremes were checked by hand.

### 4.4 Judgment only

- VRA sec. 2, Petteway, citizenship, racial predominance and partisan fairness: see section 1.6.
- Intentional discrimination: SD10 in Tarrant County has been the subject of intent claims in LULAC v. Abbott. The outcome of the 2025 trial was not found.
- Court-drawn plans:
  - A plan drawn by a court must reach "little more than de minimis variation" unless there is persuasive justification (Connor v. Finch, quoting Chapman v. Meier; verified).
  - An interim court plan should start from the enacted plan (Perry v. Perez; verified).
  - These standards do not bind the Legislature, and the tool does not model them.

## 5. U.S. House (38 seats)

### 5.1 Binding rules

- **38 single-member districts established by law** (2 U.S.C. 2c; Art. I, sec. 4) (verified). The Legislative Redistricting Board has no role for Congress: sec. 28 covers only senatorial and representative districts (verified).
- **Equal population as nearly as practicable** (Art. I, sec. 2).
  - The State must make "a good-faith effort to achieve precise mathematical equality" (Kirkpatrick v. Preisler; verified).
  - "There are no de minimis population variations, which could practicably be avoided, but which nonetheless meet the standard of Art. I, §2, without justification" (Karcher v. Daggett; verified).
  - The 10% rule for state legislatures does not apply. White v. Weiser struck down a Texas plan with a 4.13% range (verified).
- **The tool's test: a range of at most 1 person.**
  - 29,145,505 = 38 × 766,986 + 37, so the most equal plan has 37 districts of 766,987 and one of 766,986 (computed).
  - A range above 1 is not automatically unconstitutional. The State may justify each variance with a consistently applied, nondiscriminatory policy (Karcher; Tennant v. Jefferson County upheld 0.79%) (verified).
  - The tool cannot supply such a justification, so `equal-pop` (binding) passes only at a range of at most 1.
- **Enacted plans.**
  - PlanC2193 (2021) has 37 districts of 766,987 and CD16 at 766,986. Source: the Census 118th Congress P2 table, in a secondary copy of data.census.gov (verified).
  - TLC's Red-100T for PlanC2333 (H.B. 4, 2025; the plan for the 2026 elections) shows an ideal of 766,987 and a smallest district of 766,986 (verified copy).
  - The layer's `CD` field holds PlanC2193, not PlanC2333.
- **No Texas rule.**
  - Secs. 25 and 26 do not apply to Congress. Counties may be split as often as needed, and the tool only reports split counties.
  - Each county must touch at least ceil(P_c / 766,987) districts: Harris 7, Dallas 4, Tarrant 3, Bexar 3, and 2 each for Travis, Collin, Denton, Hidalgo, El Paso and Fort Bend (computed).
- **Mid-decade redistricting** of Congress is not prohibited by federal law. This comes from LULAC v. Perry, in a part of Justice Kennedy's opinion that no majority joined, so it is persuasive rather than binding (verified). Texas redrew mid-decade in 2003 and 2025.

### 5.2 What the tool enforces, and why its plans fail `equal-pop`

- Congressional runs treat a per-district tolerance you set as a hard constraint, enforced by penalty (section 3.5, step 4). The limits round outward: floor(I × (1 − t)) to ceil(I × (1 + t)). At the default t = 0.5% that is 763,152 to 770,822 people, or −0.500005% to +0.500003%, so the band is very slightly wider than ±0.5%.
- An optional population-polishing step then flips single VTDs, keeping districts connected.
- Whole 2020 VTDs hold up to 25,582 people, and the tool has no census block data. So its plans end with ranges of thousands of people, not 1, and the panel says so.
- The Legislature reaches a range of 1 by drawing on census blocks and splitting VTDs.
- It has not been proven that no exact whole-VTD plan exists, but the tool does not find one.

### 5.3 Practice and judgment

- Contiguity is enforced and checked as practice (section 1.3).
- No rule on compactness, incumbents, keeping district cores or municipal lines applies.
- A Representative need only be an inhabitant of Texas (Art. I, sec. 2).
- VRA, Petteway, racial predominance, intent and Rucho: see section 1.6. Bush v. Vera struck Texas CDs 18, 29 and 30.

## 6. What the tool cannot do

- **Reach the congressional standard.** A range of 1 needs census blocks, which this data does not have. Every U.S. House plan the tool generates fails `equal-pop`.
- **Guarantee the drawing constraints.** Bands, tolerances and crossing limits are penalties. A run can end outside them (section 3.5, step 4), and only the validator catches that.
- **Reproduce the enacted plans exactly.**
  - The enacted plans were drawn on census blocks. The layer's `HD`, `SD` and `CD` fields carry PlanH2316, PlanS2168 and PlanC2193 onto whole VTDs by an interior point. Their populations are therefore approximate, and some districts appear non-contiguous.
  - Computed on this layer:
    - PlanH2316: district populations run from 172,162 to 239,391 (a 34.6% range), and 15 districts are non-contiguous at VTD level;
    - PlanS2168: matches its official range exactly, but 3 districts appear non-contiguous;
    - PlanC2193: shows a range of 37,742 people and 7 non-contiguous districts.
  - Use these plans only as fixtures for county structure. A county split made only inside a split VTD would not show.
- **Decide any judgment rule.** VRA sec. 2, racial predominance, intentional discrimination and a Larios-type pattern of deviations depend on evidence and intent. The tool reports VAP shares only.
- **Measure citizenship.** HCVAP, the measure Texas courts use for Latino majorities, is not in the data.
- **Explore every lawful House configuration.**
  - House runs start from one of 21 (default) or 11 (strict) solver clusterings and keep that clustering's county structure.
  - They never produce a district joining two surplus remainders.
  - The Harris and Dallas seat counts are whatever the clustering fixed, and Stage 2 does not cover every feasible count. All 11 strict clusterings give Dallas 14 districts, although 13 is feasible in that band, so the strict library cannot produce Dallas at 13. In the default library, 15 clusterings give Dallas 13 and 6 give it 14.
- **Prove necessity beyond its own model.** The proof that one small-county split is needed holds at ±5% on whole counties, and rests on the Kaufman argument. The solver's minimum is a minimum within its restricted model (section 3.3). Neither shows the split is necessary under every lawful band (the strict band needs none), or under the review's stricter standard (section 7).
- **Measure adjacency exactly.** Boundary lengths near the 1 metre threshold are approximate because of the quantized topology and the fixed longitude factor (section 1.3).
- **Check current precincts or Election Code compliance.** Plans nest in 2020 VTDs, not in today's precincts.
- **Certify a plan.** A plan that passes every check has met only the rules that can be computed.

### Regression checks

Run `node texas/tools/check_rules.mjs`. It asserts:
- 9,007 distinct census VTDs, total population 29,145,505, VAP 21,866,700 and 254 counties;
- an adjacency list of the right length (one entry per unit; it does not test that every unit has a neighbour), and no VTD piece without a neighbour;
- every seed plan in both House libraries passes every non-report check (binding, presumptive and practice);
- PlanS2168's range is 57,661 (the two extremes are not asserted);
- PlanH2316's exceptions are exactly Henderson (split into 2) and Cameron (1 district inside, 2 crossing), and PlanH2316 keeps every self-contained county whole;
- the first 8 multi-seat House cluster jobs of clustering 0 (16 runs), and a Senate plan, stay lawful under hostile weights at temperature 5,000;
- the incremental violation equals a full recomputation;
- "continue" with the wrong district count is refused.

It does not cover U.S. House runs, the congressional tolerance path or the `equal-pop` check.

### Data reconciliation (from `texas/README.md` and the build)

- 8,989 units carry all 9,007 census VTDs from 2020.
  - Geometry is TLC's 2020 VTD layer, via t0lg-a/test_tx04.
  - Population and demographics come from alarm-redist/census-2020 (`tx_2020_vtd.csv`).
- How the two sources were matched:
  - 8,843 VTDs match one to one.
  - 145 census VTDs that are split into A/B parts in the TLC layer are merged back.
  - 12 tiny Brazos VTDs (63 people) are carried together by one unit (0410103).
  - 7 census VTDs that TLC folded into neighbours (75 people) are attached to the nearest-numbered VTD in their own county. Where these land inside the county is the only uncertainty in any unit's population.
  - Two precincts created after the census (Dallas 4650 and Harris 0922) are merged into a neighbour as geometry only.
- 236 census VTDs (224 units) have zero population. They must still be assigned and connected. The largest unit has 25,582 people.
- The build fails unless every census VTD is in exactly one unit and the total is exactly 29,145,505.

## 7. Unresolved questions

1. **The ±5% band or the strict band.**
   - No Texas court has said which population band decides "sufficient population" under sec. 26.
   - At ±5% (the Legislature's practice), one small county must be split, and Bell is self-contained with 2 districts.
   - In the strict band (185,421 to 204,851, range 9.9998%), every small county stays whole, but Bell becomes a surplus county cut once. The 17 other surplus counties are also each cut once, as in the ±5% band.
   - No band with a range under 10% avoids both outcomes (section 3.4). The tool offers both bands and does not choose between them.
   - Other lawful bands would change other classes. For example, Travis at 7 districts is at −5.14%.
2. **What "necessary" means.**
   - The review reads Clements (as excerpted) as comparing alternatives "less than the 9.9 percent approved in White v. Regester".
   - On that reading, a county-line break is necessary only if no compliant plan exists with a range under 10%, for any band, at the finest geography the Legislature uses. The strict band shows that a plan with every small county whole and a range under 10% exists. So the ±5% small-county split may not be necessary.
   - The tool's ±5% standard instead treats the split as necessary within its own band, and the panel shows `clr-small` as a binding PASS for such a plan (section 3.3).
3. **Cutting a surplus county only once.**
   - The rule that a surplus remainder goes to exactly one district rests on the text ("a Representative District", singular) and on Clements (excerpt).
   - The only challenge to PlanH2316 on this point, over Cameron County, was sent back on jurisdictional grounds by the Texas Supreme Court in No. 22-0008 (2022). It was reportedly dismissed for want of prosecution on Nov. 26, 2025 (excerpt).
   - No court has ruled on the merits. The tool enforces the single cut.
4. **Two surplus remainders in one district** (like HD35). The validator allows it, the generator never produces it, and its legality is unresolved.
5. **A one-district county below the ideal.** Ellis (192,455, −0.95%) could in principle be joined with a tiny county and still be in the band. The tool requires Ellis to stand alone, which satisfies either reading.
6. **Point contiguity.** There is no Texas authority, and TLC's "more than a point" wording is unverified. The tool treats county pairs that meet only at a corner as not adjacent. The review's count of about 63 such pairs used a different test and is not reproduced by the repository (section 1.3).
7. **Contiguity across water.** There is no Texas authority. The tool counts shared VTD boundaries that run through water, and it resolved two enclave pieces geometrically.
8. **HCVAP and race definitions.** Citizen VAP is not in the data. TLC's definitions of Black and B+H differ from the census categories the tool reports.
9. **Tex. Elec. Code sec. 42.005.** The statute text was not opened, and its exact terms are unverified.
10. **Mid-decade redistricting of the Legislature** under sec. 28. No source reviewed decides it.
11. **Litigation.**
    - No ruling was found in LULAC v. Abbott on the 2021 House and Senate plans (tried May to June 2025).
    - Later proceedings on the 2025 congressional plan are not covered here, beyond the Abbott v. LULAC rulings noted in section 1.6.
    - No Texas redraw after Callais was found through September 2026 (secondary source).
12. **Blocked or unopened primary sources.** Check these against the originals before quoting them in the UI:
    - TLC's Legal Requirements page and glossary;
    - Smith v. Craddick, Clements v. Valles and No. 22-0008;
    - Kilgarlin v. Martin (S.D. Tex. 1966) and H.J.R. 75 (2001, Proposition 12);
    - the Abbott v. LULAC stay (Dec. 4, 2025) and reported summary reversal (Apr. 27, 2026);
    - the official Petteway opinion;
    - Elec. Code sec. 42.005;
    - the Red-100 reports for PlanH2316 and PlanS2168.

## 8. Sources

Texas Constitution and statutes

- Tex. Const. art. III (current text, secs. 2, 3, 25, 28), copy: https://raw.githubusercontent.com/sadrayan/fake-news-expreiment/HEAD/fak/gcloud/data/train_articles/92291.txt (verified)
- Tex. Const. as amended (sec. 25 amended 2001; sec. 26a repealed 1999): https://raw.githubusercontent.com/mbaker21231/constitutions/HEAD/TX%25201876_amd_final_parts_0.txt (verified)
- Tex. Const. 1876 original text (secs. 25, 26): https://raw.githubusercontent.com/mbaker21231/constitutions/HEAD/TX%25201876_final_parts_0.txt (verified)
- Texas Constitution dataset: https://raw.githubusercontent.com/TheAugDev/BPOC/HEAD/data/texasConstitutions.json (verified)
- Official text: https://tcss.legis.texas.gov/docs/CN/htm/CN.3.htm (blocked)
- H.J.R. 75 (2001), Proposition 12, amending sec. 25 (not opened)
- Tex. Elec. Code sec. 42.005: https://law.justia.com/codes/texas/election-code/title-4/chapter-42/subchapter-a/section-42-005/ (not opened)

Federal constitution and statutes

- U.S. Const. art. I, secs. 2 and 4, plain-text copy: https://raw.githubusercontent.com/amueller/word_cloud/HEAD/examples/constitution.txt (verified)
- 2 U.S.C. 2c: https://raw.githubusercontent.com/TheJoshuaEvans/united-states-code/HEAD/usc/2/2c.txt (verified)
- 52 U.S.C. 10301: https://raw.githubusercontent.com/TheJoshuaEvans/united-states-code/HEAD/usc/52/10301.txt (verified)

U.S. Supreme Court

- Louisiana v. Callais, Nos. 24-109 and 24-110, 608 U.S. ___ (Apr. 29, 2026): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/HEAD/courts/ussc/opinions/xml/us608/us608-24-109.xml (verified, slip opinion copy)
- Abbott v. LULAC, No. 25A608. Stay of Dec. 4, 2025 (docket copy): https://raw.githubusercontent.com/jeffpar/argument-aloud/HEAD/courts/ussc/terms/2025-10/cases/25A608/files.json. A summary reversal of Apr. 27, 2026 is reported on the Loyola case page (secondary; see "Case status pages" below). Neither opinion was opened. The "adverse inference" language is known only through Callais's citation, and which ruling it comes from was not confirmed.
- Alexander v. S.C. State Conference of the NAACP, 602 U.S. 1 (2024): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/HEAD/courts/ussc/opinions/xml/us602/us602-22-807.xml
- Rucho v. Common Cause, 588 U.S. 684 (2019): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/HEAD/courts/ussc/opinions/xml/us588/us588-18-422.xml
- Abbott v. Perez, 585 U.S. 579 (2018): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/17-586%20Abbott%20v.%20PerezOpinionAlito.txt
- Cooper v. Harris, 581 U.S. 285 (2017): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/HEAD/courts/ussc/opinions/xml/us581/us581-15-1262.xml
- Evenwel v. Abbott, 578 U.S. 54 (2016): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/HEAD/courts/ussc/opinions/xml/us578/us578-14-940.xml
- Harris v. Arizona Independent Redistricting Comm'n, 578 U.S. 253 (2016): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/HEAD/courts/ussc/opinions/xml/us578/us578-14-232.xml
- Shelby County v. Holder, 570 U.S. 529 (2013): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/570%20U.S.%20529%20Shelby%20County%20v.%20HoOpinionRoberts.txt
- Tennant v. Jefferson County Comm'n, 567 U.S. 758 (2012): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/567%20U.S.%20758%20Tennant%20v.%20Jefferso.txt
- Perry v. Perez, 565 U.S. 388 (2012): https://raw.githubusercontent.com/ameliaohalloran7/privacy-caselaw/HEAD/Intermediate_files/US_downloads/1425US_original.txt
- Bartlett v. Strickland, 556 U.S. 1 (2009): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/556%20U.S.%201%20Bartlett%20v.%20StricklOpinionKennedy.txt
- LULAC v. Perry, 548 U.S. 399 (2006): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/548%20U.S.%20399%20League%20of%20United%20LaOpinionKennedy.txt
- Bush v. Vera, 517 U.S. 952 (1996): https://raw.githubusercontent.com/jeffpar/lonedissent/master/sources/loc/volumes/text/501-600/517/517us952.txt
- Miller v. Johnson, 515 U.S. 900 (1995): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/515%20U.S.%20900%20Miller%20v.%20Johnson.txt
- Shaw v. Reno, 509 U.S. 630 (1993): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/509%20U.S.%20630%20Shaw%20v.%20Reno.txt
- Thornburg v. Gingles, 478 U.S. 30 (1986): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/478%20U.S.%2030%20Thornburg%20v.%20Gingle.txt
- Karcher v. Daggett, 462 U.S. 725 (1983): https://raw.githubusercontent.com/jeffpar/lonedissent/master/sources/loc/volumes/text/401-500/462/462us725.txt
- Brown v. Thomson, 462 U.S. 835 (1983): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/main/courts/ussc/opinions/xml/us462/us462-0835.xml
- Connor v. Finch, 431 U.S. 407 (1977): https://raw.githubusercontent.com/jeffpar/argument-aloud-xml/main/courts/ussc/opinions/xml/us431/us431-0407.xml
- White v. Regester, 412 U.S. 755 (1973) (quotes Tex. Const. art. III, sec. 26 in n.2): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/412%20U.S.%20755%20White%20v.%20Regester.txt
- White v. Weiser, 412 U.S. 783 (1973): https://raw.githubusercontent.com/jeffpar/lonedissent/master/sources/loc/volumes/text/401-500/412/412us783.txt
- Kirkpatrick v. Preisler, 394 U.S. 526 (1969): https://raw.githubusercontent.com/jeffpar/lonedissent/master/sources/loc/volumes/text/301-400/394/394us526.txt
- Kilgarlin v. Hill, 386 U.S. 120 (1967) (1965 Attorney General construction in n.2): https://raw.githubusercontent.com/Dysania22/AI_Project/HEAD/Supreme-Court-Database/data/386%20U.S.%20120%20Kilgarlin%20v.%20Hill.txt
- Wesberry v. Sanders, 376 U.S. 1 (1964): https://raw.githubusercontent.com/jeffpar/lonedissent/master/sources/loc/volumes/text/301-400/376/376us001.txt
- Wood v. Broom, 287 U.S. 1 (1932): https://raw.githubusercontent.com/jeffpar/lonedissent/master/sources/loc/volumes/text/201-300/287/287us001.txt

Other courts

- Petteway v. Galveston County, 111 F.4th 596 (5th Cir. 2024) (en banc): https://www.ca5.uscourts.gov/opinions/pub/23/23-40582-CV2.pdf (not opened). The holding is quoted in https://raw.githubusercontent.com/textbrowser/spot-on-shared-pages/HEAD/li/https%253A%252F%252Flithub.com%252Fhow-gerrymandering-helps-republicans-maintain-power-in-texas-and-georgia%252F (secondary)
- Kilgarlin v. Martin (S.D. Tex. 1966): named in a search result as holding the 1876 Senate provisions invalid (not opened; attribution unverified)
- Abbott v. Mexican American Legislative Caucus, No. 22-0008 (Tex. June 24, 2022): https://www.txcourts.gov/media/1454472/220008.pdf (excerpt). Disposition summary: https://raw.githubusercontent.com/uchicago-capp-30320/JudgementCall/HEAD/data/cases/Texas.csv (secondary)
- Clements v. Valles, 620 S.W.2d 112 (Tex. 1981): https://www.courtlistener.com/opinion/2425631/clements-v-valles/ (excerpt)
- Smith v. Craddick, 471 S.W.2d 375 (Tex. 1971): https://www.courtlistener.com/opinion/1533648/smith-v-craddick/ (excerpt)
- Perez v. Abbott (W.D. Tex. Apr. 20, 2017), House findings: https://redistricting.capitol.texas.gov/pdf/news_announcements/Perez_house_opinion_4_20_2017.pdf (excerpt)
- Case status pages: https://redistricting.lls.edu/case/lulac-v-abbott/ and https://redistricting.lls.edu/case/gutierrez-v-texas/ (excerpts)

Texas Legislative Council and plan reports

- Legal Requirements: https://redistricting.capitol.texas.gov/reqs (excerpt). The four-point county line text is in a secondary copy: https://raw.githubusercontent.com/bedwards/hex-index/HEAD/library/wacocantwait/texas-redistricting-in-review.md
- Glossary: https://redistricting.capitol.texas.gov/glossary (excerpt)
- S.B. 4 (2021) House committee bill analysis (PlanS2168 extremes): https://capitol.texas.gov/tlodocs/873/analysis/html/SB00004H.htm (excerpt)
- PlanH2316 map report package: https://data.capitol.texas.gov/dataset/71af633c-21bf-42cf-ad48-4fe95593a897/resource/e8a63cb9-001b-4b1f-a7f8-9106cce80706/download/planh2316_map_report_package.pdf (excerpt)
- PlanC2333 Red-100T (Aug. 18, 2025), copy: https://raw.githubusercontent.com/texas-district-11-outpost/texas-district-11-outpost.github.io/main/plan-maps/PLANC2333/PLANC2333_r100.xls (verified)
- PlanC2193 Red-100T, copy: https://raw.githubusercontent.com/texas-district-11-outpost/texas-district-11-outpost.github.io/main/plan-maps/PLANC2193/PLANC2193r100.pdf (verified)
- Census 118th Congress P2 table (PlanC2193 district populations), secondary copy: https://raw.githubusercontent.com/Hackquantumcpp/snoutcounter-midterms-2026-model/HEAD/data/demo/urban_rural_pop/DECENNIALCD1182020.P2-Data.csv (verified)

Data

- 2020 VTD population, VAP and 2020 presidential vote: https://github.com/alarm-redist/census-2020 (`census-vest-2020/tx_2020_vtd.csv`)
- 2020 VTD geometry (TLC layer): https://github.com/t0lg-a/test_tx04 (`precincts_2020`)
- Repository files: `texas/tools/build_tx_census.mjs`, `texas/regions/tx_census2020.topo.json`, `texas/regions/house_clusters.json`, `texas/regions/house_clusters_strict.json`