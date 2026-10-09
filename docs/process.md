# How this site was built

A working record of the project from the first commit on 4 September 2026 to the data story on the home
page on 8 October 2026 and the reference pages rebuilt to its standard on 9 October: what each page shows, how it was made, what went wrong, and what was learned.
It is written as reference material for a later article. Figures come from the repository itself
(commit history, content files, scripts) and from the research notes gathered during the work.

## 1. Ground rules

Five rules shaped every decision and held for the whole project.

**Evidence first.** Every number and claim on the site lives in a JSON file under `src/content/`, and every
entry there carries a `sources` array pointing into one bibliography, `src/content/sources.json`. Each source
is tagged by origin: `flock` (the company's own documents), `independent` (teardowns, research, journalism),
`government` or `court`. The build refuses to run if a cited source id does not exist (`scripts/check-sources.ts`)
or if a listed still image is missing. The bibliography grew from about 60 rows at the start to 196 by
Oct. 8; the review of Oct. 9 removed 18 rows that nothing cited and added a few, leaving 182. Statements from Flock and from independent sources are shown with different tags so a reader can tell
them apart, and where the two disagree, both are cited.

**Neutral copy.** No adjectives that judge. A camera that reads a plate "reads a plate"; an audit that found
71% of alerts wrong is reported with the denominator and the agency's own explanation.

**Nothing ships unverified.** Before each push: TypeScript typecheck, a production build (which first runs
the source checks), the Playwright suite (22 tests by Oct. 9: every page, the citation chips, the 3D locator,
phones, the story's map steps, the page without JavaScript, reduced motion, no requests to other sites, no
page wider than a phone, invariants of the story data, and, from the last round, Times style, heading order,
the page heads without JavaScript and the size of chart text on a phone), a viewport sweep (`scripts/qa.mjs`) of every page
at six desktop and four phone sizes that reports horizontal overflow, figures wider than the screen, cut-off
text, failed images, header and pager problems and, on the home page, whether the map stays pinned at every
step, and screenshots read by eye at desktop and phone widths. The sweep produced findings at almost every stage; the rule was zero
findings before a push.

**The owner is the author.** Every commit is authored by the owner. No tool or model is named as an author
in the repository or its documentation.

**Two branches, one deploys.** Work lands on a feature branch and on `main`; the GitHub Pages workflow builds
both but deploys only `main`, so unfinished work could be pushed to the feature branch to keep it safe
without changing the live site.

## 2. Timeline

| Date | Commit | Milestone |
|---|---|---|
| 2026-09-04 | `9ff7d33` | Scroll-driven 3D explainer: six acts, models from Blender scripts, tagged bibliography, Playwright test, Pages workflow |
| 2026-09-04 | `cc5819c` | Stills stepper for phones, blueprint ground and new type, Economics act |
| 2026-09-04 | `a8ee034` | Claims, Economics and Sources as scrolling articles |
| 2026-09-06 | `c329f19` | Stills fallback when no 3D engine starts; product line table |
| 2026-09-06 | `41d6453` | Deployments and contracts section |
| 2026-09-07 | `ebf14fe` | Tabs instead of one long page; 3D driven by controls; numbered badges with callout cards |
| 2026-09-07 | `9e64e1d` | Inside stage: see-through shell with markers driven by the explode slider |
| 2026-09-08 | `93b8ef0` | One scrolling page with a knolling grid of the components in five groups |
| 2026-09-08 | `cede0b6` | Components on their own page |
| 2026-09-08 | `984bf72` | Every section on its own page; home becomes a summary with the components preview |
| 2026-09-08 | `42458a8` | Header links wrap on phones so Home and every page stay visible |
| 2026-09-18 | `4922558` | Journey page: one photograph tracked like a parcel, with a preview on the home page |
| 2026-09-18 | `2b3e237` | Journey stops show one sentence each; details fold under a toggle |
| 2026-09-18 | `2e673f8` | Pole and power move onto the components page; eight header links |
| 2026-09-22 | `9165de2` | Outcomes page: public records tied to mapped cameras |
| 2026-09-23 | `5824df2` | Outcomes data geocoded from caches; offline build; rate units |
| 2026-09-28 | `48a630f` | Visual QA: tables scroll in their own container; legible stage diagrams |
| 2026-09-29 | `c359d0d` | Second visual QA: header at every width, readable Outcomes maps, contrast |
| 2026-10-08 | `d2d940f` | Fact-check pass before any chart: LAPD, Story County, the Texas search, Roseville, Oakland, Columbia |
| 2026-10-08 | `31ca8f7` | Story data: pinned camera snapshot, Census joins, packed national map, city basemaps |
| 2026-10-08 | `a0348ba` | The home page becomes a data story; editorial design across the site |
| 2026-10-08 | `5517ca4` | Reference pages rebuilt to the story's graphics standard |
| 2026-10-08 | `b9277d8` | Graphics review and second fact-check applied |
| 2026-10-08 | `4f866ec` | Fourth graphics review of the story; live on GitHub Pages |
| 2026-10-09 | `717648c` | Reference pages: fourth fact-check, against the corrected story |
| 2026-10-09 | `c6db6ae` | One head for every reference page from `pages.json`; Times style held by a test |
| 2026-10-09 | `13e942a` | Phone drawings at 328 pixels; no chart text under 11 pixels |
| 2026-10-09 | `3b053e7` | Each reference page opens with its chart and closes with its notes |
| 2026-10-09 | `05c7fa5` | The Components locator fits its panel; the lens still rendered in the browser |

## 3. The 3D pipeline and the stills

The models are parametric: Blender scripts read the same content files as the site and emit four GLB files
(the Falcon camera with its fourteen parts as named nodes, the pole and mount, a street, the Wing gateway).
Part names in the content (`falcon.som`, `falcon.ledboard` and so on) are the node names the locator drives.
Dimensions marked "estimated" are sized from the published envelope and teardown photographs; the enclosure,
pole and panel dimensions are Flock's own published figures.

The still set is rendered from the same models with Cycles, listed in `src/content/stills.json` (26 images,
WebP, 15 to 90 KB each). Phones never download the 3D engine; they get the stills. Desktops that can run a 3D
engine get a locator that renders with WebGPU where available and WebGL2 otherwise, and fall back to the
assembled still if no engine starts or the context is lost (`?fail3d` simulates that). The locator renders
only while it is on screen.

The home page's two preview posters are rendered from the live pages by headless scripts
(`scripts/knolling.mjs`, `scripts/journey.mjs`) rather than drawn separately, so they cannot drift from the
pages they advertise.

## 4. Page by page

How each page came to be, up to the October story. Their heads, opening figures and order changed again on
Oct. 9 (section 8).

### Home

The home page went through five forms: the top of one long scroll, a splash of cards above tabs, the head of
one scrolling document with a preview image, a summary page, and finally, in October, a data story (section 7).
The page cards from `overview.json` now close the story under "Go deeper". Older links to the single-page site (`#act-4`,
`#/hardware/inside/13`, `?s=data/9`, `#src-<id>`) are recognised on arrival and redirected to the page, part,
stage or row they named, so nothing shared earlier broke.

### Deployments

Where the contracts are public (federal awards in USAspending, state grant programmes, council agendas), the
largest documented contracts by agency with value, term and camera count, the public funding behind them
(the Texas insurance-fee grants, Florida state grants, federal grants to cities), and documented camera
counts by city as a horizontal bar chart drawn in HTML so labels stay readable at any width. Wide tables
scroll inside their own container on phones.

### Components

This page had the longest history. It began as an exploded-view act with spec cards, then a see-through
shell with fourteen numbered badges and callout cards ordered so leader lines never crossed, then a tabbed
"Inside" view. The owner judged the callout version "extremely messy with lines" and asked for ten
alternative mockups with UI research; option three, a knolling grid, won. The fourteen parts are laid out at a
consistent scale in five groups (Shell, Optics, Compute, Radios, Mount). Selecting a part opens its record
under its group: function, specification, part number, vendor, sources, and the related data stage. Desktops
get a locator beside the grid: the assembled camera drawn see-through, the selected part framed alone, and a
slider that separates the parts front to back with the camera rolled so the stack runs down the frame.

Problems along the way: a mock-camera "relative" pose that looked the wrong way because the engine's
forward vector was reversed (fixed with absolute poses in the camera's own frame); a hover highlight whose
`transform` override made markers jump (replaced by a box-shadow highlight); deep links to a part opening
seconds late because they waited for three model files (now resolved immediately and again after the
locator boots); the Components chip on the components page sending the reader back to the home page because
a section hash was parsed as a legacy route.

Later the pole and mount cards and the power and cable cards, which had been their own pages, were folded
onto this page under the grid with a jump row, at the owner's request, and the old addresses redirect.

One correction found during the outcomes research: the modem's FCC source cited grantee code 2BMEK, which
turned out to belong to an unrelated gauge company in Oakland. Flock Group's own grantee code is 2BKG8,
registered in August 2024 with no filings. The point that the Falcon relies on pre-certified radio modules
stands; the citation was replaced.

### Data

One detection traced through twelve stages from capture to deletion, each with the processing location,
transport, storage, retention and payload, and the unknowns the public record does not fill. Retention
presets (7 days, 21, 30, 60, Evidence Mode) with the statute or document behind each, and a network search
example reproducing the counts from one documented query: the Johnson County, Texas, sheriff's office's
searches of May 9, 2025, the second of which reached 83,345 cameras in 6,809 networks (first recorded here as
an April search with no case number; both were wrong, and corrected in October).

### Journey

The owner chose this from a list of fifteen ideas aimed at the average reader: the data path retold as a
parcel tracker. Seven stops, each a card: picked up (the pole), in transit (carrier network), arrived at
facility (Amazon's cloud), sorting (hot lists), out for delivery (officers' phones), available for pickup
(network search), disposed (deletion). A slip beside the list shows the parcel card with a plate, the stop
count and the current status, and the dashed route fills as the reader scrolls. The content is a new JSON
file whose every stop cites the same sources as the data-path stages it summarises.

Two rounds of change followed. First, each card was cut to one plain sentence and a "who can open it" line,
with the paragraph, package contents, data-path links and citations folded under a native disclosure
toggle; the page shrank from about 2,700 to 2,100 pixels on desktop with nothing removed. Second, the rule
for which stop is "current" was wrong three times: a line at 55% of the viewport marked stop 2 current at
page load on large screens; a line at 35% never reached the last stop on tall screens; a header-relative line
skipped stops on very large screens. The final rule combines the card under the header with the scroll
fraction, and forces the last stop at the end of the page. It was checked at eight sizes from 360 to
2560 pixels wide.

### Claims, Economics, Sources

Twenty-one common claims checked against the record, each with a verdict and sources; the product line as a
table. Economics: list prices, what the annual fee includes and excludes, the 2026 schedule of fees for changes
after installation, price history from Greenville's 2019 pilot to the $3,000 list price, installation
workflow, permitting, contract terms, scale and public funding, with a priced-pole figure. Sources: every row grouped by origin with the date last checked.

Citation chips anywhere open the Sources page at the cited row, which is marked. The marker stopped
appearing after cross-page navigation for a while; the cause was in the tests, not the site: the URL waits
were tied to the browser's load event, which a slow font host delayed past the 2.6-second flash. The marker
became persistent and the tests wait for the navigation to commit instead.

### Navigation

The site's shape changed four times: one long scroll with acts, tabs with a hash router, one scrolling
document with section links, and finally separate pages. Each change kept every earlier link working. Once
the pages were separate, a review found seven navigation faults, among them no visible way home on phones
(only a 10-pixel brand dot), no `aria-current` on the active link, and the Top button dropping a selected
part from the address. The header now carries Home first and marks the current page. On phones the links
wrap into two rows so all of them stay visible; the header height is a CSS token that the page padding,
scroll offsets and the sticky locator all follow, so nothing lands under it.

## 5. The outcomes page in depth

### The question

After the reader-facing pages, the owner asked for data insights rather than visualisations, then for
something no one had built. The check that framed the answer was traffic: the crowd-sourced camera map gets
about 6.9 million visits in three months and the plate-lookup site 3.3 million, five and two and a half times
the company's own site. Both answer "where is one near me" and "was I searched". Nothing with an audience
shows what the reads produce. The owner's direction was "pull all available data online to tie to cameras".

### Research

Three surveys ran in parallel: the company's and agencies' published outcome claims; public records that tie
a specific read or hot-list hit to a case; and news-reported arrests as a data source. Together they made
about 300 searches and fetches. What they found, by granularity:

- **Per camera site, with outcome rungs.** Exactly one public table: Metro Nashville's 2023 pilot report,
  giving verified hits, stops, searches, arrests and recoveries for 24 intersections and four mobile units
  over eight weeks (totals 443, 25, 19, 18, 22). A supplemental sampling report gave reads (about 71.7
  million estimated over 140 days) and hit notifications (13,399 in forty sampled days, of which 1,346 were
  verified). The report does not name the vendor of the fixed cameras.
- **Per hit with location and outcome.** Story County, Iowa's export of hot-list hits reviewed as wrong for
  one month: 214 rows with coordinates, category and review status (77% "wrong state").
- **Per dispatch call.** Tucson's calls-for-service layer carries a FLOCK nature code used by the University
  of Arizona police, with intersection, coordinates, disposition code and case id.
- **Per named case.** Windsor, Connecticut's fact sheet lists sixteen camera sites and ten dated cases, four
  of which name the camera used. An Ohio appeals opinion names "the Par Lane Flock camera" and the entry and
  exit times of a stolen car.
- **News.** A public dataset of 1,743 news-reported outcomes credited to Flock cameras, built daily from news
  feeds; a regex over its summaries found 32 records naming the camera's road or intersection and about
  300 naming a road.
- **Agency totals.** Audits and annual reports from Los Angeles, Oakland, Green Bay, Roseville, Columbia
  (Missouri), Piedmont, Lafayette, Denver, Berkeley, Lexington, Atlantic City and Story County, each giving
  some rungs.
- **National.** Flock's Impact Census (about 700 agencies, "directional estimates rather than audited
  totals") and one quasi-experimental working paper (216 agencies, vehicle theft down 11%).

Records found but not usable were kept in a list on the page with the reason: Cincinnati's 2,532 LPR calls
with dispositions (vendor unconfirmed), Minneapolis's plate-reader calls (the city says its readers are not
Flock), Connecticut town lists obtained by a television station (locations without outcomes), and Minnesota's
statutory reader logs (behind script-rendered pages; a records request is the route).

### Neutrality by construction

The page uses the same six rungs for every record: reads, alerts, wrong alerts, stops, recoveries, arrests. A
rung the source did not report is shown as "not reported", never as zero. Rates are computed only where both
rungs come from the same report. Each source's own definitions are stated (Nashville's "verified hit" is a
confirmed notification; Roseville's alerts are on stolen-vehicle and felony lists). Flock's national
statements sit on the page tagged as Flock statements beside the independent study tagged as such. The
coverage block says, in numbers, that most mapped cameras have no public outcome record at all.

### The data pipeline

`scripts/outcomes/build.mjs` reads hand-entered sources (Nashville's table, Windsor's sites and cases, the
court records, district counts, agency ladders, national statements) and fetched inputs (the Story County
CSV, Tucson's ArcGIS layer with coordinates requested in longitude and latitude, the news tracker CSV), plus
the camera map: the hourly OpenStreetMap export republished by the deflock-data project, 116,723 readers of
all makes of which 96,484 are tagged Flock, 93% with a bearing. Every located record is joined to its nearest
mapped camera by haversine distance through a grid index, and the distance is kept; a record counts as
matched within 150 metres. The output is a 169 KB JSON file for the page and a 1.8 MB compact file of
Flock camera points for the maps.

### The geocoding saga

The hard part was turning "Gallatin Pike & East Trinity Lane" into coordinates. In order:

1. **Nominatim cannot do intersections.** Querying the two roads and computing their closest approach
   failed because Nominatim returns only a few segments of a long road, so the segments near the junction
   were usually missing.
2. **Overpass, which can, was mostly unreachable.** The main instance reset the connection from the build
   environment. One mirror turned out to be a Switzerland-only extract and returned nothing. One public
   mirror answered, slowly.
3. **The method that worked:** fetch every way named like each road within the city's bounding box, and take
   the node the two share; for grade-separated crossings, the closest approach within a tolerance (larger
   for interstates). Road filters use `ref` for interstates and numbered routes and a name regex that accepts
   common abbreviations and direction suffixes.
4. **Self-inflicted delays.** A process-kill pattern matched the shell that ran it and killed the build
   twice. A container restart killed a run in progress. Worse, two query-shape changes (the direction-suffix
   regex, then a larger bounding-box pad) changed every cache key, so runs that should have been cache hits
   re-queried everything from a server returning 504s and four-minute timeouts, at roughly ten minutes per
   failed road.
5. **The fix.** Cache lookups were normalised across query shape (bounding box, timeout and suffix stripped
   before matching), and an offline mode was added that builds from the caches alone. The offline build
   completed in seconds: 220 of 239 locations placed, 32 within 150 metres of a mapped camera, 19 left
   unresolved and labelled as such on the page. A later online run when the server is healthy can fill
   those in without touching anything else.

The lesson for the article: geocoding intersections against free OpenStreetMap services is feasible but
fragile, and a cache keyed on the semantic query rather than its literal text would have saved most of a
day.

### The map decision

The plan first called for a vector-tile map with a library. It was dropped for three reasons: no external
requests from a page about surveillance, no dependency, and the site's blueprint style. Instead the mapped
cameras are drawn as the map: a national canvas of 96,484 dots on an equirectangular projection, and city
panels for Nashville, Windsor, Story County and Tucson that plot the cameras within the sites' bounding box
plus three kilometres, with outcome sites as rings sized by hits or calls, shaded by the deepest rung reached
(outline for alerts only, amber for stops, ink for a recovery or arrest), numbered to match the table rows,
with a scale bar. The camera file loads only on this page and only when a panel scrolls into view.

### What would extend it

Flock's software exports a hot-list alert report with the camera name, timestamp, plate and list, and since
September 2022 an outcome field ("Apprehended" or "Not Apprehended") officers can set on alerts and searches.
Agencies release these under public-records law; Story County's export is one. A request for the alert
report and the outcome field, plus the agency's camera inventory, yields the per-camera ladder for any
agency. The page says so in its coverage block.

## 6. Cross-cutting challenges

- **A proxy that hangs the load event.** Third-party font requests through the build environment's proxy
  never completed, so the browser's load event fired seconds late or not at all, stalling tests and the
  screenshot scripts. The font link became non-blocking and every automated navigation waits for the
  commit rather than the load.
- **Nested pages and asset paths.** Once pages moved into folders, relative model and still paths broke;
  a small root-aware module resolves the asset prefix per page.
- **Fonts and privacy.** The pages loaded fonts from a third party until October; they are now self-hosted
  and a test fails if any page requests anything from another site.
- **Background work and restarts.** Long runs were pushed to the background with logs; the caches they wrote
  were the only thing that survived a container restart, and they were enough.
- **Approval gates.** Larger changes were planned in a plan file first and approved before implementation;
  when the environment interrupted mid-task, the plan file carried the state across the gap.
- **Visual QA in two passes.** The automated sweep checks what can be measured; two passes of reading every
  page screen by screen found what it could not. The first found the Outcomes page widening the phone
  viewport to 918 px. The second, with the real fonts served locally (earlier captures had silently used
  fallback fonts because the test browser rejected the proxy certificate) and the maps switched on, found
  23 issues: header links clipped between 801 and 1079 px (an iPad in landscape lost Sources), a renderer
  label left in the header, a mislabelled Windsor column, sentence fragments as News site names, empty
  Story County labels from a Map passed to `Object.entries`, a statement cited to the wrong source, city
  maps drawn at a fixed width that shrank their numbers to about 3.5 px on phones, whole columns of "not
  reported", and grey and amber text below 4.5:1 contrast. Each fix that could regress got a check: the
  sweep now judges header links against the menu's own box and runs ten sizes, and a smoke test covers the
  in-between widths.

## 7. October: the home page becomes a data story

### The brief

The owner asked for the site to be raised to the standard of a newspaper graphics desk, in the storytelling
and in the graphics themselves, with no limit on effort. Three choices came first: the work would cover every
page, not only one; the look would be editorial (serif headlines and text on a plain white page, a sans for
charts, one amber accent) in place of the blueprint ground; and a long-form story would become the home page,
with the page cards moved to its end.

### Fact-checking before charting

Before any chart was drawn, every figure the story would use was traced to its source, and seven changed:
the Los Angeles audit (a constructed "498 alerts, 32 percent wrong" withdrawn), Story County's export (Axon
in-car readers, not Flock cameras), the Texas search (two searches on May 9, 2025, with a case number),
Roseville, Oakland, Columbia and the outcomes coverage. Two later passes found more. A full check of about
200 claims found three errors and four claims cited to the wrong document: Oakland's report counts 290 cameras,
not 293; Grafton is in Wisconsin; and the 2026 fee schedule applies to reinstalls a customer requests, so it
can no longer be compared with the installation fees in earlier contracts. Every number in the story is
listed in [fact-check.md](fact-check.md) with the place in its source where it appears.

### The data

- **Cameras**: DeFlock's hourly vector-tile archive of OpenStreetMap plate readers, pinned on Oct. 8, 2026,
  with a manifest of URL, size, SHA-256 and ETag: 143,929 readers, 115,437 of them Flock's. The tiles were
  current where the downloadable GeoJSON was weeks old.
- **Places**: each camera assigned to a county by point in polygon on the Census Bureau's 2024 boundaries
  (Connecticut as its planning regions), with a counted nearest-county fallback, and joined to the Vintage
  2024 population estimates. Rates cover the 50 states and D.C.
- **Operators**: every operator name with 10 or more cameras classified by hand, the rest by keyword; the
  classes are published as a CSV.
- **Every number in the prose** is written to `stats.json` with its source ids, and the text refers to it by
  key, so a rebuild with a new snapshot updates the story.
- **The map**: points projected in advance (Albers USA, a 1000 by 620 frame), stored as delta-encoded 16-bit
  coordinates and a class byte, gzipped: 278 KB for 143,595 points, unpacked in the browser with the
  built-in `DecompressionStream`.

### The story

Twelve sections. The opening map is a scroll-driven graphic pinned under the header, with five steps: every
reader; Flock's highlighted, the other makes drawn on top; county rates, with thinly populated counties
drawn lighter so empty land does not outweigh people; Georgia, its neighbors faded; and Fulton County with
Atlanta's interstates, the highest rate of any county of a million people. Every other figure is static,
with a title that states its finding, notes, a source line and a "Show the data" table: a county lookup,
a diagram of what one read records, a logarithmic time scale from the read to deletion, the audit-log record
of the Johnson County searches beside three accounts of them, Oakland's reads and alerts as areas, three
departments' counts on one scale, the crime-effect estimates, three ways an alert can be wrong, prices,
contracts, a 2026 timeline and a comparison of mapped and published counts.

The story is rendered into `index.html` at build time by a Vite plugin from pure string renderers, so the
text, figures and tables are there without JavaScript (a poster stands in for the map); the client adds the
map, the county search and tooltips. Each SVG chart is drawn twice, at 600 and 360 pixels, so the phone
version is laid out for a phone rather than shrunk.

### Decisions

- **Neutral by construction.** Each source is introduced with what it is: DeFlock, "an anti-surveillance
  group"; the Electronic Frontier Foundation, "a digital rights group"; the Institute for Justice, "a
  libertarian law firm" that sued Norfolk, Va., over its cameras; Sacra, "a firm that estimates private
  companies' revenue." The company's figures sit beside independent ones. The crime-effect working paper is
  shown with the two alternative weightings in its own appendix, under which its 11 percent drop cannot be
  told apart from zero, and with the authors' explanation that the weightings answer different questions.
- **Selection rules in writing.** The timeline states how its events were chosen and includes contracts added
  and kept as well as those ended; the outcomes ladder shows each department's counts from its own report or
  audit and computes no rates across departments.
- **Dates move.** Dallas said on Sept. 1 that it would switch off its 321 grant-funded cameras; local reporting
  says they stayed on, and on Sept. 30 the department said they would stay on for at least 90 days. One
  newspaper's count of switch-offs included Dallas, so the story attributes that count and reports each state
  on its date.
- **Phones** keep the two-row header, so all nine links stay visible; the map's legend has its own band above
  the map and its credit one below it, opaque step cards come about once a screen, and the preview images
  are whole tiles with no small print at any width.
- **No outside requests.** Fonts are self-hosted; the map draws from local files.

### Reviews

Two independent reviews read the finished story: a graphics editor's critique of contact sheets at 1,440
and 390 pixels against a newsroom rubric, and a number-by-number fact-check. The critique asked for the
identity of every source, a figure for the crime-effect evidence, a balanced timeline, a Georgia step and a
Fulton step in place of one Atlanta zoom, the map's source on screen, an honest retention scale (no invented
upload time; Evidence Mode past a break), a share of cameras with any operator recorded before the breakdown
by type, and about 20 style and phone fixes. All are in. A further pass over the reference pages found the
Claims page widening a phone's layout to 648 pixels; a test now checks every page at 360 pixels.

A second round of both followed. The critique found county colours the legend did not show (counties are now
drawn in their exact class colour, with the least populated hatched), a ladder title the data contradicted,
an errors figure that gave a chart only to the Flock case, map labels and legends colliding with the map,
and see-through phone cards; the fact-check found the installation fees, Dallas's switch-off and a timeline
date wrong, and about 15 smaller points. All are corrected and listed in `docs/fact-check.md`. A third
critique found all but one of its earlier items resolved and asked for the phone map to sit wholly above the
cards, larger type in the phone teaser, state names on the phone completeness chart, dots clipped to the map's
panel, grey states around Georgia and Times place names ("Houston", "Oakland, Calif."); those are in too.
A fourth found those resolved and four small points, now fixed: the map draws only the 50 states and D.C., so its
credit and every note give the same 188 Flock cameras elsewhere; the Fulton label says "Flock cameras"; phone
labels keep their full wording on two lines; and the legend no longer clips Washington.

## 8. October 9: the reference pages to the story's standard

### The gap

After four reviews the story set a standard the eight reference pages did not meet. They had taken the
editorial look in the first October pass but had never been through a review. Captures at 1,440 by 900 pixels
showed no chart on the first screen of Deployments, Economics or Outcomes. Heads were catalog labels
("Pricing and cost structure", "Data path in twelve stages"), decks were tables of contents, and method text
came before any finding; on a phone the head and the method text filled the first screen. Section heads were
built five different ways, and one page jumped from its `h1` to an `h3`. An audit against the corrected story
found reference text that still said what the story had corrected: hot lists, how fast an alert arrives, the
default retention period, Texas's funding, the Los Angeles audit, the crime study (22 corrections, listed in
the fourth table of `docs/fact-check.md`). A style audit counted 186 departures from Times style, most of them
straight quotes in content text that the story's renderer would have curled.

### One head for every page

`src/content/pages.json` holds each page's kicker, headline, deck and opening figure. The headline states the
page's main finding where the page has one ("Houston Has the Most Mapped Flock Cameras, and Texas Helped Pay
for Thousands") and says plainly what the page holds where it does not ("The 14 Parts Inside a Flock Camera").
Decks use the story's markup: Houston's count is a `{{stat}}` token that resolves against the built data, and
a source is a link the build checks. The Vite plugin that prerenders the story writes each page's head, title,
share tags and opening figure into its HTML, so the first screen reads without JavaScript, and the source
checker renders all eight heads on every build. A dateline under the deck gives the date of the latest data or
source check and links to the notes on the data, which moved from the top of each page to the bottom.

The opening figures: Deployments starts on the 15 cities with the most mapped Flock cameras; Economics on the
story's price chart; Data on the story's scale of seconds to an alert and days to deletion, in place of a row
of retention chips; Outcomes on a chart of its 74 records by source, one square each, marked by whether it
lies within 150 meters of a mapped camera; Claims on an index of the verdicts; Sources on a bar of the sources by origin. Components keeps its parts grid and Journey
its parcel slip.

### Fewer one-off drawings

Where a page had its own version of something the story already drew, it now uses the story's figure: the
price history, the retention scale, the three ways an alert can be wrong, and the one documented search,
which replaced a form that asked the reader to type a search reason. Figures that a page draws in the browser
read the build's numbers from a small JSON block in the page instead of loading the story's data file; that
took the Outcomes page's JavaScript from 99 KB, against a budget of 100, to 91.

### Phones

The phone drawing of every chart, the story's included, was 360 pixels wide and scaled down to the column, so
on a 360-pixel phone, whose column is 328 pixels, a 12-pixel label rendered at 10.9. Every phone drawing is now
made at 328 pixels and scales up on larger phones, the practice of designing for the smallest container first.
The sweep and a Playwright test measure the size at which every chart label renders on a phone (its font size
times the drawing's scale) and fail below 11 pixels. Two charts that had been drawn once at load and never at
the phone width, the cities and the fee schedule, are now drawn at both.

### Times style, by test

Content now passes through one step at load, `typeset()`, that curls the quotes and apostrophes in every
string except identifiers: ids, URLs and part numbers such as `401-00027-3 "Cassowary CCB"` stay as written.
Chart labels, tooltips and table cells take the same step. A Playwright test reads every page's visible text,
title, share tags and labels, and fails on straight quotes, ISO dates, "%" in running text, a postal code after
a city, British spellings, spelled-out numbers from 10 up, "US" or "Inc" without points, and "ACLU," "FBI" or
"AI" without them; one exception, a module's product name, is listed in `tests/style-allow.json`. The source
checker's list of banned words now covers every content file. Section heads are one `h2` style, the story's,
and a test checks that no page skips a heading level.

### The Components locator

The 3D locator could open as an empty grey panel: it reported itself ready when the models had loaded, before
their shaders had compiled, so its first frames drew nothing. It now shows the assembled still until the scene
has drawn a frame. Its camera poses were tuned by hand and left the exploded stack small; the camera is now
fitted to the projected boxes of the parts at each stage, keeping the hand-tuned direction with an 8 percent
margin, and a test checks that the camera fills at least 55 percent of the panel's height at rest and the
exploded stack at least 65 percent of the panel's width or height, without leaving the panel. The lens still was a black
disc, a dark glass circle seen end on; it is now rendered three-quarters on in the browser from the site's own
model (`scripts/still-part.mjs`), since Blender was not available to re-render it.

### Reviews

Each page then went through the story's loop: captures at 1,440, 390 and 360 pixels, read by an independent
graphics critique against the story's captures, and an independent fact-check that traced every number, name
and date in the heads, decks, figure titles, notes and table cells to a source. The fact-checks found 39 things
to correct, listed in the fifth table of `docs/fact-check.md`. Some were dates and counts (Lexington's totals
run from 2022 with no end date; Los Angeles's inventory is 298 pole cameras, 138 of them Flock's). Some were
claims a source did not make: no camera counts for Piedmont or Lafayette, no cipher or cloud region for
Flock's storage. Some were a source made to say more than it did: a case-number requirement Flock announced
for the end of the year, not one in force. Eighteen bibliography entries that nothing on the site cited were
removed.

The graphics critiques changed most on Outcomes. Its agency chart had used six shades of amber for six steps,
with no values and with dots on top of each other. It is now one line per department on a logarithmic scale,
from the first count it reported to the last, labeled in words ("210.6 million reads to 74 arrests"), with
open circles for reads and alerts and solid ones for results. Its national map had borrowed the city maps'
key, which called the gray dots "other makes"; each map now has its own key. On phones its eight-column tables
had to be swiped sideways and cut their notes off mid-sentence; they are now cards. Elsewhere: Claims' middle
verdict is "The record is mixed," defined on the page; Components got drawings of the mount, the power
options and the field of view; and the Journey's sources show under each stop instead of in a tooltip.

### Decisions

- **The plate-cover claim stays.** "A plate cover or spray defeats it" is one of the 21 claims. The entry
  reports what the record shows (Flock records a covered or missing plate as an attribute of the vehicle, and
  states regulate plate covers) and describes no method; removing it would also have changed the count of
  claims across the site.
- **Two snapshots, said once.** The outcome records stay matched to the July 17, 2026, camera map, when most of
  them were compiled; the national map on the same page shows the Oct. 8 count. The notes on the Outcomes page
  say so, and Windsor, whose cameras left the map in between, is the example.
- **The data scripts were not re-run.** Rebuilding the story's data would have re-pinned the camera snapshot that
  the story and the fact-check ledger rest on.
- **Old addresses kept.** Anchors that redirects and tests use (`#claim-*`, `#stage-*`, `#src-*`, `#pole`,
  `#power`) kept their names through the rebuild.

## 9. Numbers for the article

| What | Figure |
|---|---|
| Pages | 9 (home, deployments, components, data, journey, outcomes, claims, economics, sources) |
| Commits | 55, Sept. 4 to Oct. 9, 2026 |
| Bibliography rows | 182, tagged flock, independent, government or court |
| Content files | 15 JSON files validated by schema at build |
| 3D models | 4 GLB files from parametric Blender scripts |
| Stills | 26 rendered images |
| Playwright tests | 22 |
| Sweep | 9 pages at 10 sizes (6 desktop, 4 phone including one held sideways), zero findings at each push |
| Mapped cameras, story | 143,929 readers, 115,437 Flock (Oct. 8, 2026) |
| Mapped cameras, outcomes | 116,723 readers, 96,484 Flock (July 17, 2026, the snapshot the records were matched against) |
| Outcome locations | 74 tied to fixed cameras, 55 placed, 21 within 150 m of a mapped camera |
| Claims checked in the October fact-checks | about 250 on the home page, in two independent passes; every number on the eight reference pages, in two more |
| Corrections from the reference pages' reviews | 22 in the fourth review, 39 in the fifth |
| Home page weight before the first scroll | about 480 KB compressed, of which 13 KB JavaScript and 278 KB the map's camera file (`scripts/budget.mjs`) |
