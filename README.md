# Anatomy of a Flock camera

A scroll-driven 3D reference for a Flock Safety license plate reader: the pole and mount, the enclosure and each component, the power and network connections, the data path from capture to deletion, common claims against the public record, and pricing and contract terms. All copy states facts from cited public documents.

It is written for a technical audience: installers who need dimensions, mount heights and power options; residents and officials who need to know what is collected, who can access it, and what it costs; and anyone checking a claim against the record.

## What is in it

| Act | Content |
|---|---|
| 0 · Street | A Flock pole at real scale on a dusk roadside |
| 1 · Pole | Installer callouts: pole, clamps, panel, battery, base, ladder limit; a draggable aim with the published field of view drawn on the road; Flock pole / existing pole / 120 V AC toggle |
| 2 · Inside | The Falcon V2 enclosure separates and fourteen components explode in order, each with a spec card, part number and vendor |
| 3 · Power and cable | Solar and battery DC path, the AC kit, and the Wing gateway path in which PoE, fiber and SFP modules are used, with cutaways |
| 4 · Data | One detection traced through twelve stages from capture to deletion, a retention slider, and a network search example reproducing the counts from one documented query |
| 5 · Claims | A single-column article: twenty-one common claims, each with the documented position, the product or setting it applies to, sources, and a link to the related component or data stage |
| 6 · Economics | An article: items included in and excluded from the annual fee, list prices, the 2021 and 2026 fee schedules, price history, installation workflow and responsibilities, permitting by location type, ownership and contract terms, scale and public funding, with a priced-pole figure |
| 7 · Sources | An article: all sources grouped by origin, with the date each was last checked |

Acts 5 to 7 are plain articles on a paper sheet; the 3D scene fades out behind them and stops rendering.

## Phones

Screens under 800 px wide (or any screen with `?mode=stills`) get a stepper instead of the 3D scene: one screen per state, with a pre-rendered still on top, the same copy, specs and citations, Back and Next, chapter chips, swipe and arrow keys, and deep links of the form `?s=inside/13`. Claims, Economics and Sources are single scrolling article pages rather than slides (`?s=myths/0`, `?s=economics/0`, `?s=sources/0`), rendered by the same code as the desktop acts (`src/ui/article.ts`). Phones never download the engine; the JavaScript for that path is about 60 KB. `?mode=3d` forces the scene on a small screen.

The stills come from the same models as the scene. `src/content/stills.json` lists every state; `npm run stills` renders them with Cycles into `public/stills` (about 26 images, WebP, 15 to 90 KB each). The source checker refuses to build if a listed still is missing, so the manifest and the images cannot drift apart.

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
```

Debug views for checking the models: `?view=falcon`, `?view=pole`, `?view=wing` (orbit with `a`, `b`, `r` for alpha, beta, radius). Presets for screenshots: `?pole=existing|ac`, `?path=solar|ac|wing`, `?focus=<part id>`, `?aim=<yaw>,<pitch>`, `?gl` forces WebGL2, `?mode=stills|3d` forces the phone or desktop path. `scripts/shoot.mjs` captures screenshots headlessly; stops are page fractions or `act:progress`.

## Models

The 3D models are generated, not hand-modelled: `tools/blender/*.py` build every part with Blender's Python API from the dimensions in `src/content/components.json` and `src/content/install.json`, so a corrected measurement in the content file changes the geometry. Rebuild with:

```
pip install bpy      # Blender as a Python module (Python 3.11)
npm run models
```

Part naming follows the content file (`falcon.ledboard`, `falcon.som`, and so on), which is what the exploded view drives. Dimensions marked "estimated" in the content are sized from the published envelope and teardown photographs; the enclosure, pole and panel dimensions are Flock's own published figures.

## Stack

Vite, TypeScript, Babylon.js 9 (WebGPU with a WebGL2 fallback), GSAP ScrollTrigger for scroll scrubbing, Zod for content validation, Playwright for the smoke tests. Text lives in the DOM for accessibility and search; the canvas only carries the scene. `prefers-reduced-motion` switches the scroll scrub to stepped states. The ground is a white blueprint sheet: a faint blue hairline grid with dotted majors on the page, and the same grid on the scene floor so the two read as one surface. Type is Archivo for headings, IBM Plex Sans for body and IBM Plex Mono for labels.

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
