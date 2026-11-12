#!/usr/bin/env node
// The mechanical parts of publishing through boqo's MCP (skills/boqount).
//
//   node <skill>/tools/boqo-upload.mjs probe <file>                  size, container, codecs, fps, and whether boqo takes it as it is
//   node <skill>/tools/boqo-upload.mjs name <caption…>               the upload file name for a Post with that caption
//   node <skill>/tools/boqo-upload.mjs put <file> --reply <reply.json>   PUT the parts of a create_upload reply saved to <reply.json>
//
// Prints one JSON line and exits 0, or exits 1 with {"error": …} / {"ok": false, …}. No signed URL is ever printed.
// The logic and why a PUT carries no content-type: tools/boqo-upload-lib.mjs.
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { run } from "./boqo-upload-lib.mjs";

const execFileAsync = promisify(execFile);
// On a Mac, ffprobe often lives in Homebrew's prefix, which a non-login shell may not have on PATH.
const env = { ...process.env, PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin` };
const exec = (file, args) => execFileAsync(file, args, { timeout: 60_000, maxBuffer: 16 * 1024 * 1024, env });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { code, line } = await run(process.argv.slice(2), { exec, fetch, sleep, readFile, stat, now: () => new Date() });
console.log(line);
process.exit(code);
