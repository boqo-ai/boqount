#!/usr/bin/env node
// Flashing, measured on a rendered film: `motion.md` → Rich motion says nothing flashes.
//
//   node <skill>/tools/flashes.mjs <film.mp4> [--loop]
//
// For the whole frame and for each cell of a 3 x 3 grid (a ninth of the frame: "a large part of it"), the relative
// luminance of every frame (the mean of (Y/255)^2.2), then the opposing changes of 0.10 or more (a tenth of full white;
// a flash is a pair of them) inside any one second. Three flashes a second is the limit, so more than six opposing
// changes in any second fails. --loop also reads across the loop point (the last second into the first), for a film
// that loops. Prints a line a region and the verdict; exits 1 on a fail, 2 on wrong use.
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const W = 54, H = 96;

/** The frame rate of the first video stream, as a number. */
function fps(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", file], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffprobe could not read ${file}`);
  const [a, b = 1] = r.stdout.trim().split("/").map(Number);
  if (!(a > 0 && b > 0)) throw new Error(`no frame rate in ${file}`);
  return a / b;
}

/** Frame indices of each change of `step` or more that opposes the one before it (with hysteresis). */
export function changes(series, step = 0.1) {
  const out = [];
  let lo = series[0], hi = series[0], dir = 0;
  series.forEach((v, i) => {
    if (dir <= 0) {
      lo = Math.min(lo, v);
      if (v >= lo + step) return out.push(i), (dir = 1), (hi = v);
    }
    if (dir >= 0) {
      hi = Math.max(hi, v);
      if (v <= hi - step) out.push(i), (dir = -1), (lo = v);
    }
  });
  return out;
}

export function measureFlashes(file, { loop = false } = {}) {
  const rate = fps(file);
  const r = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-i", file, "-vf", `scale=${W}:${H}:flags=area,format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}`);
  const raw = r.stdout;
  const frames = Math.floor(raw.length / (W * H));
  const second = Math.round(rate);
  const lum = (f, x0, x1, y0, y1) => {
    let s = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += Math.pow(raw[f * W * H + y * W + x] / 255, 2.2);
    return s / ((x1 - x0) * (y1 - y0));
  };
  const regions = [["whole frame", 0, W, 0, H]];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) regions.push([`cell row ${row + 1} col ${col + 1}`, (col * W) / 3, ((col + 1) * W) / 3, (row * H) / 3, ((row + 1) * H) / 3].map((v, i) => (i ? Math.round(v) : v)));
  const result = [];
  for (const [name, x0, x1, y0, y1] of regions) {
    let s = Array.from({ length: frames }, (_, f) => lum(f, x0, x1, y0, y1));
    if (loop) s = s.concat(s.slice(0, second));
    const ch = changes(s);
    let best = 0, at = 0;
    ch.forEach((a, i) => {
      const k = ch.slice(i).filter((b) => b - a < second).length;
      if (k > best) (best = k), (at = a);
    });
    result.push({ name, total: ch.length, most: best, at: (at % frames) / rate });
  }
  const worst = result.reduce((w, r) => (r.most > w.most ? r : w), result[0]);
  return { frames, rate, regions: result, worst, pass: worst.most <= 6 };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("usage: flashes.mjs <film.mp4> [--loop]");
    process.exit(2);
  }
  try {
    const m = measureFlashes(resolve(file), { loop: args.includes("--loop") });
    console.log(`${m.frames} frames at ${m.rate.toFixed(2)} fps`);
    for (const r of m.regions) console.log(`  ${r.name.padEnd(18)} changes of 0.10 or more: ${String(r.total).padStart(3)}; most in any one second: ${r.most}${r.most ? ` (from ${r.at.toFixed(2)} s)` : ""}`);
    console.log(`most opposing changes in any one second, any region: ${m.worst.most} -> ${m.pass ? "PASS (6 or fewer: three flashes or fewer)" : `FAIL (${m.worst.name}, from ${m.worst.at.toFixed(2)} s)`}`);
    process.exit(m.pass ? 0 : 1);
  } catch (e) {
    console.error(`flashes.mjs: ${e.message}`);
    process.exit(2);
  }
}
