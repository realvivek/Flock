# How this site was built

A working record of the project from the first commit on 4 September 2026 to the outcomes page on
23 September 2026: what each page shows, how it was made, what went wrong, and what was learned.
It is written as reference material for a later article. Figures come from the repository itself
(commit history, content files, scripts) and from the research notes gathered during the work.

## 1. Ground rules

Five rules shaped every decision and held for the whole project.

**Evidence first.** Every number and claim on the site lives in a JSON file under `src/content/`, and every
entry there carries a `sources` array pointing into one bibliography, `src/content/sources.json`. Each source
is tagged by origin: `flock` (the company's own documents), `independent` (teardowns, research, journalism),
`government` or `court`. The build refuses to run if a cited source id does not exist (`scripts/check-sources.ts`)
or if a listed still image is missing. The bibliography grew from about 60 rows at the start to 176 by the
end. Statements from Flock and from independent sources are shown with different tags so a reader can tell
them apart, and where the two disagree, both are cited.

**Neutral copy.** No adjectives that judge. A camera that reads a plate "reads a plate"; an audit that found
71% of alerts wrong is reported with the denominator and the agency's own explanation.

**Nothing ships unverified.** Before each push: TypeScript typecheck, a production build, the Playwright
suite (five tests that exercise every page, the citation chips, the 3D locator, phones and the no-3D
fallback), a viewport sweep (`scripts/qa.mjs`) of every page at five desktop and three phone sizes that
reports horizontal overflow, cut-off text, failed images, header and pager problems, and screenshots read by
eye at desktop and phone widths. The sweep produced findings at almost every stage; the rule was zero
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

### Home

The home page went through four forms: the top of one long scroll, a splash of cards above tabs, the head of
one scrolling document with a preview image, and finally a summary page. In its final form it carries the
title and lede, a preview of the components grid and a preview of the journey page, each a link, and one
numbered card per page from `overview.json`. Older links to the single-page site (`#act-4`,
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
example reproducing the counts from one documented query: a Texas deputy's April 2025 search that reached
83,345 cameras in 6,809 networks.

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
table. Economics: list prices, what the annual fee includes and excludes, fee schedules then and now, price
history from $182 per camera in 2019 to $3,000, installation workflow, permitting, contract terms, scale and
public funding, with a priced-pole figure. Sources: every row grouped by origin with the date last checked.

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
- **Fonts and privacy.** The pages still load fonts from a third party; self-hosting them is listed as an
  improvement.
- **Background work and restarts.** Long runs were pushed to the background with logs; the caches they wrote
  were the only thing that survived a container restart, and they were enough.
- **Approval gates.** Larger changes were planned in a plan file first and approved before implementation;
  when the environment interrupted mid-task, the plan file carried the state across the gap.

## 7. Numbers for the article

| What | Figure |
|---|---|
| Pages | 9 (home, deployments, components, data, journey, outcomes, claims, economics, sources) |
| Commits | 29, 4 to 23 September 2026 |
| Bibliography rows | 176, tagged flock, independent, government or court |
| Content files | 12 JSON files validated by schema at build |
| 3D models | 4 GLB files from parametric Blender scripts |
| Stills | 26 rendered images |
| Playwright tests | 5, covering every page, citations, the locator, phones and the no-3D fallback |
| Sweep | 9 pages at 8 sizes (5 desktop, 3 phone), zero findings at each push |
| Mapped cameras | 116,723 readers, 96,484 tagged Flock |
| Outcome locations | 239 with a published record; 220 placed; 32 within 150 m of a mapped camera |
| Research behind the outcomes page | 3 surveys, about 300 searches and fetches, about 45 papers and reports reviewed |
