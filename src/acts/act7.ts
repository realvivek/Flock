import { renderSources } from "../ui/article";

/** Act 7: the bibliography, grouped by origin. */
export function initAct7(): void {
  renderSources(document.getElementById("sources")!);
}
