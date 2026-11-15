#!/usr/bin/env node
// What this machine has of what the skill uses. It only looks: it installs nothing, changes nothing, prints no key.
//
//   node <skill>/tools/doctor.mjs [--json]
//
// One line a tool: `ok`, `missing` (the skill needs it) or `optional` (a step works without it, less well), what it
// is for, and how a person installs it. Exits 1 when a needed tool is missing, else 0.
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rife } from "./footage-120.mjs";
import { whisperModel } from "./vo-check.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const mac = platform() === "darwin";
const how = (brew, other) => (mac ? `brew install ${brew}` : other);
const out = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return r.error ? null : `${r.stdout ?? ""}${r.stderr ?? ""}`;
};

export function checks() {
  const list = [];
  const add = (name, need, state, detail, forWhat, install) => list.push({ name, need, state, detail, for: forWhat, install });

  const major = Number(process.versions.node.split(".")[0]);
  add("node", true, major >= 20, `v${process.versions.node}`, "every tool", "nodejs.org (20 or newer)");

  const ffv = out("ffmpeg", ["-hide_banner", "-version"]);
  const filters = ffv ? out("ffmpeg", ["-hide_banner", "-filters"]) ?? "" : "";
  const need = ["ebur128", "scdet", "minterpolate", "tmix"].filter((f) => !new RegExp(`\\b${f}\\b`).test(filters));
  add("ffmpeg", true, !!ffv && need.length === 0, ffv ? `${ffv.split("\n")[0].replace(/^ffmpeg version /, "").split(" ")[0]}${need.length ? `, without the filter${need.length > 1 ? "s" : ""} ${need.join(", ")}` : ""}` : "not found", "films, sound, stills, every measurement", how("ffmpeg", "the package manager (ffmpeg), or ffmpeg.org"));
  add("ffprobe", true, out("ffprobe", ["-version"]) !== null, out("ffprobe", ["-version"]) ? "found" : "not found", "reading a file's streams", "comes with ffmpeg");

  const gitv = out("git", ["--version"]);
  add("git", true, !!gitv, gitv ? gitv.trim() : "not found", "the skill's own updates, commits when git_commit is on", mac ? "xcode-select --install" : "the package manager (git)");

  const ghv = out("gh", ["--version"]);
  const ghAuth = ghv ? spawnSync("gh", ["auth", "status"], { encoding: "utf8" }).status === 0 : false;
  add("gh", false, !!ghv, ghv ? `${ghv.split("\n")[0]}${ghAuth ? ", signed in" : ", not signed in (gh auth login)"}` : "not found", "filing issues when issues_repo is set", how("gh", "cli.github.com"));

  const whisper = out("whisper-cli", ["--help"]) !== null;
  const model = whisperModel();
  add("whisper-cli", false, whisper && !!model, whisper ? (model ? `model ${model.replace(homedir(), "~")}` : "no model file (set WHISPER_MODEL or put a ggml-*.bin in ~/.cache/whisper)") : "not found", "a file's words, the voice against the script (without it the person confirms the words)", how("whisper-cpp, then a model: ggml-base.en.bin from huggingface.co/ggerganov/whisper.cpp into ~/.cache/whisper", "whisper.cpp from github.com/ggml-org/whisper.cpp, and a model file"));

  const r = rife();
  add("RIFE", false, !!r, r ? r.bin.replace(homedir(), "~") : "not installed (ffmpeg's minterpolate is used instead)", "footage brought to 120 fps (footage-120.mjs)", `node ${join(HERE, "footage-120.mjs").replace(homedir(), "~")} --install`);

  const age = out("age", ["--version"]);
  add("age", false, !!age, age ? age.trim() : "not found", "sharing keys between people who run one account (keys.sh)", how("age", "the package manager (age), or age-encryption.org"));

  // the film project's packages, and the optional model listening for the sound library
  const project = ["films/project", "../films/project"].map((p) => join(process.cwd(), p)).find((p) => existsSync(join(p, "package.json")));
  const nm = project && existsSync(join(project, "node_modules"));
  add("film packages", false, !!nm, project ? (nm ? `installed in ${project.replace(homedir(), "~")}` : `not installed: cd ${project.replace(homedir(), "~")} && npm ci`) : "no films/project here (film.mjs init makes it)", "rendering films", "npm ci in films/project");
  let transformers = false;
  for (const base of [project, process.cwd(), HERE].filter(Boolean)) {
    try {
      createRequire(join(base, "noop.js")).resolve("@huggingface/transformers");
      transformers = true;
      break;
    } catch {}
  }
  add("@huggingface/transformers", false, transformers, transformers ? "found" : "not found", "a model listening to sound-library takes: no tool reads it yet (soundlib.mjs build keeps takes by measurement)", "npm install @huggingface/transformers in films/project");

  return list;
}

export function main(argv) {
  const list = checks();
  const missing = list.filter((c) => c.need && !c.state);
  if (argv.includes("--json")) return { text: JSON.stringify(list, null, 1), fail: missing.length > 0 };
  const lines = list.map((c) => `${(c.state ? "ok" : c.need ? "missing" : "optional").padEnd(9)} ${c.name.padEnd(26)} ${c.detail}${c.state ? "" : `\n          for: ${c.for}; install: ${c.install}`}`);
  lines.push(missing.length ? `${missing.length} needed tool${missing.length > 1 ? "s are" : " is"} missing: ${missing.map((c) => c.name).join(", ")}` : "everything the skill needs is here; an `optional` line names what a step does without it");
  return { text: lines.join("\n"), fail: missing.length > 0 };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const r = main(process.argv.slice(2));
  console.log(r.text);
  process.exit(r.fail ? 1 : 0);
}
