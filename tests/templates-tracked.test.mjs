// A template film (src/films/_*) that imports a synced file (cues.json, said.json, props.json) must ship that file:
// the sync writes it only for real films, so a fresh clone would not typecheck and `film.mjs new` would have
// nothing to copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const films = join(root, "skills/boqount/films/project/src/films");

test("every template's imported synced file is tracked by git", () => {
  let tracked;
  try {
    tracked = new Set(execFileSync("git", ["ls-files", "skills/boqount/films/project/src/films"], { cwd: root, encoding: "utf8" }).split("\n"));
  } catch {
    return; // not a git checkout (an archive): nothing to compare
  }
  const missing = [];
  for (const dir of readdirSync(films).filter((d) => d.startsWith("_"))) {
    for (const file of readdirSync(join(films, dir)).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const src = readFileSync(join(films, dir, file), "utf8");
      for (const [, name] of src.matchAll(/from\s+'\.\/((?:cues|said|props)\.json)'/g)) {
        const rel = `skills/boqount/films/project/src/films/${dir}/${name}`;
        if (!tracked.has(rel)) missing.push(`${rel} (imported by ${file})`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
