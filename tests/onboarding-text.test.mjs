// onboarding.md and INSTALL.md: the rules the end-to-end runs showed are easy to lose, held by their words.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const onboarding = read("skills/boqount/onboarding.md");
const install = read("INSTALL.md");
const sayBack = onboarding.slice(onboarding.indexOf("## 2. Say it back"), onboarding.indexOf("## 3."));

test("the say-back is sent in words before the first look renders, and a failed render never holds it back", () => {
  assert.match(sayBack, /The words never wait for the render/);
  assert.match(sayBack, /never instead of the say-back/);
  const template = sayBack.slice(sayBack.indexOf("```"), sayBack.lastIndexOf("```"));
  assert.doesNotMatch(template, /Your first look:/, "the film's line is its own later message, not in the say-back");
});

test("the say-back is assembled from the notes: what it costs is every plan prices.md lists", () => {
  assert.match(sayBack, /assembled from the notes, not retold/);
  assert.match(sayBack, /What it costs: <every plan and price prices\.md lists>/);
  assert.match(sayBack, /contradicts\s+a note's line is wrong/);
});

test("nothing is said about the project before the deep read", () => {
  assert.match(onboarding, /Say nothing yet about\s+what the project is/);
  assert.match(install, /Say nothing about what their project is before onboarding has read it/);
});
