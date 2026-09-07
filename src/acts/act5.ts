import { renderClaims } from "../ui/article";
import { set } from "../store";
import { navigate } from "../router";

/** Claims tab. Component links open the Inside stage fully exploded with the part isolated; stage links open the Data tab at that stage. */
export function initAct5(): void {
  renderClaims(document.getElementById("myths")!, {
    onPart: (id) => { navigate({ tab: "hardware", sub: "inside" }); set({ explodeStage: 5, focusedPart: id }); },
    onHop: (n) => { navigate({ tab: "data" }); set({ dataStage: n }); },
  });
}
