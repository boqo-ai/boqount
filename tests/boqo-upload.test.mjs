// node --test tools/boqo-upload.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captionFilename, contentTypeOf, probeVerdict, partsFromReply, putParts, run } from "../skills/boqount/tools/boqo-upload-lib.mjs";

const FEED = {
  streams: [
    { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1080, height: 1920, r_frame_rate: "60/1", has_b_frames: 0 },
    { codec_type: "audio", codec_name: "aac" },
  ],
  format: { duration: "12.5", size: "15000000" },
};
const MB15 = 15_000_000;
const withVideo = (patch) => ({
  ...FEED,
  streams: [{ ...FEED.streams[0], ...patch }, FEED.streams[1]],
});

test("captionFilename keeps a caption line and adds .mp4", () => {
  const text = "The stream is eight hours long. Comment CLIPS and I'll send you the link #clipping";
  assert.equal(captionFilename(text), text + ".mp4");
});

test("captionFilename refuses what boqo would rewrite or cut", () => {
  for (const bad of ["a-b c", "a_b c", "line\nbreak here", "a/b c", "", "x ".repeat(101), "2026-11-10-reach-ratio", "reachratio"]) {
    assert.throws(() => captionFilename(bad), undefined, JSON.stringify(bad));
  }
});

test("contentTypeOf maps the four containers", () => {
  assert.equal(contentTypeOf("a/b.mp4"), "video/mp4");
  assert.equal(contentTypeOf("a/b.MOV"), "video/quicktime");
  assert.equal(contentTypeOf("b.mkv"), "video/x-matroska");
  assert.equal(contentTypeOf("b.webm"), "video/webm");
  assert.throws(() => contentTypeOf("b.avi"));
});

test("probeVerdict passes a feed file", () => {
  const v = probeVerdict(FEED, MB15);
  assert.equal(v.passthrough, true);
  assert.equal(v.loopSafe, true);
  assert.deepEqual(v.reasons, []);
  assert.equal(v.durationSec, 12.5);
  assert.deepEqual(v.video, { codec: "h264", pixFmt: "yuv420p", fps: 60, width: 1080, height: 1920, bFrames: 0 });
  assert.deepEqual(v.audio, { codec: "aac" });
});

test("probeVerdict names each re-encode reason", () => {
  const big = probeVerdict(withVideo({ codec_name: "hevc", pix_fmt: "yuv420p10le", width: 2160, height: 3840 }), MB15);
  assert.equal(big.passthrough, false);
  for (const r of ["video hevc", "pix_fmt yuv420p10le", "width 2160 > 1920"]) assert.ok(big.reasons.includes(r), r);
  assert.ok(probeVerdict(withVideo({ r_frame_rate: "120/1" }), MB15).reasons.includes("fps 120 > 60"));
  const opus = { ...FEED, streams: [FEED.streams[0], { codec_type: "audio", codec_name: "opus" }] };
  assert.ok(probeVerdict(opus, MB15).reasons.includes("audio opus"));
  assert.ok(probeVerdict(FEED, 2_147_483_649).reasons.includes("over 2 GiB"));
});

test("probeVerdict mirrors boqo's fps floor and its 1920x3840 box", () => {
  const slow = probeVerdict(withVideo({ r_frame_rate: "15/1" }), MB15);
  assert.equal(slow.passthrough, false);
  assert.ok(slow.reasons.includes("fps 15 < 23"));
  assert.ok(probeVerdict(withVideo({ r_frame_rate: "0/0" }), MB15).reasons.includes("fps 0 < 23"));
  assert.equal(probeVerdict(withVideo({ r_frame_rate: "24000/1001" }), MB15).passthrough, true);
  const phone = probeVerdict(withVideo({ width: 1080, height: 2160 }), MB15);
  assert.equal(phone.passthrough, true);
  assert.deepEqual(phone.reasons, []);
  assert.ok(probeVerdict(withVideo({ width: 1080, height: 3842 }), MB15).reasons.includes("height 3842 > 3840"));
  assert.ok(probeVerdict(withVideo({ pix_fmt: undefined }), MB15).reasons.includes("pix_fmt null"));
});

test("probeVerdict flags B-frames as a loop risk", () => {
  const v = probeVerdict(withVideo({ has_b_frames: 2 }), MB15);
  assert.equal(v.loopSafe, false);
  assert.equal(v.passthrough, true);
});

test("partsFromReply refuses an expired or partial reply", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const good = () => ({
    projectId: "p1",
    expiresAt: "2026-11-12T12:00:00Z",
    parts: [
      { partNumber: 1, offset: 0, size: 4, url: "https://r2.example/1" },
      { partNumber: 2, offset: 4, size: 6, url: "https://r2.example/2" },
    ],
  });
  assert.equal(partsFromReply(good(), 10, now).length, 2);
  assert.throws(() => partsFromReply({ ...good(), expiresAt: "2026-11-10T11:59:59Z" }, 10, now), /expired/);
  const gap = good();
  gap.parts[1].offset = 5;
  assert.throws(() => partsFromReply(gap, 10, now), /cover/);
  assert.throws(() => partsFromReply(good(), 11, now), /cover/);
  const noProject = good();
  delete noProject.projectId;
  assert.throws(() => partsFromReply(noProject, 10, now), /create_upload/);
});

async function tmpFile(bytes) {
  const dir = await mkdtemp(join(tmpdir(), "boqo-upload-"));
  const path = join(dir, "v.mp4");
  await writeFile(path, bytes);
  return { dir, path };
}

test("putParts sends exactly size bytes and no content-type", async () => {
  const { dir, path } = await tmpFile(Buffer.from("0123456789"));
  const seen = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      res.statusCode = 200;
      res.end();
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const parts = [
      { partNumber: 1, offset: 0, size: 4, url: `${base}/p1` },
      { partNumber: 2, offset: 4, size: 4, url: `${base}/p2` },
      { partNumber: 3, offset: 8, size: 2, url: `${base}/p3` },
    ];
    const out = await putParts(path, parts, { fetch, sleep: async () => {} });
    assert.deepEqual(out, { ok: true, bytes: 10 });
    assert.equal(seen.length, 3);
    for (const [i, p] of parts.entries()) {
      assert.equal(seen[i].method, "PUT");
      assert.equal(seen[i].headers["content-length"], String(p.size));
      assert.equal(seen[i].headers["content-type"], undefined);
      assert.equal(seen[i].body.toString(), "0123456789".slice(p.offset, p.offset + p.size));
    }
  } finally {
    server.close();
    await rm(dir, { recursive: true });
  }
});

test("putParts retries a 5xx and stops on a 4xx", async () => {
  const { dir, path } = await tmpFile(Buffer.from("0123456789"));
  try {
    const calls = [];
    const answers = { "https://x/1": [503, 200], "https://x/2": [403, 200] };
    const fakeFetch = async (url) => {
      calls.push(url);
      return { status: answers[url].shift() };
    };
    const sleeps = [];
    const sleep = async (ms) => void sleeps.push(ms);
    const parts = [
      { partNumber: 1, offset: 0, size: 5, url: "https://x/1" },
      { partNumber: 2, offset: 5, size: 5, url: "https://x/2" },
    ];
    const out = await putParts(path, parts, { fetch: fakeFetch, sleep });
    assert.deepEqual(out, { ok: false, partNumber: 2, status: 403 });
    assert.deepEqual(calls, ["https://x/1", "https://x/1", "https://x/2"]);
    assert.deepEqual(sleeps, [1000]);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("run put never prints a URL", async () => {
  const { dir, path } = await tmpFile(Buffer.from("0123456789"));
  try {
    const reply = {
      projectId: "p1",
      expiresAt: "2026-11-12T12:00:00Z",
      parts: [
        { partNumber: 1, offset: 0, size: 4, url: "https://r2.example/a?X-Amz-Signature=abc" },
        { partNumber: 2, offset: 4, size: 4, url: "https://r2.example/b?X-Amz-Signature=abc" },
        { partNumber: 3, offset: 8, size: 2, url: "https://r2.example/c?X-Amz-Signature=abc" },
      ],
    };
    const replyPath = join(dir, "reply.json");
    await writeFile(replyPath, JSON.stringify(reply));
    const deps = {
      exec: async () => assert.fail("no ffprobe"),
      fetch: async () => ({ status: 200 }),
      sleep: async () => {},
      readFile,
      stat,
      now: () => new Date("2026-11-10T12:00:00Z"),
    };
    const { code, line } = await run(["put", path, "--reply", replyPath], deps);
    assert.equal(code, 0);
    assert.ok(!line.includes("http") && !line.includes("X-Amz"));
    assert.deepEqual(JSON.parse(line), { ok: true, projectId: "p1", parts: 3, bytes: 10 });

    // A failing part and a bad reply file stay URL-free too.
    const failing = await run(["put", path, "--reply", replyPath], { ...deps, fetch: async () => ({ status: 403 }) });
    assert.equal(failing.code, 1);
    assert.deepEqual(JSON.parse(failing.line), { ok: false, projectId: "p1", partNumber: 1, status: 403 });
    await writeFile(replyPath, '{"projectId": "p1", "url": "https://r2.example/?X-Amz-Signature=abc" oops');
    const bad = await run(["put", path, "--reply", replyPath], deps);
    assert.equal(bad.code, 1);
    assert.ok(!bad.line.includes("http") && !bad.line.includes("X-Amz"));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("run probe reads ffprobe's JSON", async () => {
  const calls = [];
  const deps = {
    exec: async (file, args) => {
      calls.push([file, args]);
      return { stdout: JSON.stringify(FEED) };
    },
    stat: async () => ({ size: MB15 }),
    now: () => new Date(),
  };
  const { code, line } = await run(["probe", "/clips/today.mp4"], deps);
  assert.equal(code, 0);
  assert.equal(calls[0][0], "ffprobe");
  assert.ok(calls[0][1].includes("/clips/today.mp4"));
  const out = JSON.parse(line);
  assert.equal(out.contentType, "video/mp4");
  assert.equal(out.passthrough, true);
  assert.equal(out.sizeBytes, MB15);
  assert.equal(out.file, "/clips/today.mp4");
});

test("probeVerdict names Instagram's 300 MB cap", () => {
  // boqo's Instagram file-size limit is in decimal bytes, and exactly 300 MB passes.
  const at = probeVerdict(FEED, 300_000_000);
  assert.equal(at.passthrough, true);
  assert.deepEqual(at.reasons, []);
  const over = probeVerdict(FEED, 300_000_001);
  assert.equal(over.passthrough, false);
  assert.ok(over.reasons.includes("over 300 MB (Instagram)"), over.reasons.join("; "));
  assert.ok(probeVerdict(FEED, 2_147_483_649).reasons.includes("over 2 GiB"));
});
