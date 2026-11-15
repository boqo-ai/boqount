// The skill's texts must agree with each other and with the tools: every `file.md` → Section pointer leads to a
// heading that exists, every tool line names a real tool, command and flags, and no retired name is left.
// One test per file and rule, so a single file can be checked with --test-name-pattern "<file>".
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "../skills/boqount/tools/account-state-lib.mjs";

const skills = fileURLToPath(new URL("../skills", import.meta.url));
const main = join(skills, "boqount");

const PENDING = new Set(); // a file whose own text is exempt while it is being rewritten: none

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    // Not the skill's own text: code, dependencies, and what a render or a sync writes.
    if (statSync(path).isDirectory()) return ["tools", "node_modules", "public", "out"].includes(name) ? [] : markdownFiles(path);
    return name.endsWith(".md") ? [path] : [];
  });
}
const files = markdownFiles(skills);
const label = (path) => relative(skills, path);
const own = files.filter((path) => !PENDING.has(label(path)));

// ---------------------------------------------------------------- pointers

const plain = (text) => text.replace(/[`*]/g, "").replace(/\s+\([^)]*\)\s*$/, "").replace(/[.:,;]+$/, "").trim().toLowerCase();

/** What a pointer may name in a file: a heading, a bold lead-in, a list or table label, or a `key:` line. */
function anchorsOf(path) {
  const text = readFileSync(path, "utf8");
  const found = [];
  for (const line of text.split("\n")) {
    const heading = /^#{1,4} (.+)$/.exec(line);
    if (heading) found.push(heading[1]);
    const label = /^\s*(?:[-*]|\d+\.)\s+([^:|]{2,60}):/.exec(line) ?? /^\|\s*([^|]{2,60}?)\s*\|/.exec(line) ?? /^([a-z][a-z0-9_@<>]{2,40}):/.exec(line);
    if (label) found.push(label[1]);
  }
  for (const [, bold] of text.matchAll(/\*\*([^*\n]{2,80})\*\*/g)) found.push(bold);
  return [...new Set(found.map(plain))].filter((anchor) => anchor.length >= 3);
}

/** A pointer resolves when it starts with an anchor, or is the start of one (`check.md` → What it reads). */
function resolves(wanted, anchors) {
  const phrase = wanted.split(/[);|]|\. |: /)[0].trim();
  return anchors.some((anchor) => wanted.startsWith(anchor) || (phrase.length >= 4 && anchor.startsWith(phrase)));
}

/** The skill file a pointer names, or null when it names one of the account's own files with no template to check against. */
function target(name, from) {
  const candidates = name.startsWith("<skill>/")
    ? [join(main, name.slice("<skill>/".length))]
    : [join(dirname(from), name), join(main, name), join(main, "templates", basename(name)), join(skills, "boqount-research", name), join(skills, "boqount-research", "templates", basename(name))];
  return candidates.find((path) => existsSync(path)) ?? null;
}

const POINTER = /(?:`([A-Za-z0-9_<>./-]+\.md)`|\b(SKILL\.md))\s+→\s+(.{1,90})/g;

for (const path of own) {
  test(`${label(path)}: every pointer leads somewhere`, () => {
    const broken = [];
    // A pointer may wrap onto the next line of a paragraph or list item.
    const flat = readFileSync(path, "utf8").replace(/[ \t]*\n[ \t]*/g, " ");
    for (const [, quoted, bare, rest] of flat.matchAll(POINTER)) {
      const name = quoted ?? bare;
      const file = target(name, path);
      if (!file) continue;
      const wanted = rest.replace(/[`*]/g, "").trim().toLowerCase();
      if (!resolves(wanted, anchorsOf(file))) broken.push(`${name} → ${wanted.slice(0, 50)}`);
    }
    assert.deepEqual(broken, []);
  });
}

// ---------------------------------------------------------------- tool lines

const { line: usageLine } = await run(["?"], {});
const usage = JSON.parse(usageLine).error;
const COMMANDS = new Set(usage.replace(/^usage:\s*/, "").split(" | ").map((part) => part.trim().split(/\s+/)[0]));
const FLAGS = new Set(usage.match(/--[a-z-]+/g));
const PER_CHANNEL = new Set(["slot", "queue", "norms", "verdict", "streak", "followers", "stops", "kpi"]);
const OTHER_TOOLS = {
  "funnel-check.mjs": { flags: new Set(["--must-have", "--must-not-have", "--file"]) },
  "boqo-upload.mjs": { commands: new Set(["probe", "name", "put"]), flags: new Set(["--reply"]) },
};
const TOOL_LINE = /node <skill>\/tools\/([a-z-]+\.mjs)([^`\n|]*)/g;

for (const path of own) {
  test(`${label(path)}: every tool line names a real tool, command and flags`, () => {
    const wrong = [];
    for (const [whole, tool, rest] of readFileSync(path, "utf8").matchAll(TOOL_LINE)) {
      const words = rest.trim().split(/\s+/).filter(Boolean);
      const flags = words.filter((word) => /^--[a-z]/.test(word));
      const command = words[0] && !words[0].startsWith("-") && !words[0].startsWith("<") ? words[0] : null;
      if (tool === "account-state.mjs") {
        if (command && !COMMANDS.has(command)) wrong.push(`${whole.trim()}: no command ${command}`);
        for (const flag of flags) if (!FLAGS.has(flag)) wrong.push(`${whole.trim()}: no flag ${flag}`);
        if (PER_CHANNEL.has(command) && !flags.includes("--channel")) wrong.push(`${whole.trim()}: ${command} needs --channel`);
        if (["mode", "budget", "campaigns"].includes(command) && flags.includes("--channel")) wrong.push(`${whole.trim()}: ${command} takes no --channel`);
      } else if (OTHER_TOOLS[tool]) {
        const { commands, flags: known } = OTHER_TOOLS[tool];
        if (commands && command && !commands.has(command)) wrong.push(`${whole.trim()}: no command ${command}`);
        for (const flag of flags) if (!known.has(flag)) wrong.push(`${whole.trim()}: no flag ${flag}`);
      } else if (!existsSync(join(main, "tools", tool))) {
        wrong.push(`${whole.trim()}: no such tool`);
      }
    }
    assert.deepEqual(wrong, []);
  });
}

// ---------------------------------------------------------------- retired names

const RETIRED = /first_project|firstProject|purchased|paid_(?:7|28)d|doorView|\bl\.view\b/;

for (const path of [...own, ...["ledger.csv", "account.csv", "budget.csv", "signups.csv"].map((name) => join(main, "templates", name))]) {
  test(`${label(path)}: no retired name is left`, () => {
    const lines = readFileSync(path, "utf8").split("\n").map((text, i) => ({ text, n: i + 1 })).filter(({ text }) => RETIRED.test(text));
    assert.deepEqual(lines.map(({ n, text }) => `${n}: ${text.trim().slice(0, 80)}`), []);
  });
}

// ---------------------------------------------------------------- the comment call and the opportunity story

const examples = fileURLToPath(new URL("../examples", import.meta.url));
const exampleFiles = (function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith(".md") ? [path] : [];
  });
})(examples);

test("the comment call is written one of its two ways everywhere: the voice's and the caption's", () => {
  const voice = /^Comment (<code>|[A-Z]{2,12}), and I'll send you the link\.$/;
  const caption = /^Comment (<CODE>|[A-Z]{2,12}) and I'll send you the link\.$/;
  const wrong = [];
  for (const path of [...files, ...exampleFiles]) {
    const flat = readFileSync(path, "utf8").replace(/[ \t]*\n[ \t]*/g, " ");
    for (const [call] of flat.matchAll(/Comment [<A-Z][^."]*?link\./g)) if (!voice.test(call) && !caption.test(call)) wrong.push(`${relative(skills, path)}: ${call}`);
  }
  assert.deepEqual(wrong, []);
});

test("the opportunity story's ten parts are named in the same order in the check and the record template", () => {
  const parts = "hook · proof · catch · who is left · where you come in · what most do · turn · the product at work · payoff · call";
  for (const name of ["check.md", "templates/publication.md"]) {
    const flat = readFileSync(join(main, name), "utf8").replace(/[ \t]*\n[ \t]*/g, " ");
    assert.ok(flat.includes(parts), `${name} does not name the ten parts in order`);
  }
  const story = readFileSync(join(main, "story.md"), "utf8");
  const rows = [...story.matchAll(/^\| (\d+) \| \*\*([^*]+)\*\*/gm)].map(([, n, part]) => `${n} ${part}`);
  assert.equal(rows.length, 10, "story.md has ten numbered parts");
});

test("SKILL.md: going alongside is the human's pick, and a run alongside leaves the holder's files alone", () => {
  const flat = readFileSync(join(main, "SKILL.md"), "utf8").replace(/[ \t]*\n[ \t]*/g, " ");
  for (const s of ["account-lock.mjs claim --soft --scope", "Only the human picks going alongside and its scope",
    "never writes `marketing/state.md`, `marketing/queue.md`", "publishes only a post its scope names",
    "only added rows keeps every row of both", "release --soft"]) assert.ok(flat.includes(s), s);
});
