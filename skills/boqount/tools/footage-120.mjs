#!/usr/bin/env node
// Footage brought to 120 frames a second, so video inside a film is as dense as its motion.
//
//   node <skill>/tools/footage-120.mjs films/<slug>                every clip in films/<slug>/media/ → films/<slug>/media-120/
//   node <skill>/tools/footage-120.mjs <in.mp4> <out.mp4>          one clip
//   node <skill>/tools/footage-120.mjs --install                   RIFE into ~/.cache/boqount/rife (about 900 MB)
//   add --fast to use ffmpeg's motion interpolation even where RIFE is installed
//
// Why: a film samples its motion 120 times a second and blends each pair into one 60 fps frame (`film.md` → The
// project). A 30 fps clip inside `Shot` holds each picture for four samples, so it steps visibly beside the drawn
// motion however smooth the rest of the frame is. Fixed at the root, for every clip, not film by film.
//
// How: the clip is split at its cuts first (ffmpeg's scdet) and each shot is interpolated on its own: interpolating
// across a cut makes a ghosted frame. A shot of N frames becomes 4N (or 120/fps × N) frames, so the timeline is
// unchanged and the clip's own sound, kept as it is, stays in sync. A clip already at 100 fps or more is copied.
// The interpolator: RIFE (nihui/rife-ncnn-vulkan, model rife-v4.6), found as `rife-ncnn-vulkan` on the PATH, in
// $RIFE_DIR, or where --install put it; without it, ffmpeg's `minterpolate` (motion-compensated, slower and softer on
// fast motion: the output says which was used). Nothing is downloaded without --install.
//
// The folder form writes media-120/<same path> for each .mp4, .mov or .m4v under media/ whose copy is missing or
// older than it; `npm run sync` then serves the 120 copy in place of the clip (scripts/sync-assets.mjs), and names
// every clip that has none. media-120/ is made again from media/ at any time and is not committed.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE = "20221029";
const HOME = join(homedir(), ".cache/boqount/rife");
const TARGET = 120;
const SCENE = 10; // scdet threshold (0-100); a real cut scores 20 to 60
const VIDEO = /\.(mp4|mov|m4v)$/i;
const USAGE = "usage: footage-120.mjs films/<slug> | <in.mp4> <out.mp4> | --install   [--fast]";

/** The RIFE binary and its model folder, or null. */
export function rife() {
  const dirs = [process.env.RIFE_DIR, ...(existsSync(HOME) ? readdirSync(HOME).map((d) => join(HOME, d)) : [])].filter(Boolean);
  for (const d of dirs) if (existsSync(join(d, "rife-ncnn-vulkan")) && existsSync(join(d, "rife-v4.6"))) return { bin: join(d, "rife-ncnn-vulkan"), model: join(d, "rife-v4.6") };
  const which = spawnSync("sh", ["-c", "command -v rife-ncnn-vulkan"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) {
    const bin = realpathSync(which.stdout.trim());
    const model = join(dirname(bin), "rife-v4.6");
    if (existsSync(model)) return { bin, model };
  }
  return null;
}

export function install() {
  if (rife()) return `RIFE is installed: ${rife().bin}`;
  const os = { darwin: "macos", linux: "ubuntu", win32: "windows" }[platform()];
  if (!os) throw new Error(`no RIFE build for ${platform()}: footage-120 uses ffmpeg's minterpolate`);
  const name = `rife-ncnn-vulkan-${RELEASE}-${os}`;
  mkdirSync(HOME, { recursive: true });
  const zip = join(HOME, `${name}.zip`);
  execFileSync("curl", ["-fL", "--retry", "2", "-o", zip, `https://github.com/nihui/rife-ncnn-vulkan/releases/download/${RELEASE}/${name}.zip`], { stdio: "inherit" });
  execFileSync("unzip", ["-q", "-o", zip, "-d", HOME]);
  rmSync(zip);
  const dir = join(HOME, name);
  execFileSync("chmod", ["+x", join(dir, "rife-ncnn-vulkan")]);
  if (os === "macos") spawnSync("xattr", ["-dr", "com.apple.quarantine", dir]);
  return `RIFE installed in ${dir}`;
}

const probe = (file, entries) =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "csv=p=0", file]).toString().trim();

/** Frame indices at which a new shot starts (always 0). scdet logs each cut's time. */
export function shotStarts(file, fps, total) {
  const r = spawnSync("ffmpeg", ["-nostdin", "-v", "info", "-i", file, "-vf", `scdet=threshold=${SCENE}`, "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const t = [...(r.stderr ?? "").matchAll(/lavfi\.scd\.time:\s*([\d.]+)/g)].map((m) => Math.round(Number(m[1]) * fps));
  return [...new Set([0, ...t])].filter((v) => v < total).sort((a, b) => a - b);
}

const pad = (n) => String(n).padStart(8, "0");

/** One clip to 120 fps: { frames, shots, out, fps, by }. */
export function footage120(input, output, { fast = false } = {}) {
  input = resolve(input);
  output = resolve(output);
  const [num, den] = probe(input, "stream=r_frame_rate").split("/").map(Number);
  const fps = num / (den || 1);
  mkdirSync(dirname(output), { recursive: true });
  if (fps >= 100) {
    copyFileSync(input, output);
    return { frames: null, shots: null, out: null, fps, by: "copied (already 100 fps or more)" };
  }
  const factor = Math.round(TARGET / fps);
  if (factor < 2) throw new Error(`${input} is ${fps} fps: nothing to interpolate to ${TARGET}`);
  const engine = fast ? null : rife();
  const work = mkdtempSync(join(tmpdir(), "footage120-"));
  try {
    const src = join(work, "src");
    mkdirSync(src);
    execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", input, "-fps_mode", "passthrough", "-pix_fmt", "rgb24", join(src, "%08d.png")]);
    const frames = readdirSync(src).filter((f) => f.endsWith(".png")).sort();
    const starts = shotStarts(input, fps, frames.length);
    const out = join(work, "out");
    mkdirSync(out);
    let n = 0;
    starts.forEach((s, k) => {
      const e = k + 1 < starts.length ? starts[k + 1] : frames.length;
      const len = e - s;
      const shot = join(work, `shot${k}`);
      const res = join(work, `res${k}`);
      mkdirSync(shot);
      mkdirSync(res);
      for (let i = s; i < e; i++) renameSync(join(src, frames[i]), join(shot, `${pad(i - s + 1)}.png`));
      const want = len * factor;
      if (len < 2) {
        for (let r = 0; r < factor; r++) copyFileSync(join(shot, pad(1) + ".png"), join(res, `${pad(r + 1)}.png`));
      } else if (engine) {
        execFileSync(engine.bin, ["-i", shot, "-o", res, "-n", String(want), "-m", engine.model, "-f", "%08d.png"], { stdio: ["ignore", "ignore", "pipe"] });
      } else {
        // the shot's last frame held for one source frame, so the interpolation has a frame to reach at the end
        execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-framerate", String(fps), "-i", join(shot, "%08d.png"),
          "-vf", `tpad=stop_mode=clone:stop=1,minterpolate=fps=${fps * factor}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
          "-frames:v", String(want), join(res, "%08d.png")]);
        const got = readdirSync(res).filter((f) => f.endsWith(".png")).sort();
        for (let i = got.length; i < want; i++) copyFileSync(join(res, got.at(-1)), join(res, `${pad(i + 1)}.png`));
      }
      for (const f of readdirSync(res).filter((f) => f.endsWith(".png")).sort().slice(0, want)) renameSync(join(res, f), join(out, `${pad(++n)}.png`));
    });
    if (n !== frames.length * factor) throw new Error(`${input}: ${frames.length} frames became ${n}, expected ${frames.length * factor}`);
    const hasAudio = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", input], { encoding: "utf8" }).stdout.trim() !== "";
    const tmp = `${output}.part${output.match(/\.[^.]+$/)?.[0] ?? ".mp4"}`;
    execFileSync("ffmpeg", ["-nostdin", "-y", "-v", "error", "-framerate", String(fps * factor), "-i", join(out, "%08d.png"), ...(hasAudio ? ["-i", input, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "256k"] : []),
      "-c:v", "libx264", "-preset", "slow", "-crf", "10", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
      "-movflags", "+faststart", tmp]);
    renameSync(tmp, output);
    return { frames: frames.length, shots: starts.length, out: n, fps: fps * factor, by: engine ? "RIFE" : "ffmpeg minterpolate (RIFE not installed: footage-120.mjs --install for sharper motion)" };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Every clip under <film>/media/ whose media-120/ copy is missing or older. */
export function stale(film) {
  const media = join(film, "media");
  if (!existsSync(media)) return [];
  return readdirSync(media, { recursive: true })
    .map(String)
    .filter((f) => VIDEO.test(f) && !f.split("/").some((p) => p.startsWith(".")))
    .filter((f) => {
      const dst = join(film, "media-120", f);
      return !existsSync(dst) || statSync(dst).mtimeMs < statSync(join(media, f)).mtimeMs;
    })
    .sort();
}

export function main(argv) {
  const fast = argv.includes("--fast");
  const pos = argv.filter((a) => a !== "--fast");
  if (pos[0] === "--install") return install();
  if (pos.length === 2) return JSON.stringify(footage120(pos[0], pos[1], { fast }));
  if (pos.length !== 1) throw new Error(USAGE);
  const film = resolve(pos[0]);
  if (!existsSync(join(film, "media"))) throw new Error(`no ${join(film, "media")}: name a film's folder (films/<slug>)`);
  const todo = stale(film);
  if (!todo.length) return `${relative(process.cwd(), film) || "."}: every clip has its 120 copy`;
  return todo.map((f) => {
    const r = footage120(join(film, "media", f), join(film, "media-120", f), { fast });
    return `${f}: ${r.frames ?? "-"} frames in ${r.shots ?? "-"} shots → ${r.out ?? "-"} at ${r.fps} fps, ${r.by}`;
  }).join("\n");
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    console.log(main(process.argv.slice(2)));
  } catch (e) {
    console.error(`footage-120.mjs: ${e.message}`);
    process.exit(e.message === USAGE ? 2 : 1);
  }
}
