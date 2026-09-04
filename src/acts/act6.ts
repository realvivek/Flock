import { renderEconomics } from "../ui/article";

/** Act 6: the economics article. Tables and rows from economics.json, with the priced pole as a figure. */
export function initAct6(): void {
  renderEconomics(document.getElementById("economics")!);
}
