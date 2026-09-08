# Anatomy of a Flock camera

A reference for a Flock Safety license plate reader: the pole and mount, the enclosure and each component, the power and network connections, the data path from capture to deletion, common claims against the public record, and pricing and contract terms. All copy states facts from cited public documents.

It is written for a technical audience: installers who need dimensions, mount heights and power options; residents and officials who need to know what is collected, who can access it, and what it costs; and anyone checking a claim against the record.

## What is in it

Nine pages. The home page is a summary: the title and lede, a preview image of the components grid with a link to it, and one card per page. The header on every page carries Home and the eight pages, with the current one marked; each page ends with previous and next links, and a Top button appears once scrolled.

| Page | Content |
|---|---|
| Home (`/`) | The lede, the components preview and a summary card for each page |
| Deployments (`deployments/`) | Documented cameras by city as a bar chart, the largest public contracts by agency and level with values and terms, the public funding behind local contracts, where the records are, and what is not documented |
| Components (`components/`) | The fourteen parts of the Falcon V2 laid out in a grid at a consistent scale, in five groups: Shell, Optics, Compute, Radios, Mount. Selecting a part opens its record under its group (function, specification, part number, vendor, sources and the related data stage) and writes the part into the address (`components/#som`). On desktops that can run a 3D engine, a locator beside the grid shows the assembled camera see-through, frames the selected part, and has a slider that separates the parts front to back; other screens show the assembled still |
| Pole (`pole/`) | Three mount configurations (Flock pole, existing pole, 120 V AC) as cards with the still and the documented facts, and the published field of view |
| Power (`power/`) | The solar and battery DC path, the AC kit, and the Wing gateway path in which PoE, fiber and SFP modules are used |
| Data (`data/`) | One detection traced through twelve stages from capture to deletion, each with a diagram, the processing location, transport, storage, retention and payload; retention presets; a network search example reproducing the counts from one documented query |
| Claims (`claims/`) | The product line (Falcon, Flex, Sparrow, Condor, Raven, Wing, Alpha, Nova) as a table, then twenty-one common claims, each with the documented position, the product or setting it applies to, sources, and a link to the related component or data stage |
| Economics (`economics/`) | Items included in and excluded from the annual fee, list prices, the 2021 and 2026 fee schedules, price history, installation workflow and responsibilities, permitting by location type, ownership and contract terms, scale and public funding, with a priced-pole figure |
| Sources (`sources/`) | All sources grouped by origin, with the date each was last checked |

Citation chips on any page open the Sources page at the cited row. Claims link to `components/#<part id>` and `data/#stage-N`. Older single-page links (`#/hardware/inside/13`, `#act-4`, `#deployments`, `#s=inside/13`, `?s=data/9`, `#src-<id>`) still resolve to the page, part, stage or row they named.

## Phones

Phones get the same pages. The header links wrap into two rows so all nine stay visible, the components grid is two columns, the locator is the assembled still, and the pole, power and data cards stack. Phones never download the 3D engine; the JavaScript for that path is about 60 KB. `?mode=3d` forces the locator on a small screen, `?mode=stills` forces the still on a desktop. If no 3D engine can start on a desktop (no WebGL 2 or WebGPU, or the context is lost), the locator falls back to the still; `?fail3d` simulates that.

The stills come from the same models as the scene. `src/content/stills.json` lists every state; `npm run stills` renders them with Cycles into `public/stills` (about 26 images, WebP, 15 to 90 KB each). The source checker refuses to build if a listed still is missing, so the manifest and the images cannot drift apart. The preview image of the grid on the home page is `public/img/knolling.jpg`, rendered from the components page by `node scripts/knolling.mjs` against a preview server.

## Sourcing policy

Every number and claim on the page comes from `src/content/*.json`, and every entry there carries a `sources` array pointing into `src/content/sources.json`. Sources are tagged `flock` (the company's own documents), `independent` (teardowns, research, journalism), `government` or `court`. The UI shows the tag next to each citation so a reader can distinguish a Flock statement from an independently documented one. Statements not published by Flock and not verified independently are marked "not verified".

Citation chips open the Sources page at the cited row; the row is marked so the landing point is visible among the rows. Bibliography titles open the original document in a new tab.

`npm run check:sources` fails the build if any claim lacks a source, references an unknown source id, or if any source is missing a URL, date or `lastVerified` stamp. `npm run check:links` fetches every source URL and reports dead links; a few publishers (Forbes, Denverite, the Institute for Justice, GlobeNewswire, ilsos.gov) answer 403 or 503 to scripted requests and are verified by hand.

Facts about this system move monthly. If something here is out of date, open an issue with a source.

## Running it

```
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # runs check:sources, then a production build into dist/
npm run preview    # serves dist/ at http://127.0.0.1:4173
npm test           # Playwright smoke test against the preview server
node scripts/qa.mjs test-results/qa   # viewport sweep of every page: five desktop sizes and three phones, reports anything cut off, off screen or unclickable
```

`?gl` forces WebGL2, `?mode=stills|3d` forces the still or the locator. `scripts/shoot.mjs` captures screenshots headlessly of whichever page the url names; stops are element ids with an optional state, for example `components:som` (selects a part on `components/`), `components:stage=5` (explode stage of the locator), `stage-9` (on `data/`). The locator's camera pose lives in `src/content/animation.json` under `views.inside`.

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
