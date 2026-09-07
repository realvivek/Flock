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
  /** Pins sharing a layout group are placed in alternating bands above and below their anchors and nudged apart. */
  group?: string;
}

/** HTML labels pinned to 3D points with SVG leader lines. Labels stay in the DOM for accessibility. */
export class PinLayer {
  private host = document.getElementById("pins")!;
  private svg = document.getElementById("leaders") as unknown as SVGSVGElement;
  private pins = new Map<string, { spec: PinSpec; el: HTMLDivElement; line: SVGLineElement; dot: SVGCircleElement; visible: boolean; alpha: number; sx: number; sy: number; w: number }>();
  private tmp = new Vector3();

  /** Screen-space extent (CSS px) of the visible anchors in a layout group, from the last update; null if none. */
  groupBox(group: string): { left: number; right: number; top: number; bottom: number } | null {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, n = 0;
    for (const p of this.pins.values()) {
      if (p.spec.group !== group || p.alpha < 0.5) continue;
      left = Math.min(left, p.sx); right = Math.max(right, p.sx); top = Math.min(top, p.sy); bottom = Math.max(bottom, p.sy); n++;
    }
    return n ? { left, right, top, bottom } : null;
  }

  add(spec: PinSpec): void {
    if (this.pins.has(spec.id)) return;
    const el = document.createElement("div");
    el.className = `pin ${spec.cls ?? ""}`;
    el.innerHTML = `<span class="k">${spec.k}</span> <span class="v">${spec.v}</span>`;
    this.host.appendChild(el);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "rgba(17,19,24,0.5)");
    line.setAttribute("stroke-width", "1");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", spec.cls?.includes("cyan") ? "#1b4fd8" : "#d9911f");
    this.svg.appendChild(line);
    this.svg.appendChild(dot);
    this.pins.set(spec.id, { spec, el, line, dot, visible: false, alpha: 0, sx: 0, sy: 0, w: 0 });
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

  /** `leftBound` is the right edge of the text panel in CSS px; labels are kept to its right. */
  update(scene: Scene, camera: Camera, leftBound = 0): void {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    const ease = 1 - Math.exp(-dt / 0.12);
    const w = scene.getEngine().getRenderWidth();
    const h = scene.getEngine().getRenderHeight();
    const cssW = innerWidth, cssH = innerHeight;
    const vp = new Viewport(0, 0, w, h);
    const view = camera.getViewMatrix();
    const proj = camera.getProjectionMatrix();
    const narrow = cssW < 800;
    // Pass 1: project anchors and fade.
    const live: typeof this.pins extends Map<string, infer V> ? V[] : never = [];
    for (const p of this.pins.values()) {
      const target = p.visible ? 1 : 0;
      p.alpha += (target - p.alpha) * ease;
      if (p.alpha < 0.02) { p.el.classList.remove("is-visible"); p.el.style.opacity = "0"; p.line.setAttribute("opacity", "0"); p.dot.setAttribute("opacity", "0"); continue; }
      const a = p.spec.anchor();
      Vector3.ProjectToRef(a, Matrix.IdentityReadOnly, view.multiply(proj), vp, this.tmp);
      const behind = this.tmp.z > 1 || this.tmp.z < 0;
      p.sx = (this.tmp.x / w) * cssW; p.sy = (this.tmp.y / h) * cssH;
      if (behind || p.sx < -50 || p.sx > cssW + 50 || p.sy < -50 || p.sy > cssH + 50) { p.alpha = 0.02; p.el.style.opacity = "0"; p.line.setAttribute("opacity", "0"); p.dot.setAttribute("opacity", "0"); continue; }
      if (!p.w) p.w = p.el.offsetWidth || 140;
      live.push(p);
    }
    // Pass 2: layout. Each grouped pin takes the nearest free slot above or below its own anchor
    // (alternating sides, up to six lanes, small horizontal shifts), clamped to the viewport and kept
    // clear of the text panel, so leaders stay short and every label stays on screen. Ungrouped pins
    // use their fixed offsets, clamped the same way.
    const H = 26;
    const minY = 56 + H / 2 + 6, maxY = cssH - H / 2 - 10;
    const clampX = (x: number, w: number) => Math.max(leftBound + w / 2 + 8, Math.min(cssW - w / 2 - 8, x));
    const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
    const placed = new Map<typeof live[number], { lx: number; ly: number }>();
    const groups = new Map<string, typeof live>();
    for (const p of live) {
      if (p.spec.group) { const g = groups.get(p.spec.group) ?? []; g.push(p); groups.set(p.spec.group, g); }
      else {
        const lx = narrow ? Math.max(70, Math.min(cssW - 70, p.sx + (p.spec.dx ?? 90) * 0.5)) : clampX(p.sx + (p.spec.dx ?? 90), p.w);
        placed.set(p, { lx, ly: clampY(p.sy + (p.spec.dy ?? -60)) });
      }
    }
    for (const g of groups.values()) {
      g.sort((a, b) => a.sx - b.sx);
      const rects: { x: number; y: number; w: number }[] = [];
      const overlaps = (x: number, y: number, w: number) => rects.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 + 8 && Math.abs(r.y - y) < H + 4);
      g.forEach((p, i) => {
        const sides = i % 2 === 0 ? [-1, 1] : [1, -1];
        type Slot = { lx: number; ly: number; cost: number };
        let best: Slot | null = null;
        for (const side of sides) {
          for (let lane = 0; lane < 6; lane++) {
            const ly = p.sy + side * (46 + lane * 30);
            if (ly < minY || ly > maxY) continue;
            for (let k = 0; k <= 2; k++) {
              for (const dir of k === 0 ? [0] : [-1, 1]) {
                const lx = clampX(p.sx + dir * k * (p.w / 2 + 14), p.w);
                if (overlaps(lx, ly, p.w)) continue;
                const cost = lane * 30 + Math.abs(lx - p.sx) * 1.4 + (side === sides[0] ? 0 : 25);
                if (best === null || cost < (best as Slot).cost) best = { lx, ly, cost };
              }
            }
            if (best !== null && (best as Slot).cost <= lane * 30 + 40) break;
          }
          if (best !== null && (best as Slot).cost <= 70) break;
        }
        const slot: Slot = best ?? { lx: clampX(p.sx, p.w), ly: clampY(p.sy - 46), cost: 0 };
        rects.push({ x: slot.lx, y: slot.ly, w: p.w });
        placed.set(p, { lx: slot.lx, ly: slot.ly });
      });
    }
    for (const p of live) {
      const pos = placed.get(p)!;
      const alpha = narrow && pos.ly > cssH * 0.4 ? 0 : p.alpha;
      p.el.style.opacity = String(alpha);
      p.el.classList.toggle("is-visible", alpha > 0.02);
      p.el.style.transform = `translate(${pos.lx.toFixed(1)}px, ${pos.ly.toFixed(1)}px) translate(-50%, -50%)`;
      p.line.setAttribute("x1", p.sx.toFixed(1)); p.line.setAttribute("y1", p.sy.toFixed(1));
      p.line.setAttribute("x2", pos.lx.toFixed(1)); p.line.setAttribute("y2", pos.ly.toFixed(1));
      p.line.setAttribute("opacity", String(alpha));
      p.dot.setAttribute("cx", p.sx.toFixed(1)); p.dot.setAttribute("cy", p.sy.toFixed(1));
      p.dot.setAttribute("opacity", String(alpha));
    }
  }
}
