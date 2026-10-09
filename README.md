# Anatomy of a Flock camera

A data story and a reference on Flock Safety's license plate readers: where the mapped cameras are, what one read records, who can search it, what the reads produce, what the cameras cost and what changed in 2026, followed by reference pages on the pole and mount, each component, the data path from capture to deletion, outcomes, common claims against the public record, and pricing and contract terms. All copy states facts from cited public documents.

It is written for a technical audience: installers who need dimensions, mount heights and power options; residents and officials who need to know what is collected, who can access it, and what it costs; and anyone checking a claim against the record.

## What is in it

Nine pages. The home page is a long-form story with a scroll-driven map and annotated figures, ending with one card per page. Each of the eight reference pages opens the same way: a kicker, a headline that states the page's main finding, a deck, the date the data was last updated with a link to the notes on the data, and a framed figure on the first screen; the full record follows in sections, and the notes close the page. The heads come from one file, `src/content/pages.json`, and are written into each page's HTML at build time, so they read without JavaScript. The header on every page carries Home and the eight pages, with the current one marked; each page ends with previous and next links, and a Top button appears once scrolled.

| Page | Content |
|---|---|
| Home (`/`) | "Inside the Network of Cameras Reading America's License Plates": a map of every mapped plate reader in five scroll steps (Flock's share, county rates, Georgia, Fulton County), a county lookup, what one read records, how long it is kept, who can search it, Oakland's and three departments' outcome counts, the evidence on crime, three ways an alert goes wrong, prices and contracts, a 2026 timeline, cards for every page, and how it was made |
| Deployments (`deployments/`) | "Houston Has the Most Mapped Flock Cameras, and Texas Helped Pay for Thousands": mapped Flock cameras in the 15 cities with the most (25 in the table), then who pays (Texas's insurance-fee grants drawn as a flow, with Dallas's cameras counted out in squares; Florida state grants; federal awards), the largest public contracts by year and by agency with values and terms, what is not public, and where the records are |
| Components (`components/`) | "The 14 Parts of a Flock Camera": the order of the parts from the front of the case to the back, then the parts of the Falcon V2 in a grid, in five groups: Shell, Optics, Compute, Radios, Mount. Selecting a part opens its record under its group (function, specification, part number, vendor, sources and the related data stage) and writes the part into the address (`components/#som`). On desktops that can run a 3D engine, a locator beside the grid shows the assembled camera see-through, frames the selected part, and has a slider that separates the parts front to back; it shows the assembled still until the 3D scene has drawn its first frame, and fits the camera to its panel at every stage of the slider. Other screens show the still. Below the parts: the three mount configurations (Flock pole, existing pole, 120 V AC) as cards with a drawing to scale and the documented facts, and the power paths (solar and battery DC, the AC kit, the Wing gateway with PoE, fiber and SFP). `pole/` and `power/` redirect here |
| Data (`data/`) | "What Happens to a Plate Read, From the Camera to Deletion": seconds to an alert and days to deletion on one scale, with Flock's default and the state limits; then one detection traced through 12 stages beside a diagram of the path that lights the stage being read, each with the processing location, transport, storage, retention and payload; one documented network search (the Johnson County, Texas, sheriff's search that reached 83,345 cameras in 6,809 networks); and notes on the data |
| Journey (`journey/`) | "Tracking One Photograph From a Flock Camera to Deletion": one photograph followed like a parcel through seven stops from the pole to deletion: what is in the package at each stop, who can open it, how long it takes, and, folded under a toggle on each stop, the details, the data-path stages and the sources behind it |
| Outcomes (`outcomes/`) | "Few Agencies Publish What Their Flock Cameras Produce": the 74 published records of a result by source, marked by whether each lies within 150 meters of a mapped camera, then every public record found that ties a Flock camera to a result, on six shared rungs (reads, alerts, wrong alerts, stops, recoveries, arrests): per agency (each department's counts on one logarithmic scale, then a table that becomes cards on a phone), whether the cameras reduce crime and when an alert is wrong (the story's figures), per camera site (a national map, then Nashville's pilot table, Story County's report of wrong hits, Tucson dispatch calls, Windsor's named cases, a court opinion and news reports naming the road, three of them with city maps), and the national statements tagged by who makes them; each located record is joined to the nearest mapped camera with the distance shown. Notes on the data close the page |
| Claims (`claims/`) | "21 Common Claims About Flock Cameras, Checked Against the Public Record": an index of the verdicts, then each claim with the documented position, the product or setting it applies to, sources, and a link to the related component or data stage; the product line (Falcon, Flex, Sparrow, Condor, Raven, Wing, Alpha, Nova) as a table; and how the verdicts were assigned |
| Economics (`economics/`) | "A Flock Camera Lists at $3,000 a Year, and Flock Keeps the Hardware": the annual price per camera in contracts and price lists (the story's chart), what the annual fee covers and what is billed separately (with the priced pole), the 2026 schedule of fees for changes after installation, list prices, price history, ownership and contract terms, installation and permits, the company, what is not public, and notes on the data |
| Sources (`sources/`) | "182 Sources, From Flock's Own Documents to Court Records" (the count is computed at build): the sources by origin, then every row grouped by origin with the date each was last checked, and how the sources are tagged |

Citation chips on any page open the Sources page at the cited row. Claims link to `components/#<part id>` and `data/#stage-N`. Older single-page links (`#/hardware/inside/13`, `#act-4`, `#deployments`, `#s=inside/13`, `?s=data/9`, `#src-<id>`) still resolve to the page, part, stage or row they named.

## Phones

Phones get the same pages. The header links wrap into two rows so all nine stay visible; the story's map takes the top of the screen with the step cards below it, and every chart has a layout drawn for a phone at 328 pixels, the column of a 360-pixel screen, so no chart text renders smaller than 11 pixels (the sweep and a test measure it); the components grid is two columns, the locator is the assembled still, and the pole, power and data cards stack. Phones never download the 3D engine; the JavaScript for that path is about 60 KB. `?mode=3d` forces the locator on a small screen, `?mode=stills` forces the still on a desktop. If no 3D engine can start on a desktop (no WebGL 2 or WebGPU, or the context is lost), the locator falls back to the still; `?fail3d` simulates that.

The stills come from the same models as the scene. `src/content/stills.json` lists every state; `npm run stills` renders them with Cycles into `public/stills` (about 26 images, WebP, 15 to 90 KB each). The lens is the exception: seen end on it is a black disc, so `node scripts/still-part.mjs lens` renders it in the browser from the site's own model, three-quarters on and alone on a transparent background, against a running preview server (its job in the manifest is `browser`, which the Blender script skips). The source checker refuses to build if a listed still is missing, so the manifest and the images cannot drift apart. The preview images on the home page are `public/img/knolling.jpg` and `public/img/journey.jpg`, 4:3 images of whole tiles with no small print; the journey preview has a phone version with larger type (`public/img/journey-phone.jpg`, `--phone`). They are rendered from the components and journey pages by `node scripts/knolling.mjs` and `node scripts/journey.mjs` against a preview server.

## The story's data

`node scripts/story/fetch.mjs` downloads the inputs and records each in `data/story/manifest.json` (URL, size, SHA-256, ETag); `node scripts/story/build.mjs` builds everything the story draws into `public/data/story/`: the packed camera file for the map (`cams.bin`), state and county boundaries, counties with counts and rates, operators, the Atlanta basemap and labels, the comparison with published city counts, the CSV downloads, and `stats.json`, which holds every number the story's text uses with its source ids. The camera snapshot is DeFlock's hourly tile archive of OpenStreetMap plate readers, read on Oct. 8, 2026; population and boundaries are the Census Bureau's 2024 releases. The story itself is `src/content/story.json` (paragraphs, map steps and figure titles, notes and sources), rendered into `index.html` at build time. Every number in it is listed with its source in [docs/fact-check.md](docs/fact-check.md).

## Sourcing policy

Every number and claim on the page comes from `src/content/*.json`, and every entry there carries a `sources` array pointing into `src/content/sources.json`. Sources are tagged `flock` (the company's own documents), `independent` (teardowns, research, journalism), `government` or `court`. The UI shows the tag next to each citation so a reader can distinguish a Flock statement from an independently documented one. Statements not published by Flock and not verified independently are marked "not verified".

Citation chips open the Sources page at the cited row; the row is marked so the landing point is visible among the rows. Bibliography titles open the original document in a new tab.

`npm run check:sources` fails the build if any claim lacks a source, references an unknown source id, or if any source is missing a URL, date or `lastVerified` stamp; it also renders the story and the head of every reference page and fails on an unknown source, an unknown number or a banned word. `tests/style.spec.ts` reads every page's visible text, title and labels for Times style (curly quotes, AP dates and state names, numerals from 10, "percent" in prose, American spelling); the few deliberate exceptions are listed in `tests/style-allow.json`. `npm run check:links` fetches every source URL and reports dead links; a few publishers (Forbes, Denverite, the Institute for Justice, GlobeNewswire, ilsos.gov) answer 403 or 503 to scripted requests and are verified by hand.

Facts about this system move monthly. If something here is out of date, open an issue with a source.

## Running it

```
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # runs check:sources, then a production build into dist/
npm run preview    # serves dist/ at http://127.0.0.1:4173
npm test           # Playwright tests against the preview server
node scripts/qa.mjs test-results/qa   # viewport sweep of every page: six desktop sizes and four phones (one held sideways), reports anything cut off, off screen or unclickable
node scripts/budget.mjs               # what each page downloads before the reader scrolls, against its budget
node scripts/shots.mjs shots --pages home --figures   # screenshots of each map step and each figure, for review by eye
```

The outcomes data is built by `node scripts/outcomes/build.mjs [cameras.geojson]`: it reads the hand-entered and fetched records under `data/outcomes/sources/`, downloads the deflock-data camera export unless a file is given, locates intersections through Overpass (the node the two named roads share, cached in `data/outcomes/overpass-cache.json`) and Nominatim, joins every located record to the nearest mapped camera, and writes `public/data/outcomes.json` and the city basemaps under `public/data/basemaps/`. `OVERPASS_OFFLINE=1` rebuilds from the caches alone. `?map=off` on the page skips the camera scatter.

`?gl` forces WebGL2, `?mode=stills|3d` forces the still or the locator. `scripts/shoot.mjs` captures screenshots headlessly of whichever page the url names; stops are element ids with an optional state, for example `components:som` (selects a part on `components/`), `components:stage=5` (explode stage of the locator), `stage-9` (on `data/`). The locator's camera pose lives in `src/content/animation.json` under `views.inside`.

## Models

The 3D models are generated, not hand-modelled: `tools/blender/*.py` build every part with Blender's Python API from the dimensions in `src/content/components.json` and `src/content/install.json`, so a corrected measurement in the content file changes the geometry. Rebuild with:

```
pip install bpy      # Blender as a Python module (Python 3.11)
npm run models
```

Part naming follows the content file (`falcon.ledboard`, `falcon.som`, and so on), which is what the exploded view drives. Dimensions marked "estimated" in the content are sized from the published envelope and teardown photographs; the enclosure, pole and panel dimensions are Flock's own published figures.

## Stack

Vite, TypeScript, Babylon.js 9 (WebGPU with a WebGL2 fallback) for the locator, Zod for content validation, topojson-client and d3-interpolate for the story's map, Playwright for the tests. Each page loads its own code on demand; the home page's script is a few kilobytes on top of a story that is already in the HTML. Text lives in the DOM for accessibility and search; the canvases carry only the story's map and the locator. Charts are SVG drawn at build time, at a desktop and a phone width; the figures a reference page draws in the browser read the build's numbers from a small JSON block in that page (`#site-data`), so they agree with the story without loading its data. `prefers-reduced-motion` turns transitions into jumps and turns off smooth scrolling. The page is plain white with one amber accent; type is Newsreader for headlines and text, Libre Franklin for charts and labels and IBM Plex Mono for part numbers, all served from the site.

## Deploy

Two targets, both from `main`.

**Render** (the way the other repos deploy): a static site that runs
`npm ci && npm run build` and publishes `dist/`. `render.yaml` is the blueprint
for connecting the repo through the Render dashboard (New Blueprint Instance,
pick the repo and `main`). `.github/workflows/deploy-render.yml` does the same
through the Render REST API and needs a `RENDER_API_KEY` repository secret; its
first run creates the service, every run after triggers a deploy and waits for
the live URL to answer cleanly five times in a row. A service created through
the API never reads `render.yaml`, so both carry the same settings. Once the
service exists, autoDeploy means every push to `main` deploys.

**GitHub Pages**: `.github/workflows/pages.yml` builds and deploys on every push
to `main` at https://realvivek.github.io/Flock/. This one is a build, not a
branch-served folder, so the repository's Pages source has to be set to
"GitHub Actions" once under Settings, Pages.

## Scope

This is an explainer. Its map shows where volunteers have recorded cameras, from DeFlock's copy of OpenStreetMap, as of one date; it is not a live map (see [DeFlock](https://deflock.org)), it does not look up plates, and it does not tell anyone how to avoid or defeat a camera.

## How it was built

A working record of the process, page by page, with the outcomes page and the October story in most detail: [docs/process.md](docs/process.md). Every number in the story, with its source: [docs/fact-check.md](docs/fact-check.md).

## License

Code is MIT. The generated models under `public/models` and the Blender scripts that produce them are CC BY 4.0. Camera positions © OpenStreetMap contributors, under the Open Database License; the files under `public/data/story/` derived from them are under the same license. Flock, Falcon, Condor, Raven, Wing and Sparrow are trademarks of their owner and are used here descriptively.
