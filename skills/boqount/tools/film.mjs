#!/usr/bin/env node
// Sets up the film project in an account and adds films to it (the skill's films/ folder holds the Remotion project).
//
//   node <skill>/tools/film.mjs init  [--dir <account>] [--from <films-dir>]   copy <skill>/films/ to <account>/films/ (never over an existing films/project), generate films/sfx/, apply the theme; prints the one command left as {"next": {"cwd", "command": [...]}}
//   node <skill>/tools/film.mjs theme [--dir <account>]                        brand/<slug>/style.md's ```tokens block → films/project/src/lib/tokens.json
//   node <skill>/tools/film.mjs new <slug> [--story] [--dir <account>]         films/<slug>/ (script, storyboard, audio skeletons), the scenes in films/project/src/films/<slug>/, registered in src/films/index.ts
//   node <skill>/tools/film.mjs glimpse [--dir <account>]                      checks films/glimpse/glimpse.json (the first look, onboarding.md → 2. Say it back, and show it), writes its sound sheet, prints the sound and render commands
//
// --dir defaults to the current folder: the account's files live where the agent was started, not beside this tool.
// --from defaults to the skill's own films/ folder, found relative to this file (../films).
//
// init never overwrites a file that is already under <account>/films/, and leaves out what is generated or installed:
// node_modules, the project's public/ and out/, rendered output, .wav files and a film's audio/sfx/.
//
// theme reads the slug from the `brand:` line of marketing/config.md, then the ```tokens block of brand/<slug>/style.md:
// `key: value` lines (# starts a comment line) with the keys of tokens.json: canvas panel ink muted accent accent2 danger
// (hex colours: #rgb or #rrggbb, written as #RRGGBB; a colour with alpha is refused), font_display font_text (a CSS
// family name, quotes optional), radius (a number of px), motion (snappy, smooth or bouncy). The keys it sets replace those in tokens.json; the others keep their value. No style.md, or no
// block in it, leaves the tokens as they are and says so. An unknown key or a bad value is an error naming the line,
// and nothing is written.
//
// new refuses a slug that exists or is not made of a-z, 0-9 and single hyphens, and an id (the slug in PascalCase)
// another film already has. The new film's scenes start as a copy of src/films/_template/ (a neutral looping skeleton
// that is never registered itself), with its id "Template" and slug "_template" renamed wherever they are quoted.
// With --story they start as a copy of src/films/_story/ instead (the story format: ten parts, one world each, no
// loop; id "Story", slug "_story"), its sound sheet says "loop": false, and its storyboard takes the starter's
// headings (the starter is a story film). The starter is only the worked example: new reads its script and storyboard
// for their headings when it is there, and works without it.
//
// glimpse checks films/glimpse/glimpse.json, which the agent writes from the deep read's notes:
//   {"name": {"text", "source"}, "opening": {"text", "source"} | null, "lines": [{"text", "source"}, …2 to 4],
//    "pictures": [{"file", "source", "frame", "crop", "focus"}, …0 to 2] | null,
//    "colors": {"canvas", "ink", "accent", "source"} | null, "font": {"family", "source"} | null, "logo": {"source"} | null}
// A picture is a real picture of the product from their files or pages (a screenshot, the site's image, the app icon
// large), copied to films/glimpse/assets/pictures/: `file` is its path there; `frame` is "window" or "phone" for a bare
// screen the film frames, "none" for one that has its frame already; `crop` [x, y, w, h] and `focus` [x, y] are
// fractions of it (the part shown, and the detail the camera pushes in on). Then it writes films/glimpse/audio/:
// cues.json and the sound sheet (sfx-cues.json, version 2) from the film's own clock
// (films/project/src/films/glimpse/timeline.json): a soft bed under it all, a pass on each change of world, a mark when
// the name lands and when the promise does; kit and tonal sounds only, $0. Its answer gives the sound commands, in
// order (the tonal set, then the mix), before the render.
// Every text has a source; the name is at most 40 characters, the opening (a short word or number from the product's
// own pages) at most 24, a line at most 90. Colours are opaque hex and the ink must read on the canvas (4.5:1). A font
// needs its file, films/glimpse/assets/fonts/<family>.ttf|.otf|.woff2; a logo its file, films/glimpse/assets/logo.svg
// or .png. With no colours the first look is drawn in a neutral palette, with no font in Inter, with no logo with the
// name as the mark. Its answer names the command that renders it (films/glimpse/out/glimpse-draft.mp4, about half a
// minute on a laptop once the project is installed) and the one that makes its stills.
//
// Prints one JSON line and exits 0, or exits 1 with {"error": …}. The tests are tests/film.test.mjs.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { run as runKit } from "./sfx-kit.mjs";

const USAGE = "usage: film.mjs init [--dir <account>] [--from <films-dir>] | theme [--dir <account>] | new <slug> [--story] [--dir <account>] | glimpse [--dir <account>]";
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Folders under films/ that are not a film's: a slug may not take their name.
const RESERVED_SLUGS = ["project", "sfx", "starter", "glimpse", "sounds"];
const COLOR_KEYS = ["canvas", "panel", "ink", "muted", "accent", "accent2", "danger"];
const FONT_KEYS = ["font_display", "font_text"];
const TOKEN_KEYS = [...COLOR_KEYS, ...FONT_KEYS, "radius", "motion"];
const MOTIONS = ["snappy", "smooth", "bouncy"];
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const HEX_ALPHA = /^#(?:[0-9a-fA-F]{4}|[0-9a-fA-F]{8})$/;
/** The folders `new` copies, and the id and slug it renames there: the looping skeleton (a `niche` film, the locked
 * format), and with --story the story format's (a `product` or `offer` film: ten parts, scenes that change, no loop). */
const TEMPLATE = { dir: "_template", id: "Template", slug: "_template" };
const STORY = { dir: "_story", id: "Story", slug: "_story" };
const RESERVED_WORDS = new Set(
  "break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof let new null package private protected public return static super switch this throw true try typeof var void while with yield await interface implements".split(" "),
);
const MARKERS = { importsEnd: "// films:end", listEnd: "// films:list:end", importsStart: "// films:start", listStart: "// films:list:start" };

const ok = (value) => ({ code: 0, line: JSON.stringify(value) });
const fail = (message) => ({ code: 1, line: JSON.stringify({ error: message }) });
const isDir = (path) => existsSync(path) && statSync(path).isDirectory();
const readOptional = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const allowed = { init: ["--dir", "--from"], theme: ["--dir"], new: ["--dir", "--story"], glimpse: ["--dir"] }[command];
  if (!allowed) throw new Error(USAGE);
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--story" && allowed.includes("--story")) {
      if (flags["--story"] !== undefined) throw new Error(USAGE);
      flags["--story"] = true;
    } else if (rest[i].startsWith("--")) {
      if (!allowed.includes(rest[i]) || rest[i + 1] === undefined || flags[rest[i]] !== undefined) throw new Error(USAGE);
      flags[rest[i]] = rest[++i];
    } else positional.push(rest[i]);
  }
  if (positional.length !== (command === "new" ? 1 : 0)) {
    if (command === "new" && positional.length === 0) throw new Error(`new needs a slug. ${USAGE}`);
    throw new Error(USAGE);
  }
  return { command, flags, slug: positional[0] };
}

// ---------------------------------------------------------------- theme

/** The brand slug of the account, or null. */
function brandSlug(account) {
  const text = readOptional(join(account, "marketing/config.md"));
  if (text === null) return null;
  const block = /^```config[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m.exec(text);
  const m = /^brand:[ \t]*(.*?)[ \t]*$/m.exec(block ? block[1] : text);
  return m && SLUG.test(m[1]) ? m[1] : null;
}

/** One token line's value, checked against its key. Throws with the problem, without the line number. */
function tokenValue(key, raw) {
  if (raw === "") throw new Error(`${key} has no value`);
  if (COLOR_KEYS.includes(key)) {
    if (HEX_ALPHA.test(raw)) throw new Error(`${key} must be an opaque colour: ${JSON.stringify(raw)} has alpha; write it as #rrggbb`);
    if (!HEX.test(raw)) throw new Error(`${key} must be a hex colour such as #3f8f5b, got ${JSON.stringify(raw)}`);
    // The film's colour arithmetic (theme.ts) reads #RRGGBB: #abc is written out in full.
    const digits = raw.length === 4 ? [...raw.slice(1)].map((c) => c + c).join("") : raw.slice(1);
    return `#${digits.toUpperCase()}`;
  }
  if (FONT_KEYS.includes(key)) {
    const family = raw.replace(/^(["'])(.*)\1$/, "$2");
    // The family ends up in a CSS font stack: a name, with spaces, dots, commas and hyphens, and nothing that could close it.
    if (!/^[A-Za-z0-9 _.,-]+$/.test(family)) throw new Error(`${key} must be a font family name (letters, digits, spaces, . , _ -), got ${JSON.stringify(raw)}`);
    return family;
  }
  if (key === "radius") {
    if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`radius must be a number of px, got ${JSON.stringify(raw)}`);
    return Number(raw);
  }
  if (!MOTIONS.includes(raw)) throw new Error(`motion must be one of ${MOTIONS.join(", ")}, got ${JSON.stringify(raw)}`);
  return raw;
}

/**
 * What the account's brand style asks for: { slug, applied: false, note } when it asks for nothing, else
 * { slug, applied: true, tokens } (only the keys the block sets). Throws, naming the line, on a bad line.
 */
function readTheme(account) {
  const slug = brandSlug(account);
  if (!slug) return { slug: null, applied: false, note: "no brand slug in marketing/config.md (brand:); default tokens kept" };
  const path = `brand/${slug}/style.md`;
  const text = readOptional(join(account, path));
  if (text === null) return { slug, applied: false, note: `no ${path}; default tokens kept` };
  const block = /^```tokens[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/m.exec(text);
  if (!block) return { slug, applied: false, note: `${path} has no \`\`\`tokens block; default tokens kept` };
  const first = text.slice(0, block.index).split("\n").length + 1; // the file's line number of the block's first line
  const tokens = {};
  block[1].split(/\r?\n/).forEach((line, i) => {
    if (line.trim() === "" || line.trim().startsWith("#")) return;
    const where = `${path} line ${first + i}`;
    const colon = line.indexOf(":");
    if (colon < 1) throw new Error(`${where}: ${JSON.stringify(line.trim())} is not "key: value"`);
    const key = line.slice(0, colon).trim();
    if (!TOKEN_KEYS.includes(key)) throw new Error(`${where}: unknown key ${JSON.stringify(key)} (the keys are ${TOKEN_KEYS.join(", ")})`);
    if (key in tokens) throw new Error(`${where}: ${key} is set twice`);
    try {
      tokens[key] = tokenValue(key, line.slice(colon + 1).trim());
    } catch (e) {
      throw new Error(`${where}: ${e.message}`);
    }
  });
  return { slug, applied: true, tokens };
}

const tokensPath = (account) => join(account, "films/project/src/lib/tokens.json");
const needInit = (account) => new Error(`no films/project in ${account}: run film.mjs init first`);

function applyTheme(account, theme) {
  if (!theme.applied) return { slug: theme.slug, applied: false, note: theme.note };
  const file = tokensPath(account);
  const next = { ...JSON.parse(readFileSync(file, "utf8")), ...theme.tokens };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  return { slug: theme.slug, applied: true, set: Object.keys(theme.tokens) };
}

// ---------------------------------------------------------------- init

/** True for what init leaves out: installed, built, rendered or generated. `rel` is relative to the films/ folder. */
function generated(rel) {
  const parts = rel.split("/");
  return (
    parts.includes("node_modules") ||
    basename(rel) === ".DS_Store" ||
    rel === "project/public" ||
    (parts.length === 2 && parts[1] === "out") ||
    /\.wav$/i.test(rel) ||
    /(^|\/)audio\/sfx$/.test(rel)
  );
}

/** Copies `from` into `to`, skipping generated files and never replacing a file that exists. Returns the files written. */
function copyTree(from, to, root = from, written = []) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    if (generated(relative(root, src).split("\\").join("/"))) continue;
    const dest = join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dest, root, written);
    else if (!existsSync(dest)) {
      copyFileSync(src, dest);
      written.push(dest);
    }
  }
  return written;
}

async function init(account, from) {
  if (!isDir(join(from, "project"))) throw new Error(`${from} has no project/ folder: that is not the skill's films/ folder`);
  if (!existsSync(join(from, "project/src/lib/tokens.json"))) throw new Error(`${from}/project has no src/lib/tokens.json`);
  const films = join(account, "films");
  if (existsSync(join(films, "project"))) {
    throw new Error(`${films}/project already exists: init never goes over it. To start again, move it away first`);
  }
  const theme = readTheme(account); // a bad style.md stops here, before anything is written
  copyTree(from, films);
  const kit = await runKit(["--out", join(films, "sfx")], { mkdir, writeFile });
  const sfx = JSON.parse(kit.line);
  if (kit.code !== 0) throw new Error(`the sound kit: ${sfx.error}`);
  return {
    command: "init",
    dir: account,
    films,
    sfx: { out: sfx.out, files: sfx.files.length },
    theme: applyTheme(account, theme),
    next: { cwd: join(films, "project"), command: ["npm", "install"] },
  };
}

// ---------------------------------------------------------------- new

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const pascal = (slug) => slug.split("-").map(cap).join("");
/** A valid JS name for the film's import: camelCase of the slug, `film` + PascalCase when that is not a name. */
function importName(slug, taken) {
  const [head, ...tail] = slug.split("-");
  let name = head + tail.map(cap).join("");
  if (/^\d/.test(name) || RESERVED_WORDS.has(name)) name = `film${pascal(slug)}`;
  while (taken.has(name)) name += "_";
  return name;
}
// The starter's skeletons when its files are gone: the same headings and labels.
const STORYBOARD_HEADINGS = "# Starter — storyboard (9:16)\n## The locked-format points\n## The chain\n## Sound\n";
const STORY_HEADINGS = "# Starter — storyboard (9:16)\n## The story-format points\n## The worlds\n## Sound\n";
const SCRIPT_LABELS = "Structure:\n";
const headingsOnly = (text, slug) =>
  text.split("\n").filter((l) => /^#{1,6}\s/.test(l)).map((l) => l.replace(/starter/gi, slug)).join("\n\n") + "\n";
/** A script's skeleton: one numbered line, and each label (`Structure:`) with its text removed. */
const scriptSkeleton = (text) =>
  ["1.", "", ...text.split("\n").map((l) => /^[A-Za-z][A-Za-z ]*:/.exec(l)?.[0]).filter(Boolean)].join("\n") + "\n";
/** The template's id and slug, quoted in its code, become the new film's. */
const QUOTED = (word) => new RegExp(`(["'])${word}\\1`, "g");
const renamed = (text, id, slug, tpl = TEMPLATE) => text.replace(QUOTED(tpl.id), `$1${id}$1`).replace(QUOTED(tpl.slug), `$1${slug}$1`);

async function newFilm(account, slug, story = false) {
  const tpl = story ? STORY : TEMPLATE;
  if (!slug || !SLUG.test(slug)) throw new Error(`${JSON.stringify(slug ?? "")} is not a slug: use a-z, 0-9 and single hyphens, e.g. dry-spell`);
  if (RESERVED_SLUGS.includes(slug)) throw new Error(`${slug} is a folder of the film project, not a film: choose another slug`);
  const project = join(account, "films/project");
  const indexPath = join(project, "src/films/index.ts");
  const template = join(project, "src/films", tpl.dir);
  const starterFilm = join(account, "films/starter");
  if (!existsSync(indexPath) || !isDir(template)) throw needInit(account);
  const filmDir = join(account, "films", slug);
  const scenesDir = join(project, "src/films", slug);
  if (existsSync(filmDir) || existsSync(scenesDir)) throw new Error(`the film ${slug} already exists (${existsSync(filmDir) ? filmDir : scenesDir})`);

  const id = pascal(slug);
  for (const dir of readdirSync(join(project, "src/films"), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("_"))) {
    const other = /\bid:\s*["']([^"']+)["']/.exec(readOptional(join(project, "src/films", dir.name, "index.ts")) ?? "")?.[1];
    if (other === id) throw new Error(`the id ${id} is already the film ${dir.name}'s: choose another slug`);
  }
  const templateIndex = readOptional(join(template, "index.ts")) ?? "";
  const ID = new RegExp(`\\bid:\\s*(["'])${tpl.id}\\1`);
  const SLUG_PROP = new RegExp(`\\bslug:\\s*(["'])${tpl.slug}\\1`);
  if (!ID.test(templateIndex) || !SLUG_PROP.test(templateIndex)) throw new Error(`${template}/index.ts has no id: "${tpl.id}" and slug: "${tpl.slug}" to rename`);

  const lines = readFileSync(indexPath, "utf8").split("\n");
  const at = Object.fromEntries(Object.entries(MARKERS).map(([name, marker]) => [name, lines.flatMap((l, i) => (l.trim() === marker ? [i] : []))]));
  for (const [name, marker] of Object.entries(MARKERS)) {
    if (at[name].length !== 1) throw new Error(`${indexPath} must have the line ${marker} exactly once`);
  }
  if (!(at.importsStart[0] < at.importsEnd[0] && at.importsEnd[0] < at.listStart[0] && at.listStart[0] < at.listEnd[0])) {
    throw new Error(`${indexPath}: the marker lines are out of order`);
  }
  if (lines.some((l) => l.includes(`from './${slug}'`))) throw new Error(`${slug} is already registered in ${indexPath}`);
  const taken = new Set([...lines.join("\n").matchAll(/\bas\s+(\w+)\s*\}/g)].map((m) => m[1]));
  const name = importName(slug, taken);

  try {
    mkdirSync(join(filmDir, "audio"), { recursive: true });
    writeFileSync(join(filmDir, "script.txt"), scriptSkeleton(readOptional(join(starterFilm, "script.txt")) ?? SCRIPT_LABELS));
    writeFileSync(join(filmDir, "STORYBOARD.md"), headingsOnly((story ? readOptional(join(starterFilm, "STORYBOARD.md")) : null) ?? (story ? STORY_HEADINGS : STORYBOARD_HEADINGS), slug));
    writeFileSync(join(filmDir, "audio/cues.json"), JSON.stringify({ duration: 0, lines: [] }, null, 2) + "\n");
    writeFileSync(join(filmDir, "audio/sfx-cues.json"), JSON.stringify({ version: 2, loop: !story, hits: [], beds: [], music: { segments: [] } }, null, 2) + "\n");
    for (const file of copyTree(template, scenesDir)) {
      if (/\.(ts|tsx)$/.test(file)) writeFileSync(file, renamed(readFileSync(file, "utf8"), id, slug, tpl));
    }
    const indent = /^\s*/.exec(lines[at.listEnd[0]])[0];
    lines.splice(at.listEnd[0], 0, `${indent}${name},`);
    lines.splice(at.importsEnd[0], 0, `import {film as ${name}} from './${slug}';`);
    writeFileSync(indexPath, lines.join("\n"));
  } catch (e) {
    rmSync(filmDir, { recursive: true, force: true });
    rmSync(scenesDir, { recursive: true, force: true });
    throw e;
  }
  return { command: "new", slug, id, format: story ? "story" : "loop", film: `films/${slug}`, scenes: `films/project/src/films/${slug}`, registered: true };
}

// ---------------------------------------------------------------- glimpse

const LIMITS = { name: 40, opening: 24, line: 90 };
const FRAMES = ["window", "phone", "none"];
const fractions = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === "number" && x >= 0 && x <= 1);
const FONT_EXT = ["ttf", "otf", "woff2"];

function luminance(hex) {
  const h = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio of two hex colours. */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

function said(value, where, limit) {
  if (!value || typeof value !== "object") throw new Error(`${where} must be {"text", "source"}`);
  if (typeof value.text !== "string" || !value.text.trim()) throw new Error(`${where}.text is empty`);
  if (typeof value.source !== "string" || !value.source.trim()) throw new Error(`${where} has no source: a word on screen comes from the product's own files or pages, with where`);
  if (value.text.length > limit) throw new Error(`${where}.text is ${value.text.length} characters, at most ${limit}: pick a shorter phrase of theirs, never a rewrite`);
}

function glimpse(account) {
  if (!existsSync(tokensPath(account))) throw needInit(account);
  const dir = join(account, "films/glimpse");
  const file = join(dir, "glimpse.json");
  const text = readOptional(file);
  if (text === null) throw new Error("no films/glimpse/glimpse.json: write it from the deep read's notes first (onboarding.md → 2. Say it back, and show it)");
  let spec;
  try {
    spec = JSON.parse(text);
  } catch (e) {
    throw new Error(`films/glimpse/glimpse.json is not JSON: ${e.message}`);
  }
  said(spec.name, "name", LIMITS.name);
  if (spec.opening != null) said(spec.opening, "opening", LIMITS.opening);
  if (!Array.isArray(spec.lines) || spec.lines.length < 2 || spec.lines.length > 4) throw new Error("lines must hold 2 to 4 of the product's own lines");
  spec.lines.forEach((l, i) => said(l, `lines[${i}]`, LIMITS.line));
  const drawn = { colors: "neutral", font: "Inter", logo: "the name" };
  const pictures = spec.pictures ?? [];
  if (!Array.isArray(pictures) || pictures.length > 2) throw new Error("pictures must be a list of at most 2");
  pictures.forEach((pic, i) => {
    const at = `pictures[${i}]`;
    if (!pic || typeof pic.file !== "string" || !pic.file.trim()) throw new Error(`${at}.file is empty`);
    if (typeof pic.source !== "string" || !pic.source.trim()) throw new Error(`${at} has no source: where in their files or pages the picture is`);
    if (!/^assets\/pictures\/[^/]+\.(png|jpe?g|webp)$/i.test(pic.file)) throw new Error(`${at}.file must be assets/pictures/<name>.png, .jpg or .webp, got ${JSON.stringify(pic.file)}`);
    if (!existsSync(join(dir, pic.file))) throw new Error(`${at} has no file: copy it to films/glimpse/${pic.file}`);
    if (pic.frame != null && !FRAMES.includes(pic.frame)) throw new Error(`${at}.frame is one of ${FRAMES.join(", ")}`);
    if (pic.crop != null && !(fractions(pic.crop, 4) && pic.crop[0] + pic.crop[2] <= 1 && pic.crop[1] + pic.crop[3] <= 1 && pic.crop[2] > 0 && pic.crop[3] > 0)) throw new Error(`${at}.crop is [x, y, w, h], fractions of the picture that stay inside it`);
    if (pic.focus != null && !fractions(pic.focus, 2)) throw new Error(`${at}.focus is [x, y], fractions of the shown part`);
  });
  if (spec.colors != null) {
    for (const k of ["canvas", "ink", "accent"]) {
      const v = spec.colors[k];
      if (typeof v !== "string" || !HEX.test(v)) throw new Error(`colors.${k} must be an opaque hex colour such as #3f8f5b, got ${JSON.stringify(v)}`);
    }
    if (typeof spec.colors.source !== "string" || !spec.colors.source.trim()) throw new Error("colors has no source: where the files set them");
    const c = contrast(spec.colors.ink, spec.colors.canvas);
    if (c < 4.5) throw new Error(`colors.ink on colors.canvas reads at ${c.toFixed(1)}:1, under 4.5:1: take the brand's text colour and background, or leave colors out for the neutral palette`);
    drawn.colors = "the brand's";
  }
  if (spec.font != null) {
    if (typeof spec.font.family !== "string" || !spec.font.family.trim()) throw new Error("font.family is empty");
    if (typeof spec.font.source !== "string" || !spec.font.source.trim()) throw new Error("font has no source");
    const found = FONT_EXT.map((e) => `assets/fonts/${spec.font.family}.${e}`).find((f) => existsSync(join(dir, f)));
    if (!found) throw new Error(`font "${spec.font.family}" has no file: copy it from their files to films/glimpse/assets/fonts/${spec.font.family}.ttf (or .otf, .woff2), or leave font out for Inter`);
    drawn.font = spec.font.family;
  }
  if (spec.logo != null) {
    if (typeof spec.logo.source !== "string" || !spec.logo.source.trim()) throw new Error("logo has no source");
    if (!["svg", "png"].some((e) => existsSync(join(dir, `assets/logo.${e}`)))) throw new Error("logo has no file: copy it from their files to films/glimpse/assets/logo.svg (or .png), or leave logo out");
    drawn.logo = "their logo";
  }
  drawn.pictures = pictures.length;
  const sheet = writeGlimpseSound(account, spec, pictures.length);
  const tools = dirname(fileURLToPath(import.meta.url));
  return {
    command: "glimpse",
    drawn,
    sheet,
    sound: [
      { cwd: account, command: ["node", join(tools, "soundlib.mjs"), "tone", "films/glimpse/audio", "F", "major"] },
      { cwd: account, command: ["node", join(tools, "mix.mjs"), "films/glimpse/audio"] },
    ],
    next: { cwd: join(account, "films/project"), command: ["npm", "run", "draft", "--", "Glimpse"] },
    out: "films/glimpse/out/glimpse-draft.mp4",
    stills: ["<skill>/tools/stills.sh", "films/glimpse/out/glimpse-draft.mp4", "films/glimpse/out/stills", "--every", "1"],
  };
}

/** The first look's sound sheet, from its clock: every sound is the sound of something on screen. */
function writeGlimpseSound(account, spec, pictures) {
  const clock = JSON.parse(readFileSync(join(account, "films/project/src/films/glimpse/timeline.json"), "utf8"));
  const worlds = clock.variants[String(pictures)];
  if (!worlds) throw new Error(`timeline.json has no clock for ${pictures} pictures`);
  const start = (w) => worlds.find(([name]) => name === w)[1];
  const round = (x) => Math.round(x * 100) / 100;
  const hits = worlds.slice(1).map(([w, at], i) =>
    i % 2 === 0
      ? { sound: "kit/whoosh", at, align: "sync", under: 14, _: `the pan into the ${w} world` }
      : { sound: "tone/riser-1", at, align: "sync", under: 15, _: `the build into the ${w} world, peaking as it lands` },
  );
  const words = spec.lines[0].text.split(/\s+/).filter(Boolean).length;
  hits.push({ sound: "tone/confirm", at: round(start("name") + 0.55), under: 8, _: "the name lands, letter by letter" });
  hits.push({ sound: "tone/resolve", at: round(start("promise") + (12 + words * 3 + 24) / 60), under: 8, _: "the promise's last word lands and its rule draws" });
  hits.sort((a, b) => a.at - b.at);
  const sheet = {
    version: 2,
    loop: false,
    target: { I: -14, TP: -1 },
    _: "Written by film.mjs glimpse from timeline.json: the first look's sound, kit and tonal sounds only ($0).",
    beds: [{ sound: "tone/pad", at: 0, until: "end", under: 18, fadeIn: 0.3, fadeOut: 0.8, _: "the glow of the brand's world, under every scene" }],
    hits,
  };
  const dir = join(account, "films/glimpse/audio");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "cues.json"), JSON.stringify({ duration: clock.duration, lines: [] }, null, 2) + "\n");
  writeFileSync(join(dir, "sfx-cues.json"), JSON.stringify(sheet, null, 2) + "\n");
  return "films/glimpse/audio/sfx-cues.json";
}

// ---------------------------------------------------------------- the command

/** `deps`: { cwd, films } (the folder the command runs in; the skill's films/ folder). Returns { code, line }. */
export async function run(argv, deps) {
  try {
    const { command, flags, slug } = parseArgs(argv);
    const account = resolve(deps.cwd, flags["--dir"] ?? ".");
    if (command === "init") {
      const from = flags["--from"] === undefined ? deps.films : resolve(deps.cwd, flags["--from"]);
      return ok(await init(account, from));
    }
    if (command === "new") return ok(await newFilm(account, slug, flags["--story"] === true));
    if (command === "glimpse") return ok(glimpse(account));
    if (!existsSync(tokensPath(account))) throw needInit(account);
    return ok({ command: "theme", ...applyTheme(account, readTheme(account)) });
  } catch (e) {
    return fail(e.message);
  }
}

// Run as a command, but stay importable for the tests.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const films = resolve(dirname(fileURLToPath(import.meta.url)), "../films");
  const { code, line } = await run(process.argv.slice(2), { cwd: process.cwd(), films });
  console.log(line);
  process.exit(code);
}
