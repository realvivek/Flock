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
  /** 2D label offset in px from the anchor (text pins) */
  dx?: number;
  dy?: number;
  cls?: string;
  /** Text pins sharing a layout group are placed in free slots around their anchors and nudged apart. */
  group?: string;
  /** Badge pins: a numbered disc at the anchor, no leader; `halo` names the group whose parts share a halo. */
  badge?: boolean;
  halo?: string;
  /** Callback for hover and click on a badge */
  onHover?: (on: boolean) => void;
  onClick?: () => void;
}

interface Pin { spec: PinSpec; el: HTMLDivElement; line: SVGLineElement | null; dot: SVGCircleElement | null; visible: boolean; alpha: number; sx: number; sy: number; bx: number; by: number; w: number }

export interface HaloSpec { id: string; caption: string; parts: string[] }

/** HTML labels pinned to 3D points. Text pins get SVG leader lines; badge pins are numbered discs, grouped by halos. */
export class PinLayer {
  private host = document.getElementById("pins")!;
  private svg = document.getElementById("leaders") as unknown as SVGSVGElement;
  private pins = new Map<string, Pin>();
  private halos = new Map<string, { spec: HaloSpec; rect: SVGRectElement; text: SVGTextElement; show: boolean; hl: boolean }>();
  private tmp = new Vector3();
  private lastSlots = new Map<string, { lx: number; ly: number }>();
  /** When true, text pins reuse their last slots (camera in motion). */
  freeze = false;
  private _dots = false;
  /** Dot mode: badges render as small markers at their anchors and are not nudged apart (cutaway view). */
  get dots(): boolean { return this._dots; }
  set dots(v: boolean) { this._dots = v; this.host.classList.toggle("is-dots", v); }

  /** Screen-space extent (CSS px) of the visible anchors in a layout group or halo, from the last update; null if none. */
  groupBox(group: string): { left: number; right: number; top: number; bottom: number } | null {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity, n = 0;
    for (const p of this.pins.values()) {
      if ((p.spec.group !== group && p.spec.halo !== group && !(group === "parts" && p.spec.badge)) || p.alpha < 0.5) continue;
      left = Math.min(left, p.sx); right = Math.max(right, p.sx); top = Math.min(top, p.sy); bottom = Math.max(bottom, p.sy); n++;
    }
    return n ? { left, right, top, bottom } : null;
  }

  add(spec: PinSpec): void {
    if (this.pins.has(spec.id)) return;
    const el = document.createElement("div");
    let line: SVGLineElement | null = null, dot: SVGCircleElement | null = null;
    if (spec.badge) {
      el.className = `pin badge ${spec.cls ?? ""}`;
      el.innerHTML = `<span class="k">${spec.k}</span>`;
      el.title = spec.v;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${spec.k} ${spec.v}`);
      el.addEventListener("pointerenter", () => spec.onHover?.(true));
      el.addEventListener("pointerleave", () => spec.onHover?.(false));
      el.addEventListener("focus", () => spec.onHover?.(true));
      el.addEventListener("blur", () => spec.onHover?.(false));
      el.addEventListener("click", () => spec.onClick?.());
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); spec.onClick?.(); } });
    } else {
      el.className = `pin ${spec.cls ?? ""}`;
      el.innerHTML = `<span class="k">${spec.k}</span> <span class="v">${spec.v}</span>`;
      line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("stroke", "rgba(17,19,24,0.5)");
      line.setAttribute("stroke-width", "1");
      dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", spec.cls?.includes("cyan") ? "#1b4fd8" : "#d9911f");
      this.svg.appendChild(line);
      this.svg.appendChild(dot);
    }
    this.host.appendChild(el);
    this.pins.set(spec.id, { spec, el, line, dot, visible: false, alpha: 0, sx: 0, sy: 0, bx: 0, by: 0, w: 0 });
  }

  /** Register a halo: a rounded box around a group of badge pins with a caption. */
  addHalo(spec: HaloSpec): void {
    if (this.halos.has(spec.id)) return;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "halo");
    rect.setAttribute("rx", "14"); rect.setAttribute("ry", "14");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "halo-caption");
    text.textContent = spec.caption;
    this.svg.insertBefore(rect, this.svg.firstChild);
    this.svg.appendChild(text);
    this.halos.set(spec.id, { spec, rect, text, show: false, hl: false });
  }

  setHaloHighlight(id: string | null): void {
    for (const [hid, h] of this.halos) h.hl = hid === id;
  }

  set(id: string, patch: Partial<Pick<PinSpec, "k" | "v">>): void {
    const p = this.pins.get(id);
    if (!p) return;
    if (patch.k !== undefined) p.spec.k = patch.k;
    if (patch.v !== undefined) p.spec.v = patch.v;
    if (p.spec.badge) { p.el.querySelector(".k")!.textContent = p.spec.k; p.el.title = p.spec.v; }
    else p.el.innerHTML = `<span class="k">${p.spec.k}</span> <span class="v">${p.spec.v}</span>`;
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

  /** Mark a badge as highlighted (hover from the legend). */
  highlight(id: string | null): void {
    for (const [pid, p] of this.pins) if (p.spec.badge) p.el.classList.toggle("is-hl", pid === id);
  }

  /** `leftBound`/`rightBound` are the edges of the free band in CSS px; labels are kept inside it. */
  update(scene: Scene, camera: Camera, leftBound = 0, rightBound = innerWidth): void {
    const dt = Math.min(0.1, scene.getEngine().getDeltaTime() / 1000);
    const ease = 1 - Math.exp(-dt / 0.12);
    const w = scene.getEngine().getRenderWidth();
    const h = scene.getEngine().getRenderHeight();
    const cssW = innerWidth, cssH = innerHeight;
    const cssR = Math.min(cssW, rightBound);
    const vp = new Viewport(0, 0, w, h);
    const view = camera.getViewMatrix();
    const proj = camera.getProjectionMatrix();
    const narrow = cssW < 800;
    const hide = (p: Pin) => { p.el.classList.remove("is-visible"); p.el.style.opacity = "0"; p.line?.setAttribute("opacity", "0"); p.dot?.setAttribute("opacity", "0"); };
    // Pass 1: project anchors and fade.
    const live: Pin[] = [];
    for (const p of this.pins.values()) {
      const target = p.visible ? 1 : 0;
      p.alpha += (target - p.alpha) * ease;
      if (p.alpha < 0.02) { hide(p); continue; }
      const a = p.spec.anchor();
      Vector3.ProjectToRef(a, Matrix.IdentityReadOnly, view.multiply(proj), vp, this.tmp);
      const behind = this.tmp.z > 1 || this.tmp.z < 0;
      p.sx = (this.tmp.x / w) * cssW; p.sy = (this.tmp.y / h) * cssH;
      if (behind || p.sx < -50 || p.sx > cssW + 50 || p.sy < -50 || p.sy > cssH + 50) { p.alpha = 0.02; hide(p); continue; }
      if (!p.w) p.w = p.el.offsetWidth || (p.spec.badge ? 20 : 140);
      live.push(p);
    }
    // Pass 2a: badges. Start at the anchor; nudge badges of the same halo apart when closer than 22 px.
    const badges = live.filter((p) => p.spec.badge);
    for (const p of badges) { p.bx = p.sx; p.by = p.sy; }
    for (let iter = 0; iter < (this._dots ? 0 : 6); iter++) {
      for (let i = 0; i < badges.length; i++) for (let j = i + 1; j < badges.length; j++) {
        const a = badges[i]!, b = badges[j]!;
        let dx = b.bx - a.bx, dy = b.by - a.by;
        let d = Math.hypot(dx, dy);
        if (d >= 22) continue;
        if (d < 0.01) { dx = 0; dy = 1; d = 1; }
        const push = (22 - d) / 2;
        a.bx -= (dx / d) * push; a.by -= (dy / d) * push; b.bx += (dx / d) * push; b.by += (dy / d) * push;
      }
    }
    for (const p of badges) {
      p.bx = Math.max(leftBound + 12, Math.min(cssR - 12, p.bx));
      p.by = Math.max(60, Math.min(cssH - 12, p.by));
      p.el.style.opacity = String(p.alpha);
      p.el.classList.toggle("is-visible", p.alpha > 0.02);
      p.el.style.transform = `translate(${p.bx.toFixed(1)}px, ${p.by.toFixed(1)}px) translate(-50%, -50%)`;
    }
    // Pass 2b: halos around badge groups: bounding box of badge positions, padded; a group wider than 40 %
    // of the free width is drawn per part instead so the box never spans the scene.
    const freeW = Math.max(1, cssR - leftBound);
    for (const hl of this.halos.values()) {
      const members = badges.filter((p) => p.spec.halo === hl.spec.id && p.alpha > 0.5);
      if (members.length === 0 || !hl.show) { hl.rect.setAttribute("opacity", "0"); hl.text.setAttribute("opacity", "0"); continue; }
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      for (const m of members) { l = Math.min(l, m.bx); r = Math.max(r, m.bx); t = Math.min(t, m.by); b = Math.max(b, m.by); }
      if (r - l > freeW * 0.4 && members.length > 1) {
        // split: draw the box only around the first member's badge; others get none this frame
        const m = members[0]!; l = r = m.bx; t = b = m.by;
      }
      const pad = 22;
      const x = l - pad, y = t - pad, bw = Math.max(44, r - l + pad * 2), bh = Math.max(44, b - t + pad * 2);
      hl.rect.setAttribute("x", x.toFixed(1)); hl.rect.setAttribute("y", y.toFixed(1));
      hl.rect.setAttribute("width", bw.toFixed(1)); hl.rect.setAttribute("height", bh.toFixed(1));
      hl.rect.setAttribute("opacity", "1");
      hl.rect.classList.toggle("is-hl", hl.hl);
      hl.text.setAttribute("x", (x + 10).toFixed(1)); hl.text.setAttribute("y", (y - 7).toFixed(1));
      hl.text.setAttribute("opacity", "1");
    }
    // Pass 2c: text pins, as before: nearest free slot above or below the anchor, clamped to the viewport.
    const H = 26;
    const minY = 56 + H / 2 + 6, maxY = cssH - H / 2 - 10;
    const clampX = (x: number, w0: number) => Math.max(leftBound + w0 / 2 + 8, Math.min(cssR - w0 / 2 - 8, x));
    const clampY = (y: number) => Math.max(minY, Math.min(maxY, y));
    const placed = new Map<Pin, { lx: number; ly: number }>();
    const groups = new Map<string, Pin[]>();
    for (const p of live) {
      if (p.spec.badge) continue;
      if (p.spec.group) { const g = groups.get(p.spec.group) ?? []; g.push(p); groups.set(p.spec.group, g); }
      else {
        const lx = narrow ? Math.max(70, Math.min(cssW - 70, p.sx + (p.spec.dx ?? 90) * 0.5)) : clampX(p.sx + (p.spec.dx ?? 90), p.w);
        placed.set(p, { lx, ly: clampY(p.sy + (p.spec.dy ?? -60)) });
      }
    }
    for (const g of groups.values()) {
      g.sort((a, b) => a.sx - b.sx);
      const rects: { x: number; y: number; w: number }[] = [];
      const overlaps = (x: number, y: number, w0: number) => rects.some((r) => Math.abs(r.x - x) < (r.w + w0) / 2 + 8 && Math.abs(r.y - y) < H + 4);
      g.forEach((p, i) => {
        const prev = this.freeze ? this.lastSlots.get(p.spec.id) : undefined;
        if (prev) { rects.push({ x: prev.lx, y: prev.ly, w: p.w }); placed.set(p, prev); return; }
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
        this.lastSlots.set(p.spec.id, { lx: slot.lx, ly: slot.ly });
      });
    }
    for (const p of live) {
      if (p.spec.badge) continue;
      const pos = placed.get(p)!;
      const alpha = narrow && pos.ly > cssH * 0.4 ? 0 : p.alpha;
      p.el.style.opacity = String(alpha);
      p.el.classList.toggle("is-visible", alpha > 0.02);
      p.el.style.transform = `translate(${pos.lx.toFixed(1)}px, ${pos.ly.toFixed(1)}px) translate(-50%, -50%)`;
      p.line!.setAttribute("x1", p.sx.toFixed(1)); p.line!.setAttribute("y1", p.sy.toFixed(1));
      p.line!.setAttribute("x2", pos.lx.toFixed(1)); p.line!.setAttribute("y2", pos.ly.toFixed(1));
      p.line!.setAttribute("opacity", String(alpha));
      p.dot!.setAttribute("cx", p.sx.toFixed(1)); p.dot!.setAttribute("cy", p.sy.toFixed(1));
      p.dot!.setAttribute("opacity", String(alpha));
    }
  }

  /** Screen position of a badge (CSS px) from the last update, or null when hidden. */
  badgePos(id: string): { x: number; y: number } | null {
    const p = this.pins.get(id);
    if (!p || !p.spec.badge || p.alpha < 0.05) return null;
    return { x: p.bx, y: p.by };
  }

  /** Show or hide a halo. */
  showHalo(id: string, on: boolean): void {
    const h = this.halos.get(id);
    if (h) h.show = on;
  }
}
