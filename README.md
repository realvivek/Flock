# Anatomy of a Flock camera

An interactive, scroll-driven 3D explainer of a Flock Safety license plate reader: the pole and how it is installed, the enclosure taken apart board by board, what plugs into it, and where every byte goes after the photograph is taken.

It is built for three readers at once: an installer who needs dimensions, mount heights and power options; a resident who wants to know what is collected and who can see it; and a council member who needs the myth-versus-fact answer with a citation.

## What is in it

| Act | What you see |
|---|---|
| 0 · Street | A Flock pole at real scale on a dusk roadside |
| 1 · Pole | Installer callouts: pole, clamps, panel, battery, base, ladder limit; a draggable aim with the published field of view drawn on the road; Flock pole / existing pole / 120 V AC toggle |
| 2 · Inside | The Falcon V2 shell splits and thirteen parts separate in order, each with a spec card, part number and vendor |
| 3 · Power and cable | Solar and battery DC path, the AC kit, and the Wing gateway path where PoE, fiber and SFP modules actually appear, with cutaways |
| 4 · Data | One detection followed through twelve hops from photons to an officer's phone, a retention slider, and a "be the deputy" nationwide search reproducing one documented query |
| 5 · Myths | Twenty-one common claims with a verdict, the nuance, and a link back to the part or hop that settles each |
| 6 · Sources | Every source, tagged by origin, with the date it was last checked |

## Sourcing policy

Every number and claim on the page comes from `src/content/*.json`, and every entry there carries a `sources` array pointing into `src/content/sources.json`. Sources are tagged `flock` (the company's own documents), `independent` (teardowns, research, journalism), `government` or `court`. The UI shows the tag next to each citation so a reader can tell a marketing claim from a documented fact. Where nobody outside Flock has verified something, the page says "unknown" rather than guessing.

`npm run check:sources` fails the build if any claim lacks a source, references an unknown source id, or if any source is missing a URL, date or `lastVerified` stamp. `npm run check:links` fetches every source URL and reports dead links.

Facts about this system move monthly. If something here is out of date, open an issue with a source.

## Running it

```
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # runs check:sources, then a production build into dist/
npm run preview    # serves dist/ at http://127.0.0.1:4173
npm test           # Playwright smoke test against the preview server
```

Debug views for checking the models: `?view=falcon`, `?view=pole`, `?view=wing` (orbit with `a`, `b`, `r` for alpha, beta, radius). Presets for screenshots: `?pole=existing|ac`, `?path=solar|ac|wing`, `?focus=<part id>`, `?aim=<yaw>,<pitch>`, `?gl` forces WebGL2.

## Models

The 3D models are generated, not hand-modelled: `tools/blender/*.py` build every part with Blender's Python API from the dimensions in `src/content/components.json` and `src/content/install.json`, so a corrected measurement in the content file changes the geometry. Rebuild with:

```
pip install bpy      # Blender as a Python module (Python 3.11)
npm run models
```

Part naming follows the content file (`falcon.ledboard`, `falcon.som`, and so on), which is what the exploded view drives. Dimensions marked "estimated" in the content are sized from the published envelope and teardown photographs; the enclosure, pole and panel dimensions are Flock's own published figures.

## Stack

Vite, TypeScript, Babylon.js 9 (WebGPU with a WebGL2 fallback), GSAP ScrollTrigger for scroll scrubbing, Zod for content validation, Playwright for the smoke test. Text lives in the DOM for accessibility and search; the canvas only carries the scene. `prefers-reduced-motion` switches the scroll scrub to stepped states.

## Scope

This is an explainer. It is not a map of camera locations (see [DeFlock](https://deflock.org)), it does not look up plates, and it does not tell anyone how to defeat a camera.

## License

Code is MIT. The generated models under `public/models` and the Blender scripts that produce them are CC BY 4.0. Flock, Falcon, Condor, Raven, Wing and Sparrow are trademarks of their owner and are used here descriptively.
