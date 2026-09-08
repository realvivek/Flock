# Anatomy of a Flock camera

A reference for a Flock Safety license plate reader: the pole and mount, the enclosure and each component, the power and network connections, the data path from capture to deletion, common claims against the public record, and pricing and contract terms. All copy states facts from cited public documents.

It is written for a technical audience: installers who need dimensions, mount heights and power options; residents and officials who need to know what is collected, who can access it, and what it costs; and anyone checking a claim against the record.

## What is in it

Two pages. The main page is one scroll: it opens with a preview of the components grid and a link to the components page, then the sections below; section links in the header jump to each section and mark the one in view, and a Top button returns to the start. The components page (`components/`) holds the grid on its own, with the same header links pointing back to the main page's sections.

| Section | Content |
|---|---|
| Deployments | An article: documented cameras by city as a bar chart, the largest public contracts by agency and level with values and terms, the public funding behind local contracts, where the records are, and what is not documented |
| Components (`components/`) | Its own page: the fourteen parts of the Falcon V2 laid out in a grid at a consistent scale, in five groups: Shell, Optics, Compute, Radios, Mount. Selecting a part opens its record under its group (function, specification, part number, vendor, sources and the related data stage) and writes the part into the address (`components/#som`). On desktops that can run a 3D engine, a locator beside the grid shows the assembled camera see-through, frames the selected part, and has a slider that separates the parts front to back; other screens show the assembled still |
| Pole | Three mount configurations (Flock pole, existing pole, 120 V AC) as cards with the still and the documented facts, and the published field of view |
| Power | The solar and battery DC path, the AC kit, and the Wing gateway path in which PoE, fiber and SFP modules are used |
| Data | One detection traced through twelve stages from capture to deletion, each with a diagram, the processing location, transport, storage, retention and payload; retention presets; a network search example reproducing the counts from one documented query |
| Claims | An article: the product line (Falcon, Flex, Sparrow, Condor, Raven, Wing, Alpha, Nova) as a table, then twenty-one common claims, each with the documented position, the product or setting it applies to, sources, and a link to the related component or data stage |
| Economics | An article: items included in and excluded from the annual fee, list prices, the 2021 and 2026 fee schedules, price history, installation workflow and responsibilities, permitting by location type, ownership and contract terms, scale and public funding, with a priced-pole figure |
| Sources | All sources grouped by origin, with the date each was last checked |

Links are plain anchors (`#data`, `#stage-9`, `#src-<id>`, `#claim-<id>`) and `components/#<part id>`. Older links (`#/hardware/inside/13`, `#act-4`, `#s=inside/13`, `?s=data/9`) still resolve to the page, section, part or stage they named.

## Phones

Phones get the same two pages. The section links become a scrolling rail, the components grid is two columns, the locator is the assembled still, and the pole, power and data cards stack. Phones never download the 3D engine; the JavaScript for that path is about 60 KB. `?mode=3d` forces the locator on a small screen, `?mode=stills` forces the still on a desktop. If no 3D engine can start on a desktop (no WebGL 2 or WebGPU, or the context is lost), the locator falls back to the still; `?fail3d` simulates that.

The stills come from the same models as the scene. `src/content/stills.json` lists every state; `npm run stills` renders them with Cycles into `public/stills` (about 26 images, WebP, 15 to 90 KB each). The source checker refuses to build if a listed still is missing, so the manifest and the images cannot drift apart. The preview image of the grid at the top of the main page is `public/img/knolling.jpg`, rendered from the components page by `node scripts/knolling.mjs` against a preview server.

## Sourcing policy

Every number and claim on the page comes from `src/content/*.json`, and every entry there carries a `sources` array pointing into `src/content/sources.json`. Sources are tagged `flock` (the company's own documents), `independent` (teardowns, research, journalism), `government` or `court`. The UI shows the tag next to each citation so a reader can distinguish a Flock statement from an independently documented one. Statements not published by Flock and not verified independently are marked "not verified".

Citation chips jump to the bibliography row (on phones they open the Sources page at that row); the row flashes so the landing point is visible. Bibliography titles open the original document in a new tab.

`npm run check:sources` fails the build if any claim lacks a source, references an unknown source id, or if any source is missing a URL, date or `lastVerified` stamp. `npm run check:links` fetches every source URL and reports dead links; a few publishers (Forbes, Denverite, the Institute for Justice, GlobeNewswire, ilsos.gov) answer 403 or 503 to scripted requests and are verified by hand.

Facts about this system move monthly. If something here is out of date, open an issue with a source.

## Running it

```
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # runs check:sources, then a production build into dist/
npm run preview    # serves dist/ at http://127.0.0.1:4173
npm test           # Playwright smoke test against the preview server
node scripts/qa.mjs test-results/qa   # viewport sweep: five desktop sizes and three phones, reports anything cut off, off screen or unclickable
```

`?gl` forces WebGL2, `?mode=stills|3d` forces the still or the locator. `scripts/shoot.mjs` captures screenshots headlessly of whichever page the url names; stops are section ids with an optional state, for example `components:som` (selects a part, on `components/`), `components:stage=5` (explode stage of the locator), `data:9` (scrolls to stage 9 on the main page). The locator's camera pose lives in `src/content/animation.json` under `views.inside`.

## Models

The 3D models are generated, not hand-modelled: `tools/blender/*.py` build every part with Blender's Python API from the dimensions in `src/content/components.json` and `src/content/install.json`, so a corrected measurement in the content file changes the geometry. Rebuild with:

```
pip install bpy      # Blender as a Python module (Python 3.11)
npm run models
```

Part naming follows the content file (`falcon.ledboard`, `falcon.som`, and so on), which is what the exploded view drives. Dimensions marked "estimated" in the content are sized from the published envelope and teardown photographs; the enclosure, pole and panel dimensions are Flock's own published figures.

## Stack

Vite, TypeScript, Babylon.js 9 (WebGPU with a WebGL2 fallback) for the locator, Zod for content validation, Playwright for the smoke tests. Text lives in the DOM for accessibility and search; the canvas only carries the locator, and renders only while it is on screen. Camera moves and stage changes are 600 ms eased tweens; `prefers-reduced-motion` makes them instant and turns off smooth scrolling. The ground is a white blueprint sheet: a faint blue hairline grid with dotted majors on the page, and the same grid on the scene floor so the two read as one surface. Type is Archivo for headings, IBM Plex Sans for body and IBM Plex Mono for labels.

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

This is an explainer. It is not a map of camera locations (see [DeFlock](https://deflock.org)), it does not look up plates, and it does not tell anyone how to defeat a camera.

## License

Code is MIT. The generated models under `public/models` and the Blender scripts that produce them are CC BY 4.0. Flock, Falcon, Condor, Raven, Wing and Sparrow are trademarks of their owner and are used here descriptively.
