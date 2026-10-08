# Fact-check ledger

Every figure the home story and the rebuilt pages rely on, with where it appears in its source and the date it was
last checked. Source ids refer to `src/content/sources.json`. Figures computed from data in this repository say
which file and script produce them.

Checked 8 October 2026 unless noted.

## The story, number by number

In reading order. "Computed" means produced by `scripts/story/build.mjs` from the pinned inputs described under
[Figures computed in this repository](#figures-computed-in-this-repository); the value and its source ids are also in
`public/data/story/stats.json`.

### Opening and map

| Claim | Figure | Source | Where |
|---|---|---|---|
| Volunteers have mapped more than 115,000 Flock cameras | 115,437 | computed | `mappedFlock` |
| Flock says its cameras make more than 20 billion scans a month | 20 billion | `nbc-flock-2025` | quotes Flock's website ("over 20 billion scans a month") |
| Flock is an Atlanta company | | `wikipedia-flock` | infobox; The Texas Tribune also writes "Atlanta-based Flock Safety" (`texastribune-2026`) |
| DeFlock is an anti-surveillance group that tracks the company's cameras | | `texastribune-2026` | "DeFlock, an anti-surveillance group monitoring the company"; EFF calls it an "anti-surveillance mapmaker" (`eff-deflock-2025`) |
| Each dot is a mapped reader; 143,929 as of Oct. 8, 2026 | 143,929 | computed | `mappedTotal`; 143,595 are inside the map's frame and 334 outside it, 255 of those in Puerto Rico (`meta.json`, `states.json`), as the map credit says |
| Flock made about four in five | 80 percent | computed | 115,437 / 143,929 |
| The rest come from companies including Motorola Solutions, Genetec and Axis Communications | 7,509; 3,647; 2,445 | computed | the three largest other makes, `operators.json` |
| Most common in the South, 41.3 for every 100,000 residents; least common in the Northeast, 11.6 | 41.3; 11.6 (Midwest 39.0, West 33.3) | computed | `regions`, Census regions |
| None mapped in 883 counties, home to about 4 percent of Americans; Iowa, South Dakota, Kentucky and Montana have the most such counties | 883 of 3,144; 3.9 percent; 64 of 99, 55 of 66, 51 of 120, 46 of 56 | computed | `countiesNone`; `countiesNoneTop` |
| Georgia has the most per resident: 82.7 per 100,000, 2.4 times the national rate | 82.7; 2.4 | computed | `topState`; 82.7 / 33.9 |
| Georgia is where Flock is based | | `wikipedia-flock` | infobox |
| Fulton County: 1,269 cameras, about 116 per 100,000, highest of any county with a million or more people | 1,269; 116.4 | computed | `topBigCounty` |
| Fulton County includes most of Atlanta | | `census-boundaries-2024` | the city's boundary lies in Fulton and DeKalb counties, mostly Fulton |

### What the map shows

| Claim | Figure | Source | Where |
|---|---|---|---|
| Oakland: 518 Flock cameras mapped inside the city line | 518 | computed | `completeness.json` |
| The Police Department reported 290 of its own | 290 | `oakland-pac-2026` | 2025 annual report, p. 7: "A total of 290 ALPR cameras were funded and deployed throughout the City of Oakland" |
| 380 of the mapped cameras are tagged as run by the California Highway Patrol | 380 | computed | `oaklandChp` |
| Published counts in the completeness chart | see the table under "Mapped against published counts" | | |

### Where the cameras are

| Claim | Figure | Source | Where |
|---|---|---|---|
| Flock says it operates in more than 6,000 communities in 49 states | 6,000; 49 | `wikipedia-flock` | attributed to Flock, July 2026 |
| 115,249 mapped Flock cameras in the 50 states and D.C., about 34 per 100,000 | 115,249; 33.9 | computed | `usFlock`, `usRate` |
| California and Texas have the most | 16,919; 15,839 | computed | `mostStates` |
| Per resident: Georgia, then Ohio, Texas, Indiana, Alabama | 82.7; 52.8; 50.6; 49.1; 48.4 | computed | `states.json` |
| New Hampshire has the fewest per resident: 16 cameras, 1.1 per 100,000 | 16; 1.1 | computed | `bottomStates` |
| The national total also counts 188 Flock cameras outside the states, most in Puerto Rico | 188 | computed | `outsideStates`; 126 of them in Puerto Rico |

### Who runs the cameras

| Claim | Figure | Source | Where |
|---|---|---|---|
| An operator is recorded for 16,500 mapped Flock cameras, 14 percent | 16,500; 14 percent | computed | `operatorsNamed` |
| Of those, 62 percent police or sheriffs, 20 percent retailers and shopping centers | 10,222; 3,237 | computed | `operatorsPolice`, `operatorsRetail` |
| Lowe's 1,767; The Home Depot 1,162 | | computed | `topOperators`, with spelling variants grouped (`canonical` in `data/story/operator-classes.json`) |
| Shareholder proposals asked both to report on privacy risks; both boards recommended voting no | | `prospect-retail-2026` | |

### What a camera records

| Claim | Figure | Source | Where |
|---|---|---|---|
| The cameras are set off by motion | | `flock-flex-datasheet` | "Motion: Passive Infrared Motion Detection"; the CEHRP teardown: "triggered by a motion detection sensor" (`cehrp-dissection`) |
| One takes six to 12 still photographs of the rear | 6 to 12 | `jalopnik-speed` | "shoot 6 to 12 or so pictures of a vehicle as it passes by" |
| Lit at night by an infrared array | 850 nm | `flock-flex-datasheet` | "Night vision: 850nm Custom IR Array" |
| Vehicle Fingerprint: make, type and color; roof racks, bumper stickers, decals; rear racks; missing or covered plates | | `flock-deck-2023` | slide "Vehicle Fingerprint Technology: Capture More Than License Plates"; the ACLU quotes the same list without decals and rear racks (`aclu-2022`, "Vehicle Fingerprint" passage) |
| The diagram's trailer hitch and aftermarket wheels | | `flock-wing-2020` | "unique features like aftermarket wheels, roof rack, a trailer hitch, and more" |
| The cameras also record dents | | `texastribune-unplugged-2026` | "make, model, paint color, dents and bumper stickers" |
| The camera adds the time, its GPS position and its identifier | | `flock-lpr-policy`; `cehrp-dissection` | policy's data elements; teardown's GPS module |
| Flock's policy says the plate and vehicle images are transferred to its servers | | `flock-lpr-policy` | "License plate image" and "Vehicle image" are "transferred to the AWS Government Cloud" |

### Where the picture goes

| Claim | Figure | Source | Where |
|---|---|---|---|
| Reads travel over a cellular connection to Flock's servers on Amazon Web Services | | `flock-arch-2024` | architecture summary |
| Hot lists: NCIC and NCMEC, per Flock's policy; Amber Alerts and custom lists, per the datasheet | | `flock-lpr-policy`; `flock-flex-datasheet` | the policy names NCIC, NCMEC "or other database or hot list"; the datasheet "NCIC, AMBER Alert & Custom" |
| An alert reaches officers in 10 to 15 seconds on average | 10–15 s | `flock-flex-datasheet` | "Notifications: Average of 10-15 seconds … Includes time, location, plate, and vehicle image" |
| The F.B.I.'s list reaches the cameras only twice a day; a removed plate can alert for up to 12 hours | twice; 12 hours | `aclu-2022` | "Accuracy problems": cameras "download fresh hit lists from the NCIC only twice a day … for up to 12 hours" |
| On Aug. 13, 2026, Flock made seven days its default for new customers, down from 30; existing customers keep theirs | 7; 30 | `flock-guardrails-2026` | "updating our recommendation and default to a 7-day retention … Existing customers will keep their current, democratically approved retention periods" |
| Virginia requires deletion after 21 days unless the data is needed for an investigation | 21 | `va-code-2-2-5517` | subsection E: "System data shall be purged after 21 days of the date of its capture" |
| Washington requires deletion after 21 days unless needed as evidence | 21 | `wa-sb6002-2026` | SB 6002, signed March 30, 2026 |
| California limits its Highway Patrol to 60 days | 60 | `ca-sb34` | Legislative Counsel's Digest, para. 1, summarizing existing law (Vehicle Code 2413) |
| Evidence Mode keeps data tied to an investigation with no published limit | | `aclu-guardrails` | |

### Who can search the reads

| Claim | Figure | Source | Where |
|---|---|---|---|
| About 75 percent of law enforcement customers had joined the national lookup, Flock told Congress in August 2025 | 75 percent | `wyden-ftc-2025` | letter p. 1: "Flock informed Congress this August that approximately 75% …" |
| May 9, 2025: a week of reads from 17,684 cameras in 1,295 networks, then a month from 83,345 cameras in 6,809 networks; both logged the same reason | | `eff-texas-2025` | EFF's reproduction of the audit log; 404 Media reported the second search (`404-texas-2025`) |
| The three accounts: the sheriff (to 404 Media), Flock, and the records | | `eff-texas-2025`; `404-texas-2025` | the sheriff's quotation as cited by EFF |
| In 12 million searches, about one in five gave a generic reason | 12 million; one in five | `eff-protesters-2025` | "approximately 20 percent" |

### What the reads produce

| Claim | Figure | Source | Where |
|---|---|---|---|
| Oakland's 290 Flock cameras | 290 | `oakland-pac-2026` | p. 7 |
| 638,747,333 plate reads in 2025, counting a plate each time it passed | 638,747,333 | `oakland-pac-2026` | p. 2: "the same license plate can be read multiple times a day" |
| 1,099,837 alerts, about one for every 580 reads | 1,099,837; 580.8 | `oakland-pac-2026` | pp. 2–3; ratio computed |
| 653,566 for stolen plates or stolen vehicles, kept switched off for lack of staff | 620,331 + 33,235 | `oakland-pac-2026` | pp. 3–4 |
| 425 success stories; the report totals their results twice: 162 arrests, 174 vehicles and 51 guns in its summary, 162, 25 and 50 in its table by offense | | `oakland-pac-2026` | p. 11, Figure F (summary) and p. 12, Table A; the figure shows both, and the report does not explain the difference |
| Outside agencies do not always report their results; the department cannot see their records | | `oakland-pac-2026` | p. 4 |
| Los Angeles: 210.6 million reads in two months from all the department's readers | 210,568,103 | `lapd-oig-2026` | p. 2 and p. 15 |
| In-car readers produced 50,183 alerts; 337 led to recovered stolen vehicles; 68 to stops with 74 arrests | | `lapd-oig-2026` | pp. 15–16; alerts from Axon in-car data only |
| Columbia, Mo.: 5,521 alerts; 69 cases cleared by arrest | | `columbia-mo-2025` | |
| Nashville: 443 verified hits, 25 stops, 22 recoveries, 18 arrests from 117 readers in eight weeks | | `nashville-lpr-2023` | |
| Ladder title: alerts run from hundreds to tens of thousands; arrests, in the dozens | 443; 5,521; 50,183 / 18; 69; 74 | the three rows above | Nashville, Columbia and Los Angeles |

### Whether the cameras reduce crime

| Claim | Figure | Source | Where |
|---|---|---|---|
| Flock says its technology supported about a million investigations in 2025, from a survey of about 700 agencies, "directional estimates rather than audited totals" | | `flock-impact-2026` | |
| Mourtgos and Adams, University of South Carolina; deployment records from Flock | | `mourtgos-adams-2026` | title page; Data section ("Flock Safety operational records provide daily counts of live camera locations by agency") |
| Flock says it did not fund the work | | `flock-study-2026` | |
| 216 adopting agencies, 3,108 that did not; adoption from 2019 to 2024, 168 agencies before the crime data end in 2023 | 216; 3,108; 168 | `mourtgos-adams-2026` | Sample section and Table 1 |
| Vehicle thefts fell 11 percent in the year after the first camera went live | −11.0 [−17.3, −4.2] | `mourtgos-adams-2026` | abstract; Table 2 |
| The share of thefts cleared by an arrest, 7.4 percent in the year before, rose by about 16 percent of that level, roughly one more cleared theft in every 100; the rise began in the three months before, which the authors say weakens the link | +15.9 [+7.3, +25.0]; 7.4 | `mourtgos-adams-2026` | abstract and Table 2 (relative change); Table 1, treated agencies' pre-deployment arrest clearance rate, 7.4 percent; 7.4 × 0.159 = 1.2 points, computed here |
| The main estimate weights agencies by their thefts before the cameras | | `mourtgos-adams-2026` | Weighting section |
| Weighted by population, or every agency-month counted equally: no change distinguishable from zero | +4.1 [−5.0, +14.1]; +4.4 [−3.4, +13.0] | `mourtgos-adams-2026` | Table S7 |
| The main estimate describes where the thefts are, not a uniform effect | | `mourtgos-adams-2026` | robustness discussion after Table 3 |
| The Institute for Justice, a libertarian law firm, made the weighting point in September | | `reason-flock-study-2026` | Sept. 18, 2026 |
| It sued Norfolk, Va., over its Flock cameras | | `ij-norfolk` | |
| Not published in a peer-reviewed journal | | `mourtgos-adams-2026` | a CrimRxiv working paper, posted Aug. 16, 2026 |

### When an alert is wrong

| Claim | Figure | Source | Where |
|---|---|---|---|
| Roseville: 1,011 of 1,427 stolen-vehicle and felony alerts in 2023 and 2024 involved a misread plate | 71 percent | `sacbee-roseville-2026` | with the lieutenant's statement and Flock's response |
| Story County: 165 of 214 hits matched an entry from another state, Axon in-car readers | 77 percent | `footnote4a-hotlist`; `data/outcomes/sources/story-rows.json` | Sept. 9 to Oct. 9, 2025 |
| Los Angeles: 161 of 50,183 in-car alerts were accurate reads of cars that, it turned out, were not stolen | 0.3 percent | `lapd-oig-2026` | p. 16 ("determined that the vehicles had not been stolen"); percent computed |
| The Story County report was published by Footnote 4a, the reporting site of Have I Been Flocked, which describes its focus as license plate surveillance accountability | | `haveibeenflocked-about` | the About page; footnote4a.org calls itself the site's editorial publication |

### What it costs

| Claim | Figure | Source | Where |
|---|---|---|---|
| The yearly fee covers camera, pole, solar panel, data and software; Flock keeps ownership | | `richland-agreement-2023` | agreement terms |
| List price $3,000 per camera per year | $3,000 | `flock-catalog-2024` | Virginia Sheriffs' Association catalog, May 2024 |
| Up from $2,500 before Jan. 1, 2024 | +$500 | `indio-2023`; `grafton-2024` | Indio staff report; Village of Grafton, Wis., renewal memo |
| Contracts and quotes from 2022 and 2023: one-time installation fee of $350 to $650 a camera, or $150 on existing infrastructure | $350; $650; $150 | `richland-agreement-2023`; `indio-2023`; `flock-deck-2023` | Richland order form, signed Sept. 22–23, 2022: "Standard Implementation $350.00"; Indio order form, October 2023: "Standard Implementation Fee $650.00", "Existing Infrastructure Implementation Fee $150.00"; Flock's July 2023 Orlando proposal: "One time implementation fee per camera =$650" |
| 2026 schedule: $1,000 to $1,250 to install and $350 to $5,000 to move a camera, when a customer changes the agreed plan | | `flock-fee-schedule` | the page's introduction says the fees apply to changes "driven by a Customer's request" |
| Price chart points: Richland $2,500 (September 2022); Indio $2,500 (October 2023); Greenville renewal $2,500 (April 2024); catalog $3,000 (May 2024); Park Ridge $3,000 (June 2025) | | `richland-agreement-2023`; `indio-2023`; `deflocksc-greenville`; `flock-catalog-2024`; `parkridge-2025` | |
| Greenville's 2019 pilot: 11 cameras for $2,000 a year in all | | `deflocksc-greenville` | city contracts published by DeFlock SC |
| Texas Department of Public Safety approved a $26 million contract in 2025 | $26 million | `texastribune-2026` | "approved a $26 million contract with Flock last year"; separately, the state vehicle authority's $15.9 million contract with DPS funded almost 1,200 cameras (`texastribune-dps-2026`) |
| Johnson City, Tenn.: $8.1 million over 10 years | $8,063,000 | `johnsoncity-2025` | agenda summary p. 1 |
| Contracts per year: Dallas $5.7 million over three years; Houston up to $6.4 million over five; Smyrna $5.7 million over 10; Huntington $2.1 million over five; Rhode Island State Police $597,000 over three | | `govtech-dallas-2026`; `houstonchronicle-2023`; `wsbtv-smyrna-2025`; `wvwatch-huntington-2026`; `turnto10-ri-2026` | Rhode Island's is dated by WJAR's July 30 report; Houston's is a ceiling and is drawn as an outline |
| Of contracts with a known term, Dallas's costs the most per year | $1.9 million | computed | $5.7 million / 3; Texas DPS's $26 million has no reported term and is not charted |

### What changed in 2026

| Claim | Figure | Source | Where |
|---|---|---|---|
| The governor paused state funding in August | Aug. 27, 2026 | `texastribune-abbott-2026` | |
| The Texas Tribune counted at least 14 cities and counties that had switched off more than 900 cameras | 14; 900 | `texastribune-unplugged-2026` | Sept. 24, 2026; attributed, since the count includes Dallas (next row) |
| Dallas, which had said it would switch off the cameras paid for with state grants, said on Sept. 30 that they would stay on for at least 90 days; The Texas Tribune reported that Flock had paused the city's payments for them | 321 of 684 | `govtech-dallas-2026`; `texastribune-dps-2026`; `fox4-dallas-2026`; `texastribune-reprieve-2026` | Sept. 1 (a Tuesday): police said they would shut down 321 state-funded cameras; Fox 4, Sept. 15: they "will remain in operation until September 25"; Fox 4, Sept. 30: cameras "that were set to be unplugged will remain active" for 90 days after "Wednesday's meeting"; The Dallas Morning News, Oct. 1: "will instead remain online for at least another 90 days"; the Tribune, Oct. 2: Flock "paused certain agencies' payments for the devices for 90 days". Only the Tribune's Sept. 24 story says Dallas "shuttered" them |
| Finding Flock lists 45 decisions to cancel, pause, deactivate, reject or not renew, August 2025 to September 2026; not complete | 23, 11, 6, 4, 1 | `findingflock-cancellations` | "This list is not exhaustive" |
| Sacra puts annual recurring revenue at about $450 million in October 2025 and $500 million in March 2026, within the period of the 45 decisions | | `sacra-flock` | Sacra's estimates: "$450M … October 2025", "$500M … March 2026" |
| In the week before Oct. 8, volunteers added at least 706 Flock cameras to the map | 706 | computed | `addedLastWeek`: nodes first mapped since Oct. 1 and not yet edited, a floor |
| In Windsor, Conn., a mapper deleted 14 of the cameras on Oct. 8, noting each had been removed, "presumably" because the town had canceled its contract; the council voted in July to keep them off | 14 | `osm-windsor-2026`; `patch-windsor-2026` | 12 changesets, 190181808 to 190182106, each noting the camera "has been removed. This is presumably due to the city's cancellation of their contract"; Patch counts 16 cameras |
| Timeline entries | | each entry's own source | `src/content/timeline-2026.json`; the Texas Department of Public Safety's "at least 940" cameras are attributed to the email a lawmaker shared, as `texastribune-dps-2026` reports it |

## Corrections, third review (8 October 2026)

A second independent fact-check of every claim changed after the first two reviews.

| What the site said | What the record shows | Source |
|---|---|---|
| Contracts from 2021 to 2023 added a one-time installation fee of $250 to $350 | No cited document shows $250 or a 2021 contract. Richland's 2022 order form lists $350; Indio's 2023 order form $650, or $150 on existing infrastructure; Flock's 2023 Orlando proposal $650. The story, Economics and Install pages now say so. | `richland-agreement-2023`; `indio-2023`; `flock-deck-2023` |
| A range of $2,000 to $2,500 a year in 2021–23 contracts (price chart band, Economics history) | Nothing supports the low end; the band is removed and the chart shows only documented prices, now including Richland's $2,500 in September 2022. | `richland-agreement-2023` |
| The annual fee covers "installation labor" | The implementation guide does not itemize the subscription, and a separate installation fee is billed; removed. | `flock-impl-guide` |
| Dallas shut off its grant-funded cameras, then said it would turn them back on | Local reporting says they stayed on: the department said on Sept. 1 it would switch them off, and on Sept. 30 that they would stay on for at least 90 days. The Texas Tribune's Sept. 24 count of switch-offs, which includes Dallas, is now attributed. | `fox4-dallas-2026`; `texastribune-reprieve-2026`; `texastribune-unplugged-2026` |
| Timeline: Dallas's announcement on Sept. 2; its reprieve on Oct. 2 | Sept. 1 ("announced Tuesday"); Sept. 30 (after "Wednesday's meeting"). | `texastribune-dps-2026`; `fox4-dallas-2026` |
| State grants "paid for at least 3,200 cameras at local agencies" | They "helped state and local agencies install at least 3,200", the Department of Public Safety among them; the $30 million includes contracts. | `texastribune-abbott-2026`; `texastribune-dps-2026` |
| Windsor: a mapper "removed them" in changeset 190182036 | That changeset deleted one node; the same mapper deleted 14 in 12 changesets, each noting the camera had been removed, "presumably" because of the contract's cancellation. | `osm-windsor-2026` |
| "Each agency counted equally" | Each agency-month: Table S7's "Equal agency-month weighting". | `mourtgos-adams-2026` |
| "216 adopting agencies and 3,108 others, 2017 to 2023" | Adoption ran from 2019 to 2024, with 168 agencies before the crime data end; the crime data cover 2017 to 2023. | `mourtgos-adams-2026` |
| DPS "will keep using its own network of at least 940 cameras" | The count comes from an email a lawmaker shared; neither DPS nor Flock discloses it. Now attributed. | `texastribune-dps-2026` |
| Oklahoma City: "a new Flock contract" | A renewal. | `okcfox-okc-2026` |
| Washington limits use "to felonies and gross misdemeanors" | Also to vehicles that are stolen or registered to people with arrest warrants, and to missing or endangered people. | `wa-sb6002-2026` |
| Hot lists include "Amber Alerts, state lists and custom lists", cited to Flock's policy | The policy names NCIC and NCMEC; the datasheet adds Amber Alerts and custom lists. "State lists" has no source and is removed. | `flock-lpr-policy`; `flock-flex-datasheet` |
| An alert "reaches officers' phones" in 10 to 15 seconds | The datasheet names no device: "reaches officers". | `flock-flex-datasheet` |
| Los Angeles: cars "no longer stolen" | The inspector general "determined that the vehicles had not been stolen". | `lapd-oig-2026` |
| 433 counties with none "in the Plains and the Mountain West" | The count includes Iowa, Minnesota and Missouri. The step now names the four states with the most such counties. | computed, `countiesNoneTop` |
| Lowe's 1,757; The Home Depot 1,154 | 1,767 and 1,162 once spelling variants are grouped. | computed |
| Rhode Island's contract "signed earlier in the year" | "Signed the initial agreement with Flock months ago." | `turnto10-ri-2026` |
| El Paso: use "halted" | The City Council later voted to remove the 150 cameras. | `texastribune-reprieve-2026` |
| Revenue "over a similar period": $500 million in March 2026, up from $285 million at the end of 2024 | The 45 decisions run from Aug. 5, 2025, to Sept. 25, 2026; Sacra's estimates inside that period are $450 million (October 2025) and $500 million (March 2026). | `sacra-flock`; `findingflock-cancellations` |
| Smyrna: "75 plate readers, 70 video cameras, one trailer, two drones" | The Marietta Daily Journal reports 75 more plate readers and two drones; WSB-TV reports 70 new cameras, two of them drones. Neither readable text gives the video cameras or the trailer; both reports are now given as they stand. | `mdjonline-smyrna-2025`; `wsbtv-smyrna-2025` |

## Corrections, second review (8 October 2026)

| What the site said | What the record shows | Source |
|---|---|---|
| Oakland's police reported 293 cameras | The 2025 annual report counts 290 cameras "funded and deployed"; 293 was Oaklandside's figure. | `oakland-pac-2026`, p. 7 |
| Oakland's 638.7 million "plates read" | Reads: the same plate can be read many times a day. | `oakland-pac-2026`, p. 2 |
| Oakland: 162 arrests, 174 vehicles, 51 guns | The report's summary says so; its own table by offense totals 162, 25 and 50. Both are now shown. | `oakland-pac-2026`, pp. 11–12 |
| Outside agencies "do not report" their outcomes | They "do not always" report them, and the department cannot see their records. | `oakland-pac-2026`, p. 4 |
| Los Angeles: 210.6 million reads and 50,183 alerts, side by side | The reads are from all the department's readers; the alerts and outcomes from Axon in-car readers only. The ladder now labels each. | `lapd-oig-2026`, pp. 14–16 |
| Los Angeles's figures "as three departments count them" | They come from the Police Commission's inspector general. | `lapd-oig-2026` |
| Grafton, Mass. | The Village of Grafton, Wis. | `grafton-2024` |
| Installation rose from $250–$350 to $1,000–$1,250 | The 2026 schedule applies to changes a customer requests after the deployment plan is agreed; it is no longer compared with contract installation fees. The "2021" column of earlier fees had no source and is removed. | `flock-fee-schedule`; `flock-impl-guide` |
| Six to 12 photos, cited to the CEHRP teardown | The teardown gives no count; Jalopnik does. | `jalopnik-speed` |
| "Crops and text are sent; full frames and video are not" | No Flock statement found; replaced with the policy's own words on what is transferred. | `flock-lpr-policy` |
| Vehicle Fingerprint fields cited to Flock's policy, which lists only color and make | Flock's 2020 Wing announcement lists aftermarket wheels, a roof rack and a trailer hitch; its 2023 presentation lists type, make, color, state, missing or covered plates, bumper stickers, decals, roof racks and back racks; The Texas Tribune reports dents. Each field now cites one of these. | `flock-wing-2020`; `flock-deck-2023`; `texastribune-unplugged-2026` |
| The two Texas searches, cited to 404 Media | The one-week search and the shared reason come from EFF's records. | `eff-texas-2025` |
| Flock cut its default from 30 days to seven on Aug. 13 | For new customers; existing customers keep their periods. | `flock-guardrails-2026` |
| Alerts within about 10 to 15 seconds to nearby officers | On average, 10 to 15 seconds, per the datasheet; "nearby" is not in it. | `flock-flex-datasheet` |
| Lists are pushed to cameras twice a day | The ACLU says the NCIC lists. | `aclu-2022` |
| Virginia's 21-day cap, cited to a think tank | Cited to the statute. | `va-code-2-2-5517` |
| Timeline: State Police "announce" 39 readers on July 30 | WJAR reported it July 30; the contract was signed earlier. | `turnto10-ri-2026` |
| Timeline: "requires multifactor login" on Aug. 13; "stop spending"; grants "paid for" 3,200 | Multifactor login became mandatory at the start of August; the order paused funding; the grants helped install at least 3,200. | `flock-guardrails-2026`; `texastribune-abbott-2026` |
| Timeline rule: "a large city … decisions reported as firsts" | Rewritten to describe the selection actually made, which includes contracts added and kept. | `timeline-2026.json` |
| Finding Flock: "cancel, pause, deactivate or not renew" | Its 45 include one rejection. | `findingflock-cancellations` |
| Dallas "said it would switch off 321 cameras on Sept. 15" | Superseded by the third review: the department said on Sept. 1 it would switch them off, kept them running, and on Sept. 30 said they would stay on for at least 90 days. | `fox4-dallas-2026`; `texastribune-reprieve-2026` |
| Oklahoma City: "for 90 cameras" | The cited story gives the contract (about $270,000, 5 to 3) but no count; the count is removed from the timeline. | `okcfox-okc-2026` |
| The map's alt text: 143,595 dots; the step: 143,929 readers | Both are right and now say so: 334 are outside the map's frame. | `meta.json` |
| Mapped vs. published: Oakland 293 | 290, from the report. | `oakland-pac-2026` |

## Corrections, first pass

| What the site said | What the record shows | Source |
|---|---|---|
| LAPD: 498 alerts, 161 wrong (32%), misread plates | 50,183 in-car alerts (5,911 unique plates) on 1 Aug–30 Sep 2025, from Axon in-car readers; 161 were correct plate reads of vehicles that "had not been stolen"; 337 vehicles recovered; 74 arrests from 68 stops; 4,575 with no action recorded. "498" was 161 + 337, not a count of alerts. | `lapd-oig-2026`, pp. 2 and 15–16 |
| Story County: Flock cameras; "every wrong hot-list hit" | The sheriff's office's "Erroneous hotlist hits" report from its Axon in-car readers, 214 rows from NCIC lists: 165 wrong state, 3 incorrect, 10 correct with no action, 29 no action, 7 dismissed. Its hits are where patrol cars were, so they are no longer matched to fixed cameras. | `footnote4a-hotlist` ("an overview of Axon data"); `data/outcomes/sources/story-rows.json` |
| Texas search: April 2025; "no warrant or case number" | Two searches on 9 May 2025: one week across 17,684 cameras in 1,295 networks, then a month across 83,345 cameras in 6,809 networks. Both logged "had an abortion, search for female" and the case number of the sheriff's death investigation. | `eff-texas-2025`; `404-texas-2025` |
| "Outside agencies ran 521 searches for every local one" | ALPR Watch counted 29.3 million network-audit rows (searches by anyone in the network that touched an agency's data) against 56,230 organisation-audit rows (the agency's own searches) across the logs it obtained. Rows, not distinct searches. The story no longer uses the figure. | `alprwatch-foia-2025` |
| Oakland: "recoveries and arrests are the 425 outcomes" | 425 "success stories" logged in Flock's outcome feature; see the second review for the report's two sets of totals. Stolen-plate and stolen-vehicle notifications stayed switched off for lack of staff. | `oakland-pac-2026`, report pp. 2–4 and 11–12 |
| Roseville: 1,011 attributed to a page that only gives 71% | 1,011 of 1,427 stolen-vehicle and felony alerts in 2023–24 (71%) involved a misread plate; a lieutenant said none led to a contact or an arrest; Flock called the figure a mischaracterization and the deployment unusual. | `sacbee-roseville-2026` |
| "More than eighty jurisdictions have ended Flock contracts" | Finding Flock lists 45 verified decisions from Aug 2025 to Sep 2026: 23 cancelled, 11 not renewed, 6 paused, 4 deactivated, 1 rejected. Not exhaustive. | `findingflock-cancellations` |
| Columbia: 217 cases, six categories | 217 case outcomes; eight categories (69 cleared by arrest, 52 leads, 33 in progress, 31 unable to locate, 20 cleared otherwise, 7 no action, 3 warrants issued, 1 added to a hot list) sum to 216. | `columbia-mo-2025` |
| Outcomes coverage: 239 locations, 220 placed, 32 within 150 m | 74 records tied to fixed cameras, 55 placed, 21 within 150 m of a mapped camera on their own; 5 road-only records are placed at a camera on the named road by construction and no longer count as matches; Story County's 163 in-car hit locations are reported separately. | `scripts/outcomes/build.mjs` |
| Tucson: 12 places | 10 places; two intersections appeared with their street names in either order. | `tucson-cfs`; build script |
| Green Bay and the 140-day Nashville pilot: rates per million reads | No rates: the reads and alerts cover different time windows. | `greenbay-audit-2026`; `nashville-lpr-sampling-2023` |
| Mourtgos and Adams: finding only | The finding now sits beside the alternatives in the paper's own appendix and the Institute for Justice's reading of them; see the story table above. | `mourtgos-adams-2026`; `reason-flock-study-2026` |

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
| Inside the map's frame | 143,595 (334 outside: Puerto Rico and elsewhere) | Albers USA projection, `cams.bin` |
| Mapped Flock cameras | 115,437 | `brand` field equal to "Flock Safety" |
| Flock share | 80% of all mapped readers; 84% of those with a make tagged | 115,437 / 143,929; 115,437 / 137,214 |
| Other makes | Motorola Solutions 7,509; Genetec 3,647; Axis 2,445; Leonardo 1,259; Rekor 804; Axon 752; no make tagged 6,715 | `public/data/story/operators.json` |
| Never edited since first mapped | 76% | `osmVersion` equal to 1 |
| Flock cameras, U.S. | 115,249 (50 states and D.C.); 188 elsewhere, 126 of them in Puerto Rico | point in county polygon; 43 points within 1 km of a county assigned to the nearest, 20 outside every county |
| U.S. rate | 33.9 per 100,000 residents | 115,249 / 340,110,988 |
| Regions | South 41.3, Midwest 39.0, West 33.3, Northeast 11.6 per 100,000 | Census regions |
| Highest state rate | Georgia, 82.7 per 100,000 (9,251 cameras; 2.4 times the U.S. rate) | then Ohio 52.8, Texas 50.6, Indiana 49.1, Alabama 48.4 |
| Lowest state rates | New Hampshire 1.1, Alaska 2.6, Vermont 2.8, Maine 3.3, Hawaii 4.6 | |
| Most cameras | California 16,919; Texas 15,839 | |
| Counties with none mapped | 883 of 3,144 (home to 3.9% of residents) | 50 states and D.C. |
| Highest rate, counties of 1 million or more | Fulton County, Ga., 116.4 per 100,000 (1,269 cameras) | the story's zoom target, chosen by this rule |
| Most cameras, county | Harris County, Tex., 3,717 | |
| Flock cameras with an operator tagged | 16,500 (14%) | `operator` field present |
| Operator classes, among those tagged | police and sheriffs 10,222 (62%); retailers and shopping centers 3,237 (20%); Flock Safety listed 1,388; other government 645; unclear 466; business 234; residential 207; schools 101 | every name with 10 or more cameras classed by hand in `data/story/operator-classes.json`; smaller ones by keyword; all published in `operator-classes.csv` |
| Largest named operators | Lowe's 1,757; The Home Depot 1,154; California Highway Patrol 441 | spelling variants grouped (`canonical` in the class file) |
| Added in the week before the snapshot | at least 1,101 readers, 706 of them Flock's | nodes at version 1 first mapped since Oct. 1, 2026 |

### Mapped against published counts

Flock cameras mapped inside each city's Census 2024 boundary, against the count the city or its reporting
published. Mapping includes cameras run by others inside city limits (the California Highway Patrol in Oakland,
retailers, homeowner groups), and published counts can be older than the map, so neither number is the other's
error; the table shows how far "mapped" can sit from a published figure.

| City | Mapped (police-tagged / other operator / untagged) | Published | Source |
|---|---|---|---|
| Oakland, Calif. | 518 (20 / 402 / 96); 380 of the "other" tagged to the CHP | 290 (2025 annual report) | `oakland-pac-2026` |
| Denver | 139 (1 / 7 / 131) | 111 at about 70 sites (2024–25) | `denverite-2025` |
| Lexington, Ky. | 195 (60 / 16 / 119) | 125 (December 2025) | `lexington-lpr-locations` |
| Berkeley, Calif. | 81 (41 / 6 / 34) | 52 (2025) | `berkeleyside-2025` |
| Piedmont, Calif. | 35 (0 / 34 / 1) | 48 (2025) | `piedmont-2025` |
| Lafayette, Colo. | 33 (1 / 0 / 32) | 30 (2024–25) | `lafayette-co-alpr` |
| Dallas | 919 (62 / 10 / 847) | 684 (September 2026; 321 paid for by state grants) | `govtech-dallas-2026` |
| Houston | 2,266 (1 / 167 / 2,098) | 3,800 police and private (2024, per city officials) | `houstonchronicle-flock-2025` |

### Two camera snapshots

The story's map, counts and rates use the 8 October 2026 snapshot. The Outcomes page keeps the 17 July 2026
GeoJSON snapshot (116,723 readers; `data/story/raw/cameras-us-hourly-2026-07-17.geojson`, pinned in the manifest),
because its records were matched to the cameras mapped while they were made. Windsor, Conn., shows why: its 16
cameras were switched off in February 2026, the town council voted 5–4 on July 6 not to turn them back on, and the
a mapper deleted 14 of them from OpenStreetMap on 8 October 2026 (12 changesets, 190181808 to 190182106;
`osm-windsor-2026`, `patch-windsor-2026`).
