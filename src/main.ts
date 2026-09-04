/** Entry: phones (or ?mode=stills) get the stills stepper with no 3D engine; everything else loads the scene. */
const params = new URLSearchParams(location.search);
const stills = params.get("mode") === "stills" || (params.get("mode") !== "3d" && matchMedia("(max-width: 800px)").matches);

if (stills) {
  import("./mobile/stepper").then(({ initStepper }) => initStepper());
} else {
  import("./desktop").then(({ startDesktop }) => startDesktop());
}
