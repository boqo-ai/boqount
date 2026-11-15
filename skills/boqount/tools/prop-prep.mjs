#!/usr/bin/env node
// A generated prop made ready for kit/Prop.tsx (gen.md → Explainer props): trimmed to what it shows, and a device's
// flat green screen keyed into a hole whose rectangle is recorded, so <PropDevice> draws live interface under the glass.
//
//   node <skill>/tools/prop-prep.mjs <cutout.png> <films/<slug>/media/props> --name <name> [--screen] [--pad 8]
//
// <cutout.png> is the prop with its background removed (a background-removal model's output, with alpha). It writes
// <dir>/<name>.png and the prop's entry in <dir>/props.json ({ w, h, screen?: [x0, y0, x1, y1] }); `npm run sync`
// copies the folder to the film's media and props.json beside its scenes. With --screen, pixels of the flat
// #00FF00 the prompt asked for become transparent, the green spill on their edge is taken out, and the rectangle they
// fill is the screen. Needs ffmpeg and ffprobe; costs nothing.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Is this pixel the flat key green? */
const isKey = (r, g, b) => g > 150 && g - Math.max(r, b) > 90;

/**
 * The prop in `px` (RGBA, w × h), trimmed to its opaque pixels plus `pad`, with the key green (when `screen`) made a
 * hole: { w, h, data, screen } where `screen` is the hole's rectangle in the trimmed image, or null.
 */
export function prepare(px, w, h, { screen = false, pad = 8 } = {}) {
  const data = Buffer.from(px);
  let key = null;
  if (screen) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > 0 && isKey(data[i], data[i + 1], data[i + 2])) {
          data[i + 3] = 0;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    if (x1 < 0) throw new Error("--screen: no flat green found: ask the generation for the screen as flat #00FF00");
    // Despill: a pixel left green-tinted near the hole loses its excess green.
    for (let y = Math.max(0, y0 - 6); y <= Math.min(h - 1, y1 + 6); y++)
      for (let x = Math.max(0, x0 - 6); x <= Math.min(w - 1, x1 + 6); x++) {
        const i = (y * w + x) * 4;
        const m = Math.max(data[i], data[i + 2]);
        if (data[i + 3] > 0 && data[i + 1] > m) data[i + 1] = m;
      }
    key = [x0, y0, x1 + 1, y1 + 1];
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error("the image is fully transparent: is it the cut-out (with alpha)?");
  if (key) {
    x0 = Math.min(x0, key[0]); y0 = Math.min(y0, key[1]); x1 = Math.max(x1, key[2] - 1); y1 = Math.max(y1, key[3] - 1);
  }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const tw = x1 - x0 + 1, th = y1 - y0 + 1;
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) data.copy(out, y * tw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4);
  return { w: tw, h: th, data: out, screen: key ? [key[0] - x0, key[1] - y0, key[2] - x0, key[3] - y0] : null };
}

function size(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  const [w, h] = out.trim().split(",").map(Number);
  return { w, h };
}

function main(argv) {
  const pos = argv.filter((a, i) => !a.startsWith("--") && !["--name", "--pad"].includes(argv[i - 1]));
  const [src, dir] = pos;
  const flag = (n) => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
  const name = flag("name");
  if (!src || !dir || !name) throw new Error("usage: prop-prep.mjs <cutout.png> <films/<slug>/media/props> --name <name> [--screen] [--pad 8]");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) throw new Error(`a prop's name is lowercase words joined by -, got ${JSON.stringify(name)}`);
  const pad = flag("pad") === undefined ? 8 : Number(flag("pad"));
  const { w, h } = size(src);
  const px = execFileSync("ffmpeg", ["-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: w * h * 4 + 1024 });
  const p = prepare(px, w, h, { screen: argv.includes("--screen"), pad });
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.png`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${p.w}x${p.h}`, "-i", "-", "-frames:v", "1", out], { input: p.data });
  const metaPath = join(dir, "props.json");
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
  meta[name] = p.screen ? { w: p.w, h: p.h, screen: p.screen } : { w: p.w, h: p.h };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  return `${out}: ${p.w}×${p.h}${p.screen ? `, screen ${p.screen.join(",")}` : ""}; ${metaPath} updated. Add its source line to the film's media/SOURCES.md (generated: the endpoint and the prompt file).`;
}

const isMain = (() => {
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1] ?? "");
  } catch {
    return false;
  }
})();
if (isMain) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`prop-prep.mjs: ${e.message}`);
    process.exit(1);
  }
}
