import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Tier } from "./store";

export interface Boot {
  engine: AbstractEngine;
  backend: "webgpu" | "webgl2";
  tier: Tier;
}

function guessTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (mobile && (mem <= 4 || cores <= 4)) return "low";
  if (mobile || mem <= 8) return "mid";
  return "high";
}

/** Prefer WebGPU, fall back to WebGL2. Query ?gl=1 forces the fallback for testing. */
export async function bootEngine(canvas: HTMLCanvasElement): Promise<Boot> {
  const tier = guessTier();
  const forceGL = new URLSearchParams(location.search).has("gl");
  const dpr = tier === "low" ? Math.min(devicePixelRatio, 1.25) : Math.min(devicePixelRatio, 2);
  if (!forceGL) {
    try {
      const ok = await WebGPUEngine.IsSupportedAsync;
      // Refuse software or fallback adapters (SwiftShader, headless): WebGL2 is faster and stable there.
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ isFallbackAdapter?: boolean; info?: { vendor?: string; architecture?: string } } | null> } }).gpu;
      const adapter = gpu ? await gpu.requestAdapter().catch(() => null) : null;
      const software = !adapter || adapter.isFallbackAdapter === true || /swiftshader|llvmpipe|software/i.test(`${adapter.info?.vendor ?? ""} ${adapter.info?.architecture ?? ""}`);
      if (ok && !software) {
        const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: false, powerPreference: "high-performance" });
        await engine.initAsync();
        engine.setHardwareScalingLevel(1 / dpr);
        return { engine, backend: "webgpu", tier };
      }
    } catch (e) {
      console.warn("WebGPU init failed, falling back to WebGL2", e);
    }
  }
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: false, powerPreference: "high-performance", preserveDrawingBuffer: false, stencil: true }, false);
  engine.setHardwareScalingLevel(1 / dpr);
  return { engine, backend: "webgl2", tier };
}
