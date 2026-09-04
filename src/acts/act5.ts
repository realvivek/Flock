import { renderClaims } from "../ui/article";
import { set } from "../store";

/** Act 5: the claims article. Related-component links scroll to act 2 and focus the part; stage links scroll into act 4. */
export function initAct5(): void {
  renderClaims(document.getElementById("myths")!, {
    onPart: (id) => { document.getElementById("act-2")?.scrollIntoView({ behavior: "smooth" }); setTimeout(() => set({ focusedPart: id }), 900); },
    onHop: (n) => {
      const sec = document.getElementById("act-4")!;
      const top = sec.offsetTop + (sec.offsetHeight - innerHeight) * (0.06 + ((n - 0.5) / 12) * 0.8);
      scrollTo({ top, behavior: "smooth" });
    },
  });
}
