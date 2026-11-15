#!/usr/bin/env node
// Sets up the film project in an account and adds films to it (the skill's films/ folder holds the Remotion project).
//
//   node <skill>/tools/film.mjs init  [--dir <account>] [--from <films-dir>]   copy <skill>/films/ to <account>/films/ (never over an existing films/project), generate films/sfx/, apply the theme; prints the one command left as {"next": {"cwd", "command": [...]}}
//   node <skill>/tools/film.mjs theme [--dir <account>]                        brand/<slug>/style.md's ```tokens block → films/project/src/lib/tokens.json
//   node <skill>/tools/film.mjs new <slug> [--story|--ig-story|--carousel] [--dir <account>]   films/<slug>/ (script, storyboard, audio skeletons), the scenes in films/project/src/films/<slug>/, registered in src/films/index.ts
//   node <skill>/tools/film.mjs sfx <slug> [--dir <account>]                   the sounds of films/<slug>/audio/cues.json's beats → its sfx-cues.json (a story's rules checked first)
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
// With --ig-story they start as a copy of src/films/_ig-story/ (an Instagram Story, production.md → Stories: 8 to 15 s, all
// the words in within the first second, two or three sounds, no music, no voice; id "IgStory", slug "_ig-story"): its
// clock, cues.json with its beats, becomes films/<slug>/audio/cues.json (the sync copies it back to the scenes), and its
// sound sheet is written from those beats at once (sfx below). With --carousel they start as a copy of
// src/films/_carousel/ (carousel.md: 1080×1440 stills, one frame per slide; id "Carousel", slug "_carousel"), and
// films/<slug>/ gets sources.md and caption.txt instead of a script and audio.
//
// sfx reads films/<slug>/audio/cues.json's `beats` ({name: {t, kind?, sound?, fallback?, under?, gain?, align?,
// until?}}, t and until in seconds) and writes one hit per beat with a `sound` into films/<slug>/audio/sfx-cues.json
// (version 2), each marked `"beat": <name>`; the sheet's other hits, beds and music are kept. A library sound
// (`<group>/<name>`) with no take in films/sounds/library.json is replaced by the beat's `fallback` (a kit or tonal
// sound) and the answer says so; with no fallback it is an error. A cue sheet with `"format": "ig-story"` is checked
// first: 8 to 15 s long, every `text` beat starting by 0.7 s (it rises over 0.3 s, so every word is in by 1 s), at most
// three sounds, none from a music or voice group; then the sheet is written with no loop, at the story's quiet level
// (-24 LUFS, -6 dBTP) unless the sheet already sets a target.
//
// glimpse checks films/glimpse/glimpse.json, which the agent writes from the deep read's notes:
//   {"name": {"text", "source"}, "opening": {"text", "source"} | null, "lines": [{"text", "source"}, …2 to 4],
//    "pictures": [{"file", "source", "frame", "crop", "focus"}, …0 to 2] | null,
//    "colors": {"canvas", "ink", "accent", "source"} | null, "font": {"family", "source"} | null, "logo": {"source"} | null}
// Words carry `credit` besides `source`: `source` is where they are (for the record, never drawn), `credit` the short,
// human name of that place the frame shows under them ("rectangleapp.com", "the README"); the opening and every line
// need one, the name none. A credit or caption that reads like a path (a slash, a file's extension, a line number, a
// URL's scheme) is refused: no file path is ever drawn.
// A picture is the product at work, from their files or pages: a screenshot, or a short clip (.mp4, .webm or .mov, a
// GIF turned into one with ffmpeg, `clip` [from, to] in seconds, at most 5 s, always muted), copied to
// films/glimpse/assets/pictures/: `file` is its path there; `line` the index of the line it shows happening (set above
// it); `caption` a short human credit when there is no line; `frame` "window" or "phone" for a bare screen the film
// frames, "none" for one that has its frame already; `crop` [x, y, w, h] and `focus` [x, y] are fractions of it (the
// part shown, and the detail the camera pushes in on). An icon or a logo is not a picture: it is the name's world. Then it writes films/glimpse/audio/:
// cues.json and the sound sheet (sfx-cues.json, version 2) from the film's own clock
// (films/project/src/films/glimpse/timeline.json): a soft bed under it all, a pass on each change of world, a mark when
// the name lands and when the promise does; kit and tonal sounds only, $0. Its answer gives the sound commands, in
// order (the tonal set, then the mix), before the render.
// It is made from the deep read, never instead of it: it refuses until the newest marketing/onboarding/<date>/ holds
// the ten area notes (onboarding.md → 1), each read for real (at least 40 words, its `## Not found`, no "not read"
// stub), every `source` in glimpse.json is found in those notes, and, when the folder's first progress line says
// `git_commit: on` in a git repository, the notes are committed. The opening says its kind, "action" (what the product
// does) or "number" (it has a figure), and a tagline of qualities ("Free and Open Source") is refused. The accent must
// be a colour (saturation at least 0.35), not a grey. A screenshot needs a crop at most half the picture's width, so
// its words read on a phone; or the picture is `{"demo": "drag-snap", "line": n}`, the kit's drawing of a thing
// dragged to an edge and snapping into place, in the brand's colours, for a line that promises that action.
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
import { spawnSync } from "node:child_process";
import { run as runKit } from "./sfx-kit.mjs";

const USAGE = "usage: film.mjs init [--dir <account>] [--from <films-dir>] | theme [--dir <account>] | new <slug> [--story|--ig-story|--carousel] [--dir <account>] | sfx <slug> [--dir <account>] | glimpse [--dir <account>]";
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
/** An Instagram Story (production.md → Stories), and a carousel of stills (carousel.md). */
const IG_STORY = { dir: "_ig-story", id: "IgStory", slug: "_ig-story" };
const CAROUSEL = { dir: "_carousel", id: "Carousel", slug: "_carousel" };
const KINDS = { "--story": "story", "--ig-story": "ig-story", "--carousel": "carousel" };
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
  const allowed = { init: ["--dir", "--from"], theme: ["--dir"], new: ["--dir", ...Object.keys(KINDS)], sfx: ["--dir"], glimpse: ["--dir"] }[command];
  if (!allowed) throw new Error(USAGE);
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] in KINDS && allowed.includes(rest[i])) {
      if (flags.kind !== undefined) throw new Error(`one of --story, --ig-story and --carousel at most. ${USAGE}`);
      flags.kind = KINDS[rest[i]];
    } else if (rest[i].startsWith("--")) {
      if (!allowed.includes(rest[i]) || rest[i + 1] === undefined || flags[rest[i]] !== undefined) throw new Error(USAGE);
      flags[rest[i]] = rest[++i];
    } else positional.push(rest[i]);
  }
  const takesSlug = command === "new" || command === "sfx";
  if (positional.length !== (takesSlug ? 1 : 0)) {
    if (takesSlug && positional.length === 0) throw new Error(`${command} needs a slug. ${USAGE}`);
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
const CAROUSEL_SOURCES = "# <slug>: sources\n\nEvery outside claim on a slide: the slide, the claim, the source (a primary one), its date, the exact quote.\nA number with no credible source is dropped; an illustrative number reads as an example.\n\n| Slide | Claim | Source | Date | Quote |\n| --- | --- | --- | --- | --- |\n";
const CAROUSEL_CAPTION = "The hook line.\n\n→ the facts, one a line\n\nThe turn.\nWhat it does, in plain words.\nThe payoff, in one line.\n\nSources: \n\n";
const STORY_WORDS = "# <slug>: the story's words\n\nWhose words (the person's, or the step's idea they took):\nTrue on (a date, when a word like \"yesterday\" or \"right now\" is in it):\nThe link, if any (the person adds the sticker in the app):\n";
const headingsOnly = (text, slug) =>
  text.split("\n").filter((l) => /^#{1,6}\s/.test(l)).map((l) => l.replace(/starter/gi, slug)).join("\n\n") + "\n";
/** A script's skeleton: one numbered line, and each label (`Structure:`) with its text removed. */
const scriptSkeleton = (text) =>
  ["1.", "", ...text.split("\n").map((l) => /^[A-Za-z][A-Za-z ]*:/.exec(l)?.[0]).filter(Boolean)].join("\n") + "\n";
/** The template's id and slug, quoted in its code, become the new film's. */
const QUOTED = (word) => new RegExp(`(["'])${word}\\1`, "g");
const renamed = (text, id, slug, tpl = TEMPLATE) => text.replace(QUOTED(tpl.id), `$1${id}$1`).replace(QUOTED(tpl.slug), `$1${slug}$1`);

async function newFilm(account, slug, kind = "loop") {
  const story = kind === "story";
  const tpl = { loop: TEMPLATE, story: STORY, "ig-story": IG_STORY, carousel: CAROUSEL }[kind];
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

  let sound = null;
  try {
    if (kind === "carousel") {
      mkdirSync(filmDir, { recursive: true });
      writeFileSync(join(filmDir, "sources.md"), CAROUSEL_SOURCES.replace("<slug>", slug));
      writeFileSync(join(filmDir, "caption.txt"), CAROUSEL_CAPTION);
    } else if (kind === "ig-story") {
      mkdirSync(join(filmDir, "audio"), { recursive: true });
      writeFileSync(join(filmDir, "audio/cues.json"), readFileSync(join(template, "cues.json"), "utf8"));
      writeFileSync(join(filmDir, "words.md"), STORY_WORDS.replace("<slug>", slug));
    } else {
      mkdirSync(join(filmDir, "audio"), { recursive: true });
      writeFileSync(join(filmDir, "script.txt"), scriptSkeleton(readOptional(join(starterFilm, "script.txt")) ?? SCRIPT_LABELS));
      writeFileSync(join(filmDir, "STORYBOARD.md"), headingsOnly((story ? readOptional(join(starterFilm, "STORYBOARD.md")) : null) ?? (story ? STORY_HEADINGS : STORYBOARD_HEADINGS), slug));
      writeFileSync(join(filmDir, "audio/cues.json"), JSON.stringify({ duration: 0, lines: [] }, null, 2) + "\n");
      writeFileSync(join(filmDir, "audio/sfx-cues.json"), JSON.stringify({ version: 2, loop: !story, hits: [], beds: [], music: { segments: [] } }, null, 2) + "\n");
    }
    for (const file of copyTree(template, scenesDir)) {
      if (/\.(ts|tsx)$/.test(file)) writeFileSync(file, renamed(readFileSync(file, "utf8"), id, slug, tpl));
    }
    const indent = /^\s*/.exec(lines[at.listEnd[0]])[0];
    lines.splice(at.listEnd[0], 0, `${indent}${name},`);
    lines.splice(at.importsEnd[0], 0, `import {film as ${name}} from './${slug}';`);
    writeFileSync(indexPath, lines.join("\n"));
    if (kind === "ig-story") sound = beatSound(account, slug);
  } catch (e) {
    rmSync(filmDir, { recursive: true, force: true });
    rmSync(scenesDir, { recursive: true, force: true });
    throw e;
  }
  const made = { command: "new", slug, id, format: kind, film: `films/${slug}`, scenes: `films/project/src/films/${slug}`, registered: true };
  if (kind === "ig-story") return { ...made, sound, next: `write the words in ${made.scenes}/Story.tsx (WORDS) and words.md; move beats in films/${slug}/audio/cues.json, then film.mjs sfx ${slug}` };
  if (kind === "carousel") return { ...made, next: `write the slides in ${made.scenes}/slides.ts, the sources in films/${slug}/sources.md; render with npm run slides -- ${id} (carousel.md)` };
  return made;
}

// ---------------------------------------------------------------- sfx

/** A sound a story never takes: music and voices (a story is effects only). */
const NOT_IN_A_STORY = /^(music|voice|vo)\//;
const STORY_TARGET = { I: -24, TP: -6 };

/** The rules of a story's clock (production.md → Stories). Throws naming the beat. */
function checkStory(cues) {
  const d = cues.duration;
  if (typeof d !== "number" || d < 8 || d > 15) throw new Error(`a story is 8 to 15 s long: duration is ${JSON.stringify(d)}`);
  const beats = Object.entries(cues.beats);
  for (const [name, b] of beats) {
    if (b.kind === "text" && b.t > 0.7) throw new Error(`the text beat ${name} starts at ${b.t} s: every word is on screen within the first second, so a text beat starts by 0.7 s (it rises over 0.3 s)`);
  }
  const sounds = beats.filter(([, b]) => b.sound !== undefined);
  if (sounds.length > 3) throw new Error(`a story has two or three sounds at most, this one has ${sounds.length} (${sounds.map(([n]) => n).join(", ")}): one sound for the whole burst of words, never one per line`);
  for (const [name, b] of sounds) {
    for (const id of [b.sound, b.fallback]) if (id !== undefined && NOT_IN_A_STORY.test(id)) throw new Error(`the beat ${name} plays ${id}: a story has no music and no voice`);
  }
}

/** The account's library: the ids that have at least one take. */
function libraryIds(account) {
  const text = readOptional(join(account, "films/sounds/library.json"));
  const sounds = text === null ? {} : (JSON.parse(text).sounds ?? {});
  return new Set(Object.entries(sounds).filter(([, s]) => (s.variants ?? []).length > 0).map(([id]) => id));
}

/** films/<slug>/audio/cues.json's beats → hits in its sfx-cues.json. Returns what it wrote. */
function beatSound(account, slug) {
  if (!slug || !SLUG.test(slug)) throw new Error(`${JSON.stringify(slug ?? "")} is not a slug`);
  const audio = join(account, "films", slug, "audio");
  const cuesPath = join(audio, "cues.json");
  const text = readOptional(cuesPath);
  if (text === null) throw new Error(`no films/${slug}/audio/cues.json`);
  const cues = JSON.parse(text);
  if (!cues.beats || typeof cues.beats !== "object") throw new Error(`films/${slug}/audio/cues.json has no beats: sfx places a sound on a beat ({"beats": {"<name>": {"t": <s>, "sound": "<id>"}}})`);
  for (const [name, b] of Object.entries(cues.beats)) {
    if (typeof b.t !== "number" || b.t < 0) throw new Error(`the beat ${name} needs a time t, in seconds`);
    if (b.until !== undefined && !(typeof b.until === "number" && b.until > b.t)) throw new Error(`the beat ${name}: until is a time in seconds after its t`);
  }
  const story = cues.format === "ig-story";
  if (story) checkStory(cues);
  const have = libraryIds(account);
  const swapped = [];
  const hits = [];
  for (const [name, b] of Object.entries(cues.beats)) {
    if (b.sound === undefined) continue;
    let sound = b.sound;
    if (/^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(sound) && !/^(kit|tone)\//.test(sound) && !have.has(sound)) {
      if (b.fallback === undefined) throw new Error(`the beat ${name} plays ${sound}, which the library has no take of, and names no fallback: make it (soundlib.mjs gen) or give the beat a "fallback" from the kit`);
      swapped.push({ beat: name, wanted: sound, plays: b.fallback });
      sound = b.fallback;
    }
    const hit = { sound, at: b.t, beat: name };
    for (const k of ["align", "under", "gain", "until"]) if (b[k] !== undefined) hit[k] = b[k];
    if (hit.under === undefined && hit.gain === undefined) hit.under = 12;
    hits.push(hit);
  }
  const sheetPath = join(audio, "sfx-cues.json");
  const old = readOptional(sheetPath);
  const sheet = old === null ? { version: 2, loop: !story, hits: [], beds: [], music: { segments: [] } } : JSON.parse(old);
  if (sheet.version !== 2) throw new Error(`films/${slug}/audio/sfx-cues.json is not a version-2 sheet: sfx writes only version 2`);
  if (story) {
    sheet.loop = false;
    sheet.target ??= STORY_TARGET;
  }
  sheet.hits = [...(sheet.hits ?? []).filter((h) => h.beat === undefined), ...hits].sort((a, b) => a.at - b.at);
  writeFileSync(sheetPath, JSON.stringify(sheet, null, 2) + "\n");
  return { sheet: `films/${slug}/audio/sfx-cues.json`, hits: hits.length, ...(swapped.length ? { fallback: swapped } : {}) };
}

// ---------------------------------------------------------------- glimpse

const LIMITS = { name: 40, opening: 24, line: 90 };
const AREAS = ["docs", "site", "prices", "interface", "look", "marketing", "history", "public", "profiles", "competitors"];
const STUB = /not (yet )?read in this pass|not read yet|\bTODO\b|\bTBD\b|placeholder|notes not yet written/i;
const DEMOS = ["drag-snap"];
const QUALITY = new Set("free open source simple fast easy powerful modern lightweight best beautiful secure private and the a an for your you with of to in on open-source native tiny smart".split(" "));
/** The deep read's notes: the newest marketing/onboarding/<date>/, each area's note read for real; their text. */
function readNotes(account) {
  const root = join(account, "marketing/onboarding");
  const dates = isDir(root) ? readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && isDir(join(root, d))).sort() : [];
  if (!dates.length) throw new Error("no marketing/onboarding/<date>/: the first look is made from the deep read's notes, so read first (onboarding.md → 1)");
  const dir = join(root, dates[dates.length - 1]);
  const bad = [];
  for (const a of AREAS) {
    const t = readOptional(join(dir, `${a}.md`));
    if (t === null) bad.push(`${a}.md missing`);
    else if (STUB.test(t)) bad.push(`${a}.md is a stub`);
    else if (t.split(/\s+/).filter(Boolean).length < 40) bad.push(`${a}.md has under 40 words`);
    else if (!/^## Not found/m.test(t)) bad.push(`${a}.md has no "## Not found"`);
  }
  if (bad.length) throw new Error(`the deep read is not done (${bad.join("; ")}): write every area's note from what you read, with sources, before the first look (onboarding.md → 1)`);
  const text = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  const progress = readOptional(join(dir, "progress.md")) ?? "";
  if (/^git_commit:\s*on\b/m.test(progress) && isDir(join(account, ".git"))) {
    const rel = relative(account, dir);
    const st = spawnSync("git", ["-C", account, "status", "--porcelain", "--", rel], { encoding: "utf8" });
    const tracked = spawnSync("git", ["-C", account, "ls-files", "--", join(rel, "look.md")], { encoding: "utf8" });
    if (st.status !== 0 || st.stdout.trim() || !tracked.stdout.trim()) throw new Error(`the deep read's notes in ${rel}/ are not committed (git_commit: on): Save step 1 first (SKILL.md → Rules → Save), then the first look`);
  }
  return text;
}
/** The places a source names: its URLs (scheme and "read <date>" left out) and its file paths (with the line). */
const locators = (src) => [
  ...[...src.matchAll(/https?:\/\/([^\s,;)]+)/g)].map((m) => m[1].replace(/\/+$/, "")),
  ...[...src.replace(/https?:\/\/[^\s,;)]+/g, " ").matchAll(/[\w.-]+(?:\/[\w.@-]+)*\.[A-Za-z]{1,10}(?::\d+(?:-\d+)?)?/g)].map((m) => m[0]).filter((x) => !/^\d/.test(x)),
];
function sourcedInNotes(src, where, notes) {
  if (/^the person\b/i.test(src.trim())) return;
  const locs = locators(src);
  const missing = locs.filter((l) => !notes.includes(l));
  if (!locs.length || missing.length) throw new Error(`${where}'s source ${JSON.stringify(src)} is not in the deep read's notes${missing.length ? ` (${missing.join(", ")} not found there)` : ""}: every fact in the first look comes from a note`);
}
const saturation = (hex) => {
  const h = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
};
const FRAMES = ["window", "phone", "none"];
const PATHLIKE = /https?:\/\/|[\w.~-]*\/[\w.~-]+|\.(md|mdx|json|ya?ml|png|jpe?g|gif|svg|webp|mp4|webm|mov|swift|tsx?|jsx?|mjs|css|scss|html?|xcstrings|strings|plist|txt|icon)\b|:\d+\b/i;
function shown(value, where) {
  if (value == null) return;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${where} is empty: leave it out, or give the place's short name`);
  if (value.length > 40) throw new Error(`${where} is ${value.length} characters, at most 40: the place's short name, such as "rectangleapp.com" or "the README"`);
  if (PATHLIKE.test(value)) throw new Error(`${where} ${JSON.stringify(value)} reads like a path: the frame shows a place's short human name ("rectangleapp.com", "the README", "the app"), never a file path; the path stays in source`);
}
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

function said(value, where, limit, credited = true) {
  if (!value || typeof value !== "object") throw new Error(`${where} must be {"text", "source"}`);
  if (typeof value.text !== "string" || !value.text.trim()) throw new Error(`${where}.text is empty`);
  if (typeof value.source !== "string" || !value.source.trim()) throw new Error(`${where} has no source: a word on screen comes from the product's own files or pages, with where`);
  if (value.text.length > limit) throw new Error(`${where}.text is ${value.text.length} characters, at most ${limit}: pick a shorter phrase of theirs, never a rewrite`);
  if (credited && !value.credit) throw new Error(`${where} has no credit: words on screen carry the short name of where they are from ("rectangleapp.com", "the README")`);
  shown(value.credit, `${where}.credit`);
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
  const notes = readNotes(account);
  said(spec.name, "name", LIMITS.name, false);
  if (spec.opening != null) {
    said(spec.opening, "opening", LIMITS.opening);
    const kind = spec.opening.kind;
    if (kind !== "action" && kind !== "number") throw new Error(`opening.kind is "action" (a line of what the product does) or "number" (a figure from their pages)`);
    if (kind === "number" && !/\d/.test(spec.opening.text)) throw new Error("opening.kind is number, but the opening has no figure in it");
    const words = spec.opening.text.toLowerCase().match(/[a-z-]+/g) ?? [];
    if (kind === "action" && (words.every((w) => QUALITY.has(w)) || /^the\b.*\bfor\b/i.test(spec.opening.text))) throw new Error(`the opening ${JSON.stringify(spec.opening.text)} is a tagline of qualities, not an action or a number: open on a line of what the product does ("Pick your snap areas"), or a figure; or leave the opening out`);
  }
  if (!Array.isArray(spec.lines) || spec.lines.length < 2 || spec.lines.length > 4) throw new Error("lines must hold 2 to 4 of the product's own lines");
  spec.lines.forEach((l, i) => said(l, `lines[${i}]`, LIMITS.line));
  const drawn = { colors: "neutral", font: "Inter", logo: "the name" };
  for (const [w, v] of [["name", spec.name], ["opening", spec.opening], ...spec.lines.map((l, i) => [`lines[${i}]`, l])]) if (v) sourcedInNotes(v.source, w, notes);
  const pictures = spec.pictures ?? [];
  if (!Array.isArray(pictures) || pictures.length > 2) throw new Error("pictures must be a list of at most 2");
  pictures.forEach((pic, i) => {
    const at = `pictures[${i}]`;
    if (pic && pic.demo != null) {
      if (!DEMOS.includes(pic.demo)) throw new Error(`${at}.demo is one of ${DEMOS.join(", ")}`);
      if (!(Number.isInteger(pic.line) && pic.line >= 0 && pic.line < spec.lines.length)) throw new Error(`${at} is a demo: its line is the index of the line whose action it draws`);
      return;
    }
    if (!pic || typeof pic.file !== "string" || !pic.file.trim()) throw new Error(`${at}.file is empty`);
    if (typeof pic.source !== "string" || !pic.source.trim()) throw new Error(`${at} has no source: where in their files or pages the picture is`);
    if (!/^assets\/pictures\/[^/]+\.(png|jpe?g|webp|mp4|webm|mov)$/i.test(pic.file)) throw new Error(`${at}.file must be assets/pictures/<name>.png, .jpg, .webp, or a clip .mp4, .webm or .mov, got ${JSON.stringify(pic.file)}`);
    if (/icon|logo/i.test(pic.file) || /\bapp ?icon\b|appiconset|\.icon\b|\blogo\b/i.test(pic.source)) throw new Error(`${at} is an icon or a logo: that is the name's world (logo), not a picture of the product at work; take a screenshot or a demo instead, or leave pictures out`);
    shown(pic.caption, `${at}.caption`);
    if (pic.line != null && !(Number.isInteger(pic.line) && pic.line >= 0 && pic.line < spec.lines.length)) throw new Error(`${at}.line is the index of one of the lines, 0 to ${spec.lines.length - 1}`);
    sourcedInNotes(pic.source, at, notes);
    if (!/\.(mp4|webm|mov)$/i.test(pic.file) && !(fractions(pic.crop, 4) && pic.crop[2] <= 0.5)) throw new Error(`${at} is a screenshot: crop it to the region that shows the line, at most half its width ([x, y, w, h] with w ≤ 0.5), so its words read on a phone; or draw the action instead ({"demo": "drag-snap", "line": n})`);
    if (/\.(mp4|webm|mov)$/i.test(pic.file)) {
      const c = pic.clip;
      if (!(Array.isArray(c) && c.length === 2 && c.every((x) => typeof x === "number" && x >= 0) && c[1] > c[0] && c[1] - c[0] <= 5)) throw new Error(`${at} is a clip: clip is [from, to] in seconds, at most 5 s of it`);
    }
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
    const sat = saturation(spec.colors.accent);
    if (sat < 0.35) throw new Error(`colors.accent ${spec.colors.accent} is a grey (saturation ${sat.toFixed(2)}): the accent is the most saturated colour of the logo or the brand, not a gradient stop of a background; when unsure, show both in the say-back and ask`);
    sourcedInNotes(spec.colors.source, "colors", notes);
    drawn.colors = "the brand's";
  }
  if (spec.font != null) {
    if (typeof spec.font.family !== "string" || !spec.font.family.trim()) throw new Error("font.family is empty");
    if (typeof spec.font.source !== "string" || !spec.font.source.trim()) throw new Error("font has no source");
    sourcedInNotes(spec.font.source, "font", notes);
    const found = FONT_EXT.map((e) => `assets/fonts/${spec.font.family}.${e}`).find((f) => existsSync(join(dir, f)));
    if (!found) throw new Error(`font "${spec.font.family}" has no file: copy it from their files to films/glimpse/assets/fonts/${spec.font.family}.ttf (or .otf, .woff2), or leave font out for Inter`);
    drawn.font = spec.font.family;
  }
  if (spec.logo != null) {
    if (typeof spec.logo.source !== "string" || !spec.logo.source.trim()) throw new Error("logo has no source");
    sourcedInNotes(spec.logo.source, "logo", notes);
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
  const pics = spec.pictures ?? [];
  let k = 0;
  for (const [w, at] of worlds) {
    if (w !== "picture") continue;
    const pic = pics[k++];
    if (pic?.demo) for (const [j, snap] of clock.demos[pic.demo].snaps.entries()) hits.push({ sound: j === 0 ? "tone/blip-1" : "tone/blip-2", at: round(at + snap), under: 14, _: `the dragged window snaps into place (${j === 0 ? "the right half" : "the top-left quarter"})` });
  }
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
    if (command === "new") return ok(await newFilm(account, slug, flags.kind ?? "loop"));
    if (command === "sfx") return ok({ command: "sfx", slug, ...beatSound(account, slug) });
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
