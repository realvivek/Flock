import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";

export interface PinSpec {
  id: string;
  /** world-space anchor, evaluated every frame */
  anchor: () => Vector3;
  k: string;
  v: string;
  /** 2D label offset in px from the anchor */
  dx?: number;
  dy?: number;
  cls?: string;
}

/** HTML labels pinned to 3D points with SVG leader lines. Labels stay in the DOM for accessibility. */
export class PinLayer {
  private host = document.getElementById("pins")!;
  private svg = document.getElementById("leaders") as unknown as SVGSVGElement;
  private pins = new Map<string, { spec: PinSpec; el: HTMLDivElement; line: SVGLineElement; dot: SVGCircleElement; visible: boolean; alpha: number }>();
  private tmp = new Vector3();

  add(spec: PinSpec): void {
    if (this.pins.has(spec.id)) return;
    const el = document.createElement("div");
    el.className = `pin ${spec.cls ?? ""}`;
    el.innerHTML = `<span class="k">${spec.k}</span> <span class="v">${spec.v}</span>`;
    this.host.appendChild(el);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "rgba(232,237,242,0.55)");
    line.setAttribute("stroke-width", "1");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", spec.cls?.includes("cyan") ? "#4fd1e6" : "#f2b441");
    this.svg.appendChild(line);
    this.svg.appendChild(dot);
    this.pins.set(spec.id, { spec, el, line, dot, visible: false, alpha: 0 });
  }

  set(id: string, patch: Partial<Pick<PinSpec, "k" | "v">>): void {
    const p = this.pins.get(id);
    if (!p) return;
    if (patch.k !== undefined) p.spec.k = patch.k;
    if (patch.v !== undefined) p.spec.v = patch.v;
    p.el.innerHTML = `<span class="k">${p.spec.k}</span> <span class="v">${p.spec.v}</span>`;
  }

  show(id: string, on: boolean): void {
    const p = this.pins.get(id);
    if (p) p.visible = on;
  }

  showOnly(ids: Iterable<string>): void {
    const keep = new Set(ids);
    for (const [id, p] of this.pins) p.visible = keep.has(id);
  }

  hideAll(): void {
    for (const p of this.pins.values()) p.visible = false;
  }

  update(scene: Scene, camera: Camera): void {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    const ease = 1 - Math.exp(-dt / 0.12);
    const w = scene.getEngine().getRenderWidth();
    const h = scene.getEngine().getRenderHeight();
    const cssW = innerWidth, cssH = innerHeight;
    const vp = new Viewport(0, 0, w, h);
    const view = camera.getViewMatrix();
    const proj = camera.getProjectionMatrix();
    for (const p of this.pins.values()) {
      const target = p.visible ? 1 : 0;
      p.alpha += (target - p.alpha) * ease;
      if (p.alpha < 0.02) { p.el.classList.remove("is-visible"); p.el.style.opacity = "0"; p.line.setAttribute("opacity", "0"); p.dot.setAttribute("opacity", "0"); continue; }
      const a = p.spec.anchor();
      Vector3.ProjectToRef(a, Matrix.IdentityReadOnly, view.multiply(proj), vp, this.tmp);
      const behind = this.tmp.z > 1 || this.tmp.z < 0;
      const x = (this.tmp.x / w) * cssW, y = (this.tmp.y / h) * cssH;
      // On phones the lower part of the viewport is text; only show labels that land above it.
      const narrow = cssW < 800;
      const off = behind || x < -50 || x > cssW + 50 || y < -50 || y > cssH + 50 || (narrow && y + (p.spec.dy ?? -60) > cssH * 0.4);
      const alpha = off ? 0 : p.alpha;
      const lx = narrow ? Math.max(70, Math.min(cssW - 70, x + (p.spec.dx ?? 90) * 0.5)) : x + (p.spec.dx ?? 90), ly = y + (p.spec.dy ?? -60);
      p.el.style.opacity = String(alpha);
      p.el.classList.toggle("is-visible", alpha > 0.02);
      p.el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -50%)`;
      p.line.setAttribute("x1", x.toFixed(1)); p.line.setAttribute("y1", y.toFixed(1));
      p.line.setAttribute("x2", lx.toFixed(1)); p.line.setAttribute("y2", ly.toFixed(1));
      p.line.setAttribute("opacity", String(alpha));
      p.dot.setAttribute("cx", x.toFixed(1)); p.dot.setAttribute("cy", y.toFixed(1));
      p.dot.setAttribute("opacity", String(alpha));
    }
  }
}
