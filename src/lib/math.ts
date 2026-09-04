export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inchesToM = (inches: number) => inches * 0.0254;
export const feetToM = (ft: number) => ft * 0.3048;
export const degToRad = (d: number) => (d * Math.PI) / 180;
/** Map global progress p in [a,b] to 0..1 */
export const window01 = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
