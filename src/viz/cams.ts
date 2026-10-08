/**
 * Reader for `cams.bin`, every mapped plate reader pre-projected by scripts/story/build.mjs (Albers USA in a
 * 1000 x 620 frame). Layout after gunzip: "FLK1", count (u32), frame width and height (u16 each), 4 bytes spare;
 * then the x steps, the y steps (u16 each, zig-zagged, wrapping modulo 65,536) and one class byte per point
 * (0 Flock, 1 another make, 2 no make tagged).
 */
export interface Cams { n: number; w: number; h: number; x: Float32Array; y: Float32Array; cls: Uint8Array }

export function decodeCams(buf: ArrayBuffer): Cams {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== "FLK1") throw new Error(`cams.bin: unexpected header ${magic}`);
  const n = dv.getUint32(4, true), w = dv.getUint16(8, true), h = dv.getUint16(10, true);
  if (buf.byteLength !== 16 + n * 5) throw new Error(`cams.bin: ${buf.byteLength} bytes for ${n} points`);
  const x = new Float32Array(n), y = new Float32Array(n);
  const cls = new Uint8Array(buf, 16 + n * 4, n).slice();
  const sx = w / 65535, sy = h / 65535;
  let qx = 0, qy = 0;
  for (let i = 0; i < n; i++) {
    const a = dv.getUint16(16 + i * 2, true), b = dv.getUint16(16 + n * 2 + i * 2, true);
    qx = (qx + ((a >>> 1) ^ -(a & 1))) & 0xffff;
    qy = (qy + ((b >>> 1) ^ -(b & 1))) & 0xffff;
    x[i] = qx * sx; y[i] = qy * sy;
  }
  return { n, w, h, x, y, cls };
}

/** Fetch and decode, gunzipping in the browser when the server sent the file as stored bytes. */
export async function loadCams(url: string): Promise<Cams> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cams.bin: HTTP ${res.status}`);
  let buf = await res.arrayBuffer();
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    buf = await new Response(stream).arrayBuffer();
  }
  return decodeCams(buf);
}
