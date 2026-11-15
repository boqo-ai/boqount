#!/usr/bin/env node
// Traces a brand's PNG logo into one SVG path, so the mark is exact at any size (kit/Logo3D.tsx extrudes it; a film
// draws it crisp at 4× zoom). Pure Node, no dependency: the PNG is decoded here, the mark's outline followed pixel edge
// by pixel edge and simplified. With --potrace and the `potrace` command installed, potrace traces it instead (curves,
// not straight segments).
//
//   node <skill>/tools/trace-png.mjs <logo.png> [--out <mark.svg>] [--json <mark.json>] [--threshold 0..255] [--tolerance px] [--potrace]
//
// What is the mark: a PNG with transparency is traced on its alpha (a pixel more than half opaque is ink); one with
// none, on how far each pixel's colour is from the background, read from the four corners (--threshold, default 96,
// is that distance). Holes (the inside of an "o") stay holes: the path is filled even-odd.
// --tolerance (default 0.5 px) is how far a simplified outline may stray from the pixel edges.
// --out writes the SVG (viewBox = the PNG's size, the path filled in currentColor); --json writes
// {"d", "width", "height"} for a film to import. Prints one JSON line: {"width", "height", "contours", "points",
// "engine", "out", "json"}, or exits 1 with {"error": …}. The tests are tests/trace-png.test.mjs.
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: trace-png.mjs <logo.png> [--out <mark.svg>] [--json <mark.json>] [--threshold 0..255] [--tolerance px] [--potrace]";
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// ---------------------------------------------------------------- PNG

/** Decodes a PNG into { width, height, rgba: Uint8Array, alpha: boolean }. Every colour type, bit depth 1–16;
 * interlaced files too. */
export function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG file");
  let pos = 8;
  let ihdr = null;
  let palette = null;
  let trns = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === "IHDR") ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (!ihdr) throw new Error("the PNG has no header");
  const { width, height, depth, color, interlace } = ihdr;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  if (!channels) throw new Error(`unknown PNG colour type ${color}`);
  if (color === 3 && !palette) throw new Error("a palette PNG with no palette");
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8Array(width * height * 4);
  const bpp = Math.max(1, (channels * depth) >> 3); // bytes per pixel for the filter
  const max = (1 << depth) - 1;

  // one pass (the whole image, or one Adam7 sub-image) of w × h pixels, written at (x0 + i·dx, y0 + j·dy)
  let at = 0;
  const pass = (w, h, x0, y0, dx, dy) => {
    if (w === 0 || h === 0) return;
    const stride = Math.ceil((w * channels * depth) / 8);
    let prev = new Uint8Array(stride);
    for (let j = 0; j < h; j++) {
      const filter = raw[at++];
      const line = Uint8Array.from(raw.subarray(at, at + stride));
      at += stride;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        let add = 0;
        if (filter === 1) add = a;
        else if (filter === 2) add = b;
        else if (filter === 3) add = (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        } else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
        line[i] = (line[i] + add) & 255;
      }
      prev = line;
      const sample = (k) => {
        // the k-th sample of the line, scaled to 0..255
        if (depth === 8) return line[k];
        if (depth === 16) return line[k * 2];
        const bit = k * depth;
        return Math.round((((line[bit >> 3] >> (8 - depth - (bit & 7))) & max) * 255) / max);
      };
      const index = (k) => {
        const bit = k * depth;
        return depth === 8 ? line[k] : (line[bit >> 3] >> (8 - depth - (bit & 7))) & max;
      };
      for (let i = 0; i < w; i++) {
        const o = ((y0 + j * dy) * width + (x0 + i * dx)) * 4;
        if (color === 3) {
          const n = index(i);
          rgba[o] = palette[n * 3];
          rgba[o + 1] = palette[n * 3 + 1];
          rgba[o + 2] = palette[n * 3 + 2];
          rgba[o + 3] = trns && n < trns.length ? trns[n] : 255;
        } else if (color === 0 || color === 4) {
          const g = sample(i * channels);
          rgba[o] = rgba[o + 1] = rgba[o + 2] = g;
          rgba[o + 3] = color === 4 ? sample(i * channels + 1) : 255;
        } else {
          rgba[o] = sample(i * channels);
          rgba[o + 1] = sample(i * channels + 1);
          rgba[o + 2] = sample(i * channels + 2);
          rgba[o + 3] = color === 6 ? sample(i * channels + 3) : 255;
        }
      }
    }
  };
  if (interlace === 1) {
    for (const [x0, y0, dx, dy] of [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]]) {
      pass(Math.ceil((width - x0) / dx), Math.ceil((height - y0) / dy), x0, y0, dx, dy);
    }
  } else pass(width, height, 0, 0, 1, 1);
  let alpha = false;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) { alpha = true; break; }
  return { width, height, rgba, alpha };
}

// ---------------------------------------------------------------- the mark

/** 1 where the pixel is the mark. On alpha when the image has any, else on distance from the corners' colour. */
export function markMask({ width, height, rgba, alpha }, threshold = 96) {
  const mask = new Uint8Array(width * height);
  if (alpha) {
    for (let i = 0; i < mask.length; i++) mask[i] = rgba[i * 4 + 3] > 127 ? 1 : 0;
    return mask;
  }
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  const bg = [0, 1, 2].map((c) => corners.reduce((s, i) => s + rgba[i * 4 + c], 0) / 4);
  for (let i = 0; i < mask.length; i++) {
    const d = Math.hypot(rgba[i * 4] - bg[0], rgba[i * 4 + 1] - bg[1], rgba[i * 4 + 2] - bg[2]);
    mask[i] = d > threshold ? 1 : 0;
  }
  return mask;
}

/** Closed outlines along the pixel edges between mark and not, each a list of [x, y] corners, the mark on the
 * right-hand side (outer outlines clockwise on screen, holes the other way). */
export function contours(mask, width, height) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
  // directed unit edges, keyed by their start corner; a corner touched diagonally by two marks has two
  const out = new Map();
  const key = (x, y) => y * (width + 1) + x;
  const add = (x0, y0, x1, y1) => {
    const k = key(x0, y0);
    const e = { x0, y0, x1, y1, used: false };
    const list = out.get(k);
    if (list) list.push(e);
    else out.set(k, [e]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) add(x, y, x + 1, y); // top, left to right
      if (!inside(x + 1, y)) add(x + 1, y, x + 1, y + 1); // right, downward
      if (!inside(x, y + 1)) add(x + 1, y + 1, x, y + 1); // bottom, right to left
      if (!inside(x - 1, y)) add(x, y + 1, x, y); // left, upward
    }
  }
  const loops = [];
  for (const list of out.values()) {
    for (const first of list) {
      if (first.used) continue;
      const pts = [];
      let e = first;
      while (e && !e.used) {
        e.used = true;
        pts.push([e.x0, e.y0]);
        const next = out.get(key(e.x1, e.y1)).filter((n) => !n.used);
        if (next.length <= 1) e = next[0];
        else {
          // a corner two marks touch at: turn right, so diagonal neighbours stay separate outlines
          const [dx, dy] = [e.x1 - e.x0, e.y1 - e.y0];
          const right = [-dy, dx];
          e = next.find((n) => n.x1 - n.x0 === right[0] && n.y1 - n.y0 === right[1]) ?? next[0];
        }
      }
      if (pts.length >= 4) loops.push(pts);
    }
  }
  return loops;
}

/** The outline's points: a corner where two straight runs of at least 2 px meet stays a sharp corner; anywhere else
 * (a staircase, a curve drawn in pixels) the points are the middles of the pixel edges, which lie on the true edge. */
export function cornersOf(loop) {
  const n = loop.length;
  const dir = (i) => [loop[(i + 1) % n][0] - loop[i][0], loop[(i + 1) % n][1] - loop[i][1]];
  // the runs: a start index and a length, each a straight stretch of unit edges
  const runs = [];
  for (let i = 0; i < n; i++) {
    const [dx, dy] = dir(i);
    const last = runs[runs.length - 1];
    if (last && last.dx === dx && last.dy === dy) last.len++;
    else runs.push({ i, dx, dy, len: 1 });
  }
  if (runs.length > 1 && runs[0].dx === runs[runs.length - 1].dx && runs[0].dy === runs[runs.length - 1].dy) {
    const tail = runs.pop();
    runs[0] = { ...tail, len: tail.len + runs[0].len };
  }
  const pts = [];
  for (let r = 0; r < runs.length; r++) {
    const a = runs[r];
    const b = runs[(r + 1) % runs.length];
    const v = loop[(a.i + a.len) % n];
    if (a.len >= 2 && b.len >= 2) pts.push(v);
    else pts.push([v[0] - a.dx * 0.5, v[1] - a.dy * 0.5], [v[0] + b.dx * 0.5, v[1] + b.dy * 0.5]);
  }
  return pts;
}

/** Douglas-Peucker on a closed outline: the fewest points within `tol` px of the outline's points. */
export function simplify(loop, tol) {
  const turns = cornersOf(loop);
  if (turns.length < 4) return turns;
  // start from the corner farthest from the first, so the split is stable
  const dist = (p, a, b) => {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dy);
    return len === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
  };
  const dp = (pts) => {
    let best = 0, at = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = dist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > best) { best = d; at = i; }
    }
    if (best <= tol) return [pts[0], pts[pts.length - 1]];
    return [...dp(pts.slice(0, at + 1)).slice(0, -1), ...dp(pts.slice(at))];
  };
  let far = 0, fd = 0;
  for (let i = 1; i < turns.length; i++) {
    const d = Math.hypot(turns[i][0] - turns[0][0], turns[i][1] - turns[0][1]);
    if (d > fd) { fd = d; far = i; }
  }
  const a = dp(turns.slice(0, far + 1));
  const b = dp([...turns.slice(far), turns[0]]);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)];
  return out.length >= 3 ? out : turns;
}

const num = (v) => String(Math.round(v * 100) / 100);
/** One path for every outline. */
export const pathOf = (loops) => loops.map((l) => `M${l.map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}Z`).join("");

/** Traces a decoded PNG: { d, width, height, contours, points }. */
export function trace(img, { threshold = 96, tolerance = 0.5 } = {}) {
  const mask = markMask(img, threshold);
  if (!mask.some((v) => v === 1)) throw new Error("nothing to trace: no pixel reads as the mark (is the PNG empty, or is --threshold too high?)");
  const loops = contours(mask, img.width, img.height).map((l) => simplify(l, tolerance)).filter((l) => l.length >= 3);
  return { d: pathOf(loops), width: img.width, height: img.height, contours: loops.length, points: loops.reduce((s, l) => s + l.length, 0) };
}

/** The same through potrace, when it is installed: a PBM of the mask in, an SVG path out (its own coordinates). */
function potrace(img, threshold) {
  const probe = spawnSync("potrace", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) throw new Error("--potrace: the potrace command is not installed (brew install potrace, apt install potrace), or leave the flag out");
  const mask = markMask(img, threshold);
  const dir = mkdtempSync(join(tmpdir(), "trace-"));
  try {
    const rowBytes = Math.ceil(img.width / 8);
    const body = Buffer.alloc(rowBytes * img.height);
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (mask[y * img.width + x]) body[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    writeFileSync(join(dir, "m.pbm"), Buffer.concat([Buffer.from(`P4\n${img.width} ${img.height}\n`), body]));
    const r = spawnSync("potrace", ["-s", "--flat", "-o", join(dir, "m.svg"), join(dir, "m.pbm")], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`potrace failed: ${r.stderr.trim()}`);
    const svg = readFileSync(join(dir, "m.svg"), "utf8");
    const g = /<g transform="([^"]*)"/.exec(svg)?.[1] ?? "";
    const d = [...svg.matchAll(/<path d="([^"]*)"/g)].map((m) => m[1].replace(/\s+/g, " ").trim()).join(" ");
    return { d, transform: g, width: img.width, height: img.height, contours: (d.match(/M/gi) ?? []).length, points: null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const svgOf = (t) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t.width} ${t.height}" width="${t.width}" height="${t.height}">` +
  `<path ${t.transform ? `transform="${t.transform}" ` : ""}fill="currentColor" fill-rule="evenodd" d="${t.d}"/></svg>\n`;

// ---------------------------------------------------------------- the command

export function run(argv, cwd = process.cwd()) {
  try {
    const flags = {};
    const pos = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--potrace") flags.potrace = true;
      else if (["--out", "--json", "--threshold", "--tolerance"].includes(argv[i]) && argv[i + 1] !== undefined) flags[argv[i].slice(2)] = argv[++i];
      else if (argv[i].startsWith("--")) throw new Error(USAGE);
      else pos.push(argv[i]);
    }
    if (pos.length !== 1) throw new Error(USAGE);
    const file = resolve(cwd, pos[0]);
    if (!existsSync(file)) throw new Error(`no file ${pos[0]}`);
    const threshold = flags.threshold === undefined ? 96 : Number(flags.threshold);
    const tolerance = flags.tolerance === undefined ? 0.5 : Number(flags.tolerance);
    if (!(threshold >= 0 && threshold <= 255)) throw new Error("--threshold must be a number from 0 to 255");
    if (!(tolerance > 0 && tolerance <= 10)) throw new Error("--tolerance must be a number of px above 0, at most 10");
    const img = decodePng(readFileSync(file));
    const t = flags.potrace ? potrace(img, threshold) : trace(img, { threshold, tolerance });
    if (t.transform) {
      // potrace's path is in its own flipped, ×10 space: a film's import needs plain image coordinates
      if (flags.json) throw new Error("--json needs the built-in tracer (potrace's path carries a transform): leave out --potrace");
    }
    if (flags.out) writeFileSync(resolve(cwd, flags.out), svgOf(t));
    if (flags.json) writeFileSync(resolve(cwd, flags.json), JSON.stringify({ d: t.d, width: t.width, height: t.height }) + "\n");
    return { code: 0, line: JSON.stringify({ width: t.width, height: t.height, contours: t.contours, points: t.points, engine: flags.potrace ? "potrace" : "built-in", out: flags.out ?? null, json: flags.json ?? null }) };
  } catch (e) {
    return { code: 1, line: JSON.stringify({ error: e.message }) };
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const { code, line } = run(process.argv.slice(2));
  console.log(line);
  process.exit(code);
}
