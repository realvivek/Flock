# Fact-check ledger

Every figure the home story and the rebuilt pages rely on, with where it appears in its source and the date it was
last checked. Source ids refer to `src/content/sources.json`. Figures computed from data in this repository say
which file and script produce them.

Checked 8 October 2026 unless noted.

## Corrections made in this pass

| What the site said | What the record shows | Source |
|---|---|---|
| LAPD: 498 alerts, 161 wrong (32%), misread plates | 50,183 in-car alerts (5,911 unique plates) on 1 Aug–30 Sep 2025, mostly from non-Flock in-car readers; 161 were correct plate reads of cars no longer stolen; 337 vehicles recovered; 74 arrests from 68 stops; 4,575 with no action recorded. "498" was 161 + 337, not a count of alerts. | `lapd-oig-2026`, pp. 2 and 15–16 |
| Story County: Flock cameras; "every wrong hot-list hit" | The sheriff's office's "Erroneous hotlist hits" report from its Axon in-car readers, 214 rows from NCIC lists: 165 wrong state, 3 incorrect, 10 correct with no action, 29 no action, 7 dismissed. Its hits are where patrol cars were, so they are no longer matched to fixed cameras. | `footnote4a-hotlist` ("an overview of Axon data"); `data/outcomes/sources/story-rows.json` |
| Texas search: April 2025; "no warrant or case number" | Two searches on 9 May 2025: one week across 17,684 cameras in 1,295 networks, then a month across 83,345 cameras in 6,809 networks. Both logged "had an abortion, search for female" and the case number of the sheriff's death investigation. | `eff-texas-2025`; `404-texas-2025` |
| "Outside agencies ran 521 searches for every local one" | ALPR Watch counted 29.3 million network-audit rows (searches by anyone in the network that touched an agency's data) against 56,230 organisation-audit rows (the agency's own searches) across the logs it obtained. Rows, not distinct searches. | `alprwatch-foia-2025` |
| Oakland: "recoveries and arrests are the 425 outcomes" | 425 "success stories" logged in Flock's outcome feature; the report summarises all outcomes as 162 arrests, 174 vehicles and 51 guns recovered. Stolen-plate and stolen-vehicle notifications stayed switched off for lack of staff. | `oakland-pac-2026`, report pp. 2–4 and 11 |
| Roseville: 1,011 attributed to a page that only gives 71% | 1,011 of 1,427 stolen-vehicle and felony alerts in 2023–24 (71%) involved a misread plate; a lieutenant said none led to a contact or an arrest; Flock called the figure a mischaracterization and the deployment unusual. | `sacbee-roseville-2026` |
| "More than eighty jurisdictions have ended Flock contracts" | Finding Flock lists 45 verified decisions from Aug 2025 to Sep 2026: 23 cancelled, 11 not renewed, 6 paused, 4 deactivated, 1 rejected (updated 1 Oct 2026). Not exhaustive. | `findingflock-cancellations` |
| Columbia: 217 cases, six categories | 217 case outcomes; eight categories (69 cleared by arrest, 52 leads, 33 in progress, 31 unable to locate, 20 cleared otherwise, 7 no action, 3 warrants issued, 1 added to a hot list) sum to 216. | `columbia-mo-2025` |
| Outcomes coverage: 239 locations, 220 placed, 32 within 150 m | 74 records tied to fixed cameras, 55 placed, 21 within 150 m of a mapped camera on their own; 5 road-only records are placed at a camera on the named road by construction and no longer count as matches; Story County's 163 in-car hit locations are reported separately. | `scripts/outcomes/build.mjs` |
| Tucson: 12 places | 10 places; two intersections appeared with their street names in either order. | `tucson-cfs`; build script |
| Green Bay and the 140-day Nashville pilot: rates per million reads | No rates: the reads and alerts cover different time windows. | `greenbay-audit-2026`; `nashville-lpr-sampling-2023` |
| Mourtgos and Adams: finding only | The finding (vehicle theft −11%, theft arrests +15.9%; working paper, not peer reviewed; data from Flock) now sits beside the Institute for Justice critique (pre-existing trends; the drop appears only with weighting toward high-theft agencies; no significant change when averaged). | `mourtgos-adams-2026`; `reason-flock-study-2026` |

## Figures confirmed against primary or contemporaneous sources

| Figure | Value | Source | Where |
|---|---|---|---|
| Oakland 2025 reads | 638,747,333 | `oakland-pac-2026`, `oaklandside-2026` | report p. 2 |
| Oakland 2025 alerts | 1,099,837 (620,331 stolen plate) | `oakland-pac-2026` | report pp. 2–3 |
| Oakland 2025 cameras | 293 | `oaklandside-2026` | |
| National lookup opt-in | about 75% of law-enforcement customers (Flock to Congress, Aug 2025) | `wyden-ftc-2025` | letter p. 1 |
| Texas grant program | $1 per auto policy (2023 law); at least $30M; at least 3,200 cameras; governor's pause the night of 27 Aug 2026 | `texastribune-abbott-2026` | |
| Dallas | said it would switch off 321 of 684 cameras on 15 Sep 2026 | `govtech-dallas-2026` (Dallas Morning News) | |
| Florida DOT | memo of 31 Aug 2026 revoking permits in state highway rights of way; 30 days to remove; private cameras not covered | `wusf-fdot-2026` | |
| Greenville 2019 | 11 cameras for $2,000 a year in total; no install fee; asset forfeiture funds; 12-month term | `deflocksc-greenville` (city records release) | |
| Johnson City | 10-year agreement, $8,063,000, approved 17 Jul 2025, OMNIA cooperative contract | `johnsoncity-2025` | agenda summary p. 1 |
| El Paso | $702,500 state grant for about 150 cameras; use halted after 27 Aug 2026 | `elpasomatters-2026` | |
| Flock headquarters | Atlanta, Georgia | Wikipedia (Flock Safety) | infobox |
| Monthly scans | more than 20 billion (Flock's website, as reported Nov 2025) | `nbc-flock-2025` | |

## Figures computed in this repository

Produced by `scripts/story/build.mjs` from the inputs pinned in `data/story/manifest.json` (URL, size, SHA-256,
ETag and fetch time of each download; run `scripts/story/fetch.mjs` to fetch them again). The machine-readable copy
of every figure below, each with its source ids, is `public/data/story/stats.json`; `tests/data.spec.ts` checks that
the tables add up to it.

- **Camera data**: OpenStreetMap plate readers as served by DeFlock's hourly vector-tile archive
  (`deflock-tiles-2026`), read at zoom 9, where every point is kept with its tags. Snapshot: the latest edit in the
  archive, 8 October 2026. "Mapped" means tagged in OpenStreetMap by volunteers; it is not an official count
  (see the completeness table).
- **Population**: U.S. Census Bureau Vintage 2024 estimates (`census-pop-2024`), July 1, 2024.
- **Boundaries**: Census 2024 cartographic boundary files, counties and places, 1:500,000 (`census-boundaries-2024`).
  Connecticut uses its planning regions, as the Census Bureau now does.
- **Rates** use the 50 states and D.C.; Puerto Rico (126 Flock cameras, 3.9 per 100,000) appears in the tables only.

| Figure | Value | How |
|---|---|---|
| Mapped plate readers | 143,929 | every point in the archive's `cameras` layer (DeFlock's export of OpenStreetMap plate readers), de-duplicated by OSM id |
| Mapped Flock cameras | 115,437 | `brand` field equal to "Flock Safety" |
| Flock share | 80% of all mapped readers; 84% of those with a make tagged | 115,437 / 143,929; 115,437 / 137,214 |
| Other makes | Motorola Solutions 7,509; Genetec 3,647; Axis 2,445; Leonardo 1,259; Rekor 804; Axon 752; no make tagged 6,715 | `public/data/story/operators.json` |
| Never edited since first mapped | 76% | `osmVersion` equal to 1 |
| Flock cameras, U.S. | 115,249 (50 states and D.C.) | point in county polygon; 43 points within 1 km of a county assigned to the nearest, 20 outside every county |
| U.S. rate | 33.9 per 100,000 residents | 115,249 / 340,110,988 |
| Highest state rate | Georgia, 82.7 per 100,000 (9,251 cameras; 2.4 times the U.S. rate) | then Ohio 52.8, Texas 50.6, Indiana 49.1, Alabama 48.4 |
| Lowest state rates | New Hampshire 1.1, Alaska 2.6, Vermont 2.8, Maine 3.3, Hawaii 4.6 | |
| Most cameras | California 16,919; Texas 15,839 | |
| Counties with none mapped | 883 of 3,144 (home to 3.9% of residents) | 50 states and D.C. |
| Highest rate, counties of 1 million or more | Fulton County, Ga., 11.6 per 10,000 (1,269 cameras) | the story's zoom target, chosen by this rule |
| Most cameras, county | Harris County, Tex., 3,717 | |
| Flock cameras with an operator tagged | 16,500 (14%) | `operator` field present |
| Operator classes, among those tagged | police and sheriffs 10,222 (62%); retailers and shopping centres 3,237 (20%); Flock Safety listed 1,388; other government 645; unclear 466; business 234; residential 207; schools 101 | every name with 10 or more cameras classed by hand in `data/story/operator-classes.json`; smaller ones by keyword; all published in `operator-classes.csv` |
| Largest named operators | Lowe's 1,757; The Home Depot 1,154; California Highway Patrol 441 | spelling variants grouped (`canonical` in the class file) |

### Mapped against published counts

Flock cameras mapped inside each city's Census 2024 boundary, against the count the city or its reporting
published. Mapping includes cameras run by others inside city limits (the California Highway Patrol in Oakland,
retailers, homeowner groups), and published counts can be older than the map, so neither number is the other's
error; the table shows how far "mapped" can sit from an official figure.

| City | Mapped (police-tagged / other operator / untagged) | Published | Source |
|---|---|---|---|
| Oakland, Calif. | 518 (20 / 402 / 96); 380 of the "other" tagged to the CHP | 293 (2025 report) | `oaklandside-2026`, `oakland-pac-2026` |
| Denver | 139 (1 / 7 / 131) | 111 at about 70 sites (2024–25) | `denverite-2025` |
| Lexington, Ky. | 195 (60 / 16 / 119) | 125 (Dec. 2025) | `lexington-lpr-locations` |
| Berkeley, Calif. | 81 (41 / 6 / 34) | 52 (2025) | `berkeleyside-2025` |
| Piedmont, Calif. | 35 (0 / 34 / 1) | 48 (2025) | `piedmont-2025` |
| Lafayette, Colo. | 33 (1 / 0 / 32) | 30 (2024–25) | `lafayette-co-alpr` |
| Dallas | 919 (62 / 10 / 847) | 684 (Sept. 2026, before 321 were to be switched off) | `govtech-dallas-2026` |
| Houston | 2,266 (1 / 167 / 2,098) | 3,800 police and private (2024, per city officials) | `houstonchronicle-flock-2025` |

### Two camera snapshots

The story's map, counts and rates use the 8 October 2026 snapshot. The Outcomes page keeps the 17 July 2026
GeoJSON snapshot (116,723 readers; `data/story/raw/cameras-us-hourly-2026-07-17.geojson`, pinned in the manifest),
because its records were matched to the cameras mapped while they were made. Windsor, Conn., shows why: its 16
cameras were switched off in February 2026, the town council voted 5–4 on July 6 not to renew, and the cameras were
removed from OpenStreetMap on 8 October 2026 (changeset 190182036; `osm-windsor-2026`, `patch-windsor-2026`).
