// tools/film.mjs: init, theme and new, on a miniature copy of the project layout built here in a temp folder.
// The real project is not needed: the tests pass --from to point `init` at the miniature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../skills/boqount/tools/film.mjs";

const cli = fileURLToPath(new URL("../skills/boqount/tools/film.mjs", import.meta.url));

const DEFAULTS = { canvas: "#0b0b0f", panel: "#16161d", ink: "#f4f4f6", muted: "#8b8b99", accent: "#5b8cff", accent2: "#ffb84d", danger: "#ff5c5c", font_display: "Inter", font_text: "Inter", radius: 24, motion: "snappy" };
const INDEX = `// films:start
import {film as starter} from './starter';
// films:end
export const FILMS = [
  // films:list:start
  starter,
  // films:list:end
];
`;
const STARTER_INDEX = `import {Film} from './Film';
import cues from './cues.json';
export const film = { id: "Starter", slug: "starter", component: Film, durationInFrames: 120 };
`;
const TEMPLATE_INDEX = `import {Film} from './Film';
export const film = { id: "Template", slug: "_template", component: Film, durationInFrames: 960 };
`;
const TEMPLATE_SCENES = `// The Template film's scenes.
export const ID = 'Template';
export const SLUG = "_template";
`;
const SCRIPT = `1. Water it when the soil is dry.
2. Quillfern reminds you.
Structure: hook, reminder, loop
`;
const STORYBOARD = `# Starter storyboard

The film is one plant carried through.

## Locked format

- Frame 0 is a finished picture.

## Chain

| Scene | Inherits | Hands on |
| --- | --- | --- |
| hook | a pot | a leaf |

## Sound

A pop for every tile.
`;
const STYLE = `# Quillfern style

Calm, leafy, a little dry humour.

\`\`\`tokens
canvas: #f3f7ee
panel: #ffffff
ink: #1d2a1f
accent: #3f8f5b
radius: 32
motion: smooth
\`\`\`
`;

/** The skill's films/ folder in miniature (what --from points at). */
function skillFilms() {
  const root = mkdtempSync(join(tmpdir(), "boqount-films-"));
  const put = (path, text) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put("project/package.json", '{ "name": "films-project" }\n');
  put("project/src/lib/tokens.json", JSON.stringify(DEFAULTS, null, 2) + "\n");
  put("project/src/films/index.ts", INDEX);
  put("project/src/films/starter/index.ts", STARTER_INDEX);
  put("project/src/films/starter/Film.tsx", "export const Film = () => null;\n");
  put("project/src/films/starter/cues.json", '{ "duration": 4, "lines": [] }\n');
  put("project/src/films/_template/index.ts", TEMPLATE_INDEX);
  put("project/src/films/_template/Film.tsx", "export const Film = () => 'template';\n");
  put("project/src/films/_template/Scenes.tsx", TEMPLATE_SCENES);
  put("project/src/films/_template/cues.json", '{ "duration": 0, "lines": [] }\n');
  put("project/node_modules/left-pad/index.js", "module.exports = 1;\n");
  put("project/public/audio/starter/mix.wav", "RIFF");
  put("project/out/starter.mp4", "mp4");
  put("starter/script.txt", SCRIPT);
  put("starter/STORYBOARD.md", STORYBOARD);
  put("starter/audio/cues.json", '{ "duration": 4, "lines": [{ "id": "hook" }] }\n');
  put("starter/audio/sfx-cues.json", '{ "loop": true, "hits": [{ "sfx": "pop", "at": 0, "gain": -12 }], "music": { "segments": [] } }\n');
  put("starter/audio/vo.wav", "RIFF");
  put("starter/audio/mix.wav", "RIFF");
  put("starter/audio/sfx/pop.wav", "RIFF");
  return root;
}

/** An account folder: marketing/config.md naming the brand, and the brand's style.md. */
function account({ style = STYLE, brand = "quillfern" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "boqount-acct-"));
  mkdirSync(join(dir, "marketing"), { recursive: true });
  writeFileSync(join(dir, "marketing/config.md"), `# Account config\n\n\`\`\`config\nbrand: ${brand}\nchannels: instagram\n\`\`\`\n`);
  if (style !== null) {
    mkdirSync(join(dir, `brand/${brand}`), { recursive: true });
    writeFileSync(join(dir, `brand/${brand}/style.md`), style);
  }
  return dir;
}
/** Runs a command in-process; the result's `out` is the parsed JSON line. */
async function film(argv, { cwd, from } = {}) {
  const { code, line } = await run(argv, { cwd: cwd ?? tmpdir(), films: from });
  assert.equal(line.split("\n").length, 1, "one line");
  return { code, out: JSON.parse(line) };
}
const read = (dir, path) => readFileSync(join(dir, path), "utf8");
const tokens = (dir) => JSON.parse(read(dir, "films/project/src/lib/tokens.json"));
async function initialized(opts) {
  const from = skillFilms();
  const dir = account(opts);
  const r = await film(["init", "--dir", dir, "--from", from]);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  return { dir, from };
}

// ---------------------------------------------------------------- init

test("init copies the project and the starter into films/, leaving out what is generated", async () => {
  const dir = account();
  const r = await film(["init", "--dir", dir, "--from", skillFilms()]);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.equal(read(dir, "films/project/package.json"), '{ "name": "films-project" }\n');
  assert.equal(read(dir, "films/project/src/films/starter/Film.tsx"), "export const Film = () => null;\n");
  assert.equal(read(dir, "films/starter/script.txt"), SCRIPT);
  assert.equal(read(dir, "films/starter/audio/sfx-cues.json").includes('"loop": true'), true);
  for (const gone of ["films/project/node_modules", "films/project/public", "films/project/out", "films/starter/audio/vo.wav", "films/starter/audio/mix.wav", "films/starter/audio/sfx"]) {
    assert.equal(existsSync(join(dir, gone)), false, `${gone} must not be copied`);
  }
});

test("init generates the sound kit in films/sfx and applies the theme", async () => {
  const dir = account();
  const r = await film(["init", "--dir", dir, "--from", skillFilms()]);
  assert.equal(readdirSync(join(dir, "films/sfx")).length, 16);
  assert.equal(readFileSync(join(dir, "films/sfx/pop.wav")).toString("ascii", 0, 4), "RIFF");
  assert.equal(tokens(dir).accent, "#3F8F5B");
  assert.equal(r.out.sfx.files, 16);
  assert.equal(r.out.theme.applied, true);
});

test("init gives the one command left as a folder and an argument list, not a shell string", async () => {
  const dir = account();
  const { out } = await film(["init", "--dir", dir, "--from", skillFilms()]);
  assert.deepEqual(out.next, { cwd: join(dir, "films/project"), command: ["npm", "install"] });
});

test("init without a brand style leaves the default tokens and says so", async () => {
  const dir = account({ style: null });
  const { code, out } = await film(["init", "--dir", dir, "--from", skillFilms()]);
  assert.equal(code, 0);
  assert.equal(out.theme.applied, false);
  assert.deepEqual(tokens(dir), DEFAULTS);
});

test("init with a bad tokens line stops before it writes anything", async () => {
  const dir = account({ style: "```tokens\naccent: green\n```\n" });
  const r = await film(["init", "--dir", dir, "--from", skillFilms()]);
  assert.equal(r.code, 1);
  assert.match(r.out.error, /line 2.*accent/);
  assert.equal(existsSync(join(dir, "films")), false);
});

test("init never goes over an existing films/project", async () => {
  const { dir, from } = await initialized();
  writeFileSync(join(dir, "films/project/MINE.txt"), "keep");
  const again = await film(["init", "--dir", dir, "--from", from]);
  assert.equal(again.code, 1);
  assert.match(again.out.error, /films\/project/);
  assert.equal(read(dir, "films/project/MINE.txt"), "keep");
});

test("init does not overwrite a file already under films/", async () => {
  const dir = account();
  mkdirSync(join(dir, "films/starter"), { recursive: true });
  writeFileSync(join(dir, "films/starter/script.txt"), "my own words\n");
  const r = await film(["init", "--dir", dir, "--from", skillFilms()]);
  assert.equal(r.code, 0);
  assert.equal(read(dir, "films/starter/script.txt"), "my own words\n");
  assert.equal(existsSync(join(dir, "films/starter/STORYBOARD.md")), true);
});

test("init takes the current folder when --dir is not given, and reports a --from with no project", async () => {
  const dir = account();
  const r = await film(["init", "--from", skillFilms()], { cwd: dir });
  assert.equal(r.code, 0);
  assert.equal(existsSync(join(dir, "films/project/package.json")), true);

  const empty = mkdtempSync(join(tmpdir(), "boqount-empty-"));
  const bad = await film(["init", "--dir", account(), "--from", empty]);
  assert.equal(bad.code, 1);
  assert.match(bad.out.error, /project/);
});

// ---------------------------------------------------------------- theme

test("theme writes the tokens block into tokens.json and keeps the keys it does not set", async () => {
  const { dir } = await initialized();
  const r = await film(["theme", "--dir", dir]);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.deepEqual(tokens(dir), { ...DEFAULTS, canvas: "#F3F7EE", panel: "#FFFFFF", ink: "#1D2A1F", accent: "#3F8F5B", radius: 32, motion: "smooth" });
  assert.equal(r.out.slug, "quillfern");
  assert.deepEqual(r.out.set.sort(), ["accent", "canvas", "ink", "motion", "panel", "radius"]);
});

test("theme reads fonts, with or without quotes, and writes every colour as six-digit upper-case hex", async () => {
  const style = "```tokens\nfont_display: \"Fraunces\"\nfont_text: Inter Tight\ndanger: #e33\nink: #fAfAf9\n```\n";
  const { dir } = await initialized({ style });
  assert.equal(tokens(dir).font_display, "Fraunces");
  assert.equal(tokens(dir).font_text, "Inter Tight");
  assert.equal(tokens(dir).danger, "#EE3333");
  assert.equal(tokens(dir).ink, "#FAFAF9");
});

test("theme with no style.md, or a style.md without a tokens block, changes nothing and says why", async () => {
  for (const style of [null, "# Quillfern style\n\nNo tokens here.\n"]) {
    const { dir } = await initialized({ style });
    const r = await film(["theme", "--dir", dir]);
    assert.equal(r.code, 0);
    assert.equal(r.out.applied, false);
    assert.match(r.out.note, /default/i);
    assert.deepEqual(tokens(dir), DEFAULTS);
  }
});

test("theme with no brand in the config changes nothing and says why", async () => {
  const { dir } = await initialized({ style: null });
  writeFileSync(join(dir, "marketing/config.md"), "```config\nbrand: <slug of brand/<slug>/>\n```\n");
  const r = await film(["theme", "--dir", dir]);
  assert.equal(r.code, 0);
  assert.equal(r.out.applied, false);
  assert.match(r.out.note, /brand/);
});

test("theme names the line of an unknown key or a bad value, and writes nothing", async () => {
  const cases = [
    ["```tokens\naccent: #3f8f5b\ncolour: #fff\n```\n", /line 5.*colour/],
    ["```tokens\naccent: green\n```\n", /line 4.*accent.*hex/i],
    ["```tokens\naccent: #12345\n```\n", /line 4/],
    ["```tokens\naccent: #3f8f5b80\n```\n", /line 4.*accent.*alpha/],
    ["```tokens\naccent: #3f8a\n```\n", /line 4.*accent.*alpha/],
    ["```tokens\nradius: wide\n```\n", /line 4.*radius.*number/i],
    ["```tokens\nradius: -4\n```\n", /line 4.*radius/],
    ["```tokens\nmotion: wobbly\n```\n", /line 4.*motion.*snappy.*smooth.*bouncy/],
    ["```tokens\naccent #fff\n```\n", /line 4/],
    ["```tokens\naccent: #aaa\naccent: #bbb\n```\n", /line 5.*accent.*twice|line 5.*duplicate/i],
    ["```tokens\nfont_text:\n```\n", /line 4.*font_text/],
    ["```tokens\nfont_text: Inter; } body { x\n```\n", /line 4.*font_text.*family/],
    ["```tokens\nfont_display: \"Inter\\\"\n```\n", /line 4.*font_display/],
  ];
  for (const [block, pattern] of cases) {
    const { dir } = await initialized();
    writeFileSync(join(dir, "brand/quillfern/style.md"), `# Style\n\n${block}`);
    const before = tokens(dir);
    const r = await film(["theme", "--dir", dir]);
    assert.equal(r.code, 1, block);
    assert.match(r.out.error, pattern, block);
    assert.deepEqual(tokens(dir), before, `${block}: nothing written`);
  }
});

test("theme without a project asks for init first", async () => {
  const r = await film(["theme", "--dir", account()]);
  assert.equal(r.code, 1);
  assert.match(r.out.error, /init/);
});

// ---------------------------------------------------------------- new

test("new creates the film's folder: emptied script and storyboard, audio skeletons", async () => {
  const { dir } = await initialized();
  const r = await film(["new", "dry-spell", "--dir", dir]);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  const script = read(dir, "films/dry-spell/script.txt");
  assert.match(script, /^Structure:\s*$/m);
  assert.doesNotMatch(script, /soil|reminds|hook/);
  const board = read(dir, "films/dry-spell/STORYBOARD.md");
  assert.deepEqual(board.split("\n").filter((l) => l.trim()), ["# Starter storyboard", "## Locked format", "## Chain", "## Sound"].map((h) => h.replace("Starter storyboard", "dry-spell storyboard")));
  assert.doesNotMatch(board, /plant|Frame 0|pop for/);
  assert.deepEqual(JSON.parse(read(dir, "films/dry-spell/audio/cues.json")), { duration: 0, lines: [] });
  assert.deepEqual(JSON.parse(read(dir, "films/dry-spell/audio/sfx-cues.json")), { version: 2, loop: true, hits: [], beds: [], music: { segments: [] } });
  assert.deepEqual(readdirSync(join(dir, "films/dry-spell/audio")).sort(), ["cues.json", "sfx-cues.json"]);
});

test("new copies the template's scenes with the id and slug renamed, and registers the film between the markers", async () => {
  const { dir } = await initialized();
  const r = await film(["new", "dry-spell", "--dir", dir]);
  assert.equal(r.out.id, "DrySpell");
  const scenes = "films/project/src/films/dry-spell";
  assert.equal(read(dir, `${scenes}/Film.tsx`), "export const Film = () => 'template';\n");
  assert.deepEqual(JSON.parse(read(dir, `${scenes}/cues.json`)), { duration: 0, lines: [] });
  const index = read(dir, `${scenes}/index.ts`);
  assert.match(index, /id: "DrySpell"/);
  assert.match(index, /slug: "dry-spell"/);
  assert.doesNotMatch(index, /Starter|starter|Template|_template/);
  assert.equal(read(dir, `${scenes}/Scenes.tsx`), "// The Template film's scenes.\nexport const ID = 'DrySpell';\nexport const SLUG = \"dry-spell\";\n");
  assert.equal(
    read(dir, "films/project/src/films/index.ts"),
    `// films:start
import {film as starter} from './starter';
import {film as drySpell} from './dry-spell';
// films:end
export const FILMS = [
  // films:list:start
  starter,
  drySpell,
  // films:list:end
];
`,
  );
  assert.equal(read(dir, "films/project/src/films/starter/index.ts"), STARTER_INDEX, "the starter is untouched");
});

test("a second film is registered after the first, and a digit-first slug gets a valid name", async () => {
  const { dir } = await initialized();
  await film(["new", "dry-spell", "--dir", dir]);
  const r = await film(["new", "3-day-rule", "--dir", dir]);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.equal(r.out.id, "3DayRule");
  const index = read(dir, "films/project/src/films/index.ts");
  const names = [...index.matchAll(/import \{film as (\w+)\}/g)].map((m) => m[1]);
  assert.equal(names.length, 3);
  assert.ok(names.every((n) => /^[A-Za-z_]\w*$/.test(n)), names.join());
  assert.deepEqual([...index.split("films:list:start")[1].matchAll(/^ {2}(\w+),$/gm)].map((m) => m[1]), names);
});

test("new refuses a slug that exists or is not a-z, 0-9 and hyphens, and writes nothing", async () => {
  const { dir } = await initialized();
  await film(["new", "dry-spell", "--dir", dir]);
  const before = read(dir, "films/project/src/films/index.ts");
  for (const slug of ["dry-spell", "starter", "project", "sfx", "Dry-Spell", "dry_spell", "dry spell", "../escape", "-dry", "dry-", "dry--spell", ""]) {
    const r = await film(slug === "" ? ["new", "--dir", dir] : ["new", slug, "--dir", dir]);
    assert.equal(r.code, 1, `slug ${JSON.stringify(slug)}`);
    assert.ok(r.out.error, slug);
  }
  assert.equal(read(dir, "films/project/src/films/index.ts"), before);
  assert.deepEqual(readdirSync(join(dir, "films")).sort(), ["dry-spell", "project", "sfx", "starter"]);
  assert.deepEqual(readdirSync(join(dir, "films/project/src/films")).sort(), ["_template", "dry-spell", "index.ts", "starter"]);
});

test("new refuses an id another film already has", async () => {
  const { dir } = await initialized();
  await film(["new", "a-1", "--dir", dir]);
  const r = await film(["new", "a1", "--dir", dir]);
  assert.equal(r.code, 1);
  assert.match(r.out.error, /A1/);
  assert.equal(existsSync(join(dir, "films/a1")), false);
});

test("new without a project, or with the markers gone, asks for init or names the markers, and writes nothing", async () => {
  const bare = await film(["new", "dry-spell", "--dir", account()]);
  assert.equal(bare.code, 1);
  assert.match(bare.out.error, /init/);

  const { dir } = await initialized();
  const path = join(dir, "films/project/src/films/index.ts");
  writeFileSync(path, read(dir, "films/project/src/films/index.ts").replace("// films:list:end", ""));
  const r = await film(["new", "dry-spell", "--dir", dir]);
  assert.equal(r.code, 1);
  assert.match(r.out.error, /films:list:end/);
  assert.equal(existsSync(join(dir, "films/dry-spell")), false);
  assert.equal(existsSync(join(dir, "films/project/src/films/dry-spell")), false);
});

test("new builds from _template and leaves the starter untouched", async () => {
  const { dir } = await initialized();
  const starter = () => readdirSync(join(dir, "films/project/src/films/starter")).sort().map((f) => [f, read(dir, `films/project/src/films/starter/${f}`)]);
  const before = starter();
  const r = await film(["new", "dry-spell", "--dir", dir]);
  assert.equal(r.code, 0, JSON.stringify(r.out));
  assert.deepEqual(readdirSync(join(dir, "films/project/src/films/dry-spell")).sort(), readdirSync(join(dir, "films/project/src/films/_template")).sort());
  assert.deepEqual(starter(), before);
  assert.equal(read(dir, "films/project/src/films/_template/index.ts"), TEMPLATE_INDEX, "the template is untouched");
  assert.doesNotMatch(read(dir, "films/project/src/films/index.ts"), /_template/, "the template is never registered");
  // With the starter gone (its scenes and its folder), a new film is still made, and its skeletons are still headings.
  rmSync(join(dir, "films/project/src/films/starter"), { recursive: true });
  rmSync(join(dir, "films/starter"), { recursive: true });
  const again = await film(["new", "wet-week", "--dir", dir]);
  assert.equal(again.code, 0, JSON.stringify(again.out));
  assert.match(read(dir, "films/wet-week/script.txt"), /^Structure:\s*$/m);
  assert.match(read(dir, "films/wet-week/STORYBOARD.md"), /^# wet-week/m);
  assert.match(read(dir, "films/project/src/films/wet-week/index.ts"), /id: "WetWeek"/);
  // "template" is a slug like any other: the template's own id does not count as taken.
  assert.equal((await film(["new", "template", "--dir", dir])).code, 0);
});

test("new refuses when the template's index.ts has no id or slug to rename", async () => {
  const { dir } = await initialized();
  writeFileSync(join(dir, "films/project/src/films/_template/index.ts"), "export const film = {};\n");
  const r = await film(["new", "dry-spell", "--dir", dir]);
  assert.equal(r.code, 1);
  assert.equal(existsSync(join(dir, "films/dry-spell")), false);
});

// ---------------------------------------------------------------- the command line

test("the CLI prints one JSON line, exits 1 with an error line, and finds the skill's films relative to itself", () => {
  const dir = account();
  const from = skillFilms();
  const line = execFileSync("node", [cli, "init", "--dir", dir, "--from", from], { encoding: "utf8" });
  assert.equal(line.trim().split("\n").length, 1);
  assert.equal(JSON.parse(line).command, "init");
  const fail = (args) => {
    try {
      execFileSync("node", [cli, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      return e;
    }
    assert.fail("should have exited 1");
  };
  const e = fail(["new", "Bad Slug", "--dir", dir]);
  assert.equal(e.status, 1);
  assert.ok(JSON.parse(e.stdout).error);
  const usage = fail([]);
  assert.equal(usage.status, 1);
  assert.match(JSON.parse(usage.stdout).error, /usage/);
  const shipped = fail(["init", "--dir", account(), "--from", join(tmpdir(), "boqount-no-such-films")]);
  assert.match(JSON.parse(shipped.stdout).error, /boqount-no-such-films/);
});
