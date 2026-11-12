#!/usr/bin/env node
// Opens a brand's links as a brand-new visitor (skills/boqount): no cookie, no sign-in.
//
//   node <skill>/tools/funnel-check.mjs [--must-have <text>]… [--must-not-have <text>]… <url…>
//   node <skill>/tools/funnel-check.mjs [--must-have <text>]… [--must-not-have <text>]… --file <links.txt>   one link per line
//
// A link is `open` when the page its redirects end on has every --must-have text; `blocked` when it lacks one and has a
// --must-not-have text; `changed` when it lacks one and has none; `unread` when a hop fails. With no --must-have, any readable page not blocked is open.
// Prints one JSON line {verdict, links:[{url, state, hops, error?}], readAt} and exits 0 for every verdict (green, yellow, red) and 1 only on a tool error (bad usage, unreadable --file).
// Only public GETs are made. The rules: tools/funnel-check-lib.mjs.
import { readFile } from "node:fs/promises";
import { run } from "./funnel-check-lib.mjs";

const { code, line } = await run(process.argv.slice(2), { fetch, readFile, now: () => new Date() });
console.log(line);
process.exit(code);
