// The mechanical half of publishing through boqo's MCP: probe a video, build the caption-safe upload file
// name, and PUT the parts a `create_upload` reply asks for. The CLI is tools/boqo-upload.mjs; the tests are
// tests/boqo-upload.test.mjs.
//
// Facts this file relies on (read from boqo's code, not measured here): a part URL signs only `content-length`
// and `host`, so a PUT body must be exactly `size` bytes and carry no content-type; parts are 32 MiB, at most
// 64 (2 GiB); the URLs live 48 hours; an uploaded Post's caption is its file name minus `.mp4`, cut to 200
// characters, with `-` and `_` read as spaces.
import { open } from "node:fs/promises";
import { extname } from "node:path";

export const PART_BYTES = 33554432;
export const MAX_BYTES = 2147483648;
export const TITLE_MAX = 200;

const MAX_WIDTH = 1920;
// boqo's post rule: the frame
// is bounded by a 1920x3840 box, fps by 23..60.
const MAX_HEIGHT = 3840;
const MIN_FPS = 23;
const MAX_FPS = 60;
// boqo's Instagram file-size limit, in decimal
// bytes. boqo refuses a bigger file at posting and never re-encodes it to fit.
const INSTAGRAM_MAX_BYTES = 300_000_000;
const RETRY_SLEEPS_MS = [1000, 4000]; // three tries in all

/** The upload file name for a Post whose caption is `text`. Throws on anything boqo would rewrite or cut. */
export function captionFilename(text) {
  if (typeof text !== "string") throw new Error("caption must be a string");
  const t = text.trim();
  if (t === "") throw new Error("caption is empty");
  if (t.length > TITLE_MAX) throw new Error(`caption is ${t.length} UTF-16 units, over ${TITLE_MAX}`);
  if (/[-_]/.test(t)) throw new Error("caption has - or _, which boqo reads as a space");
  if (t.includes("/")) throw new Error("caption has /, which a file name cannot hold");
  if ([...t].some((c) => /[\p{Cc}\p{Zl}\p{Zp}]/u.test(c))) throw new Error("caption has a control character");
  if (t.split(/\s+/).length < 2) throw new Error("caption has fewer than two words");
  return t + ".mp4";
}

const CONTENT_TYPES = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
};

export function contentTypeOf(path) {
  const type = CONTENT_TYPES[extname(path).toLowerCase()];
  if (!type) throw new Error(`unsupported container: ${extname(path) || "(no extension)"}`);
  return type;
}

function fpsOf(rate) {
  const [n, d] = String(rate ?? "").split("/").map(Number);
  if (!Number.isFinite(n)) return 0;
  const fps = d ? n / d : n;
  return Number.isFinite(fps) ? Math.round(fps * 100) / 100 : 0;
}

/** Whether boqo can take the file as it is (`passthrough`), why not (`reasons`), and whether it loops cleanly. */
export function probeVerdict(ffprobe, sizeBytes) {
  const streams = ffprobe?.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  if (!v) throw new Error("no video stream");
  const a = streams.find((s) => s.codec_type === "audio");
  const duration = Number(ffprobe?.format?.duration);
  const video = {
    codec: v.codec_name ?? null,
    pixFmt: v.pix_fmt ?? null,
    fps: fpsOf(v.r_frame_rate),
    width: v.width ?? 0,
    height: v.height ?? 0,
    bFrames: Number(v.has_b_frames ?? 0),
  };
  const audio = { codec: a?.codec_name ?? null };
  const reasons = [];
  if (String(video.codec).toLowerCase() !== "h264") reasons.push(`video ${video.codec}`);
  if (video.pixFmt !== "yuv420p") reasons.push(`pix_fmt ${video.pixFmt}`);
  if (video.width > MAX_WIDTH) reasons.push(`width ${video.width} > ${MAX_WIDTH}`);
  if (video.height > MAX_HEIGHT) reasons.push(`height ${video.height} > ${MAX_HEIGHT}`);
  if (video.fps > MAX_FPS) reasons.push(`fps ${video.fps} > ${MAX_FPS}`);
  else if (video.fps < MIN_FPS) reasons.push(`fps ${video.fps} < ${MIN_FPS}`);
  if (a && String(audio.codec).toLowerCase() !== "aac") reasons.push(`audio ${audio.codec}`);
  if (sizeBytes > INSTAGRAM_MAX_BYTES) reasons.push("over 300 MB (Instagram)");
  if (sizeBytes > MAX_BYTES) reasons.push("over 2 GiB");
  return {
    durationSec: Number.isFinite(duration) ? duration : null,
    video,
    audio,
    passthrough: reasons.length === 0,
    loopSafe: video.bFrames === 0,
    reasons,
  };
}

/** The parts of a `create_upload` reply, checked: not expired, contiguous from 0, and covering the whole file. */
export function partsFromReply(reply, sizeBytes, now) {
  if (!reply || typeof reply.projectId !== "string" || !reply.projectId) throw new Error("not a create_upload reply: no projectId");
  if (!Array.isArray(reply.parts)) throw new Error("not a create_upload reply: no parts");
  const expires = Date.parse(reply.expiresAt);
  if (!Number.isFinite(expires)) throw new Error("create_upload reply has no usable expiresAt");
  if (expires <= now.getTime()) throw new Error(`upload URLs expired at ${reply.expiresAt}`);
  const parts = reply.parts
    .map((p) => ({ partNumber: p.partNumber, offset: p.offset, size: p.size, url: p.url }))
    .sort((x, y) => x.partNumber - y.partNumber);
  let next = 0;
  for (const p of parts) {
    if (!Number.isInteger(p.size) || p.size <= 0 || typeof p.url !== "string" || p.url === "" || p.offset !== next) {
      throw new Error(`parts do not cover the file: part ${p.partNumber} breaks the sequence at byte ${next}`);
    }
    next += p.size;
  }
  if (next !== sizeBytes) throw new Error(`parts do not cover the file: ${next} bytes of ${sizeBytes}`);
  return parts;
}

/** PUT each part in order. A network error or 5xx gets three tries in all; a 4xx stops at once. No URL is ever returned. */
export async function putParts(path, parts, deps) {
  const file = await open(path, "r");
  try {
    for (const p of parts) {
      const body = Buffer.alloc(p.size);
      const { bytesRead } = await file.read(body, 0, p.size, p.offset);
      if (bytesRead !== p.size) return { ok: false, partNumber: p.partNumber, status: "short read" };
      let status;
      for (let attempt = 0; attempt <= RETRY_SLEEPS_MS.length; attempt++) {
        if (attempt > 0) await deps.sleep(RETRY_SLEEPS_MS[attempt - 1]);
        try {
          const res = await deps.fetch(p.url, { method: "PUT", body, headers: { "content-length": String(p.size) } });
          status = res.status;
        } catch {
          status = "network"; // the error text can carry the URL, so it is dropped
        }
        if (typeof status === "number" && status >= 200 && status < 300) break;
        if (typeof status === "number" && status < 500) return { ok: false, partNumber: p.partNumber, status };
      }
      if (!(typeof status === "number" && status >= 200 && status < 300)) return { ok: false, partNumber: p.partNumber, status };
    }
    return { ok: true, bytes: parts.reduce((n, p) => n + p.size, 0) };
  } finally {
    await file.close();
  }
}

function flag(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return { value: undefined, rest: args };
  return { value: args[i + 1], rest: [...args.slice(0, i), ...args.slice(i + 2)] };
}

// A signed URL must never reach the output, whatever put it in a message.
const scrub = (s) => String(s).replace(/https?:\/\/\S*/gi, "<url>").replace(/X-Amz\S*/gi, "<redacted>");
const fail = (message) => ({ code: 1, line: JSON.stringify({ error: scrub(message) }) });

/** The CLI, with its dependencies handed in: exec(file, args) -> {stdout}, fetch, sleep, readFile, stat, now. */
export async function run(argv, deps) {
  const [command, ...args] = argv;
  try {
    if (command === "name") {
      return { code: 0, line: JSON.stringify({ filename: captionFilename(args.join(" ")) }) };
    }
    if (command === "probe") {
      const file = args[0];
      if (!file) return fail("usage: probe <file>");
      const contentType = contentTypeOf(file);
      const sizeBytes = (await deps.stat(file)).size;
      const res = await deps.exec("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
      const ffprobe = JSON.parse(typeof res === "string" ? res : res.stdout);
      return { code: 0, line: JSON.stringify({ file, sizeBytes, contentType, ...probeVerdict(ffprobe, sizeBytes) }) };
    }
    if (command === "put") {
      const { value: replyPath, rest } = flag(args, "--reply");
      const file = rest[0];
      if (!file || !replyPath) return fail("usage: put <file> --reply <reply.json>");
      const sizeBytes = (await deps.stat(file)).size;
      let reply;
      try {
        reply = JSON.parse(await deps.readFile(replyPath, "utf8"));
      } catch {
        return fail("the reply file is missing or is not valid JSON");
      }
      const parts = partsFromReply(reply, sizeBytes, deps.now());
      const out = await putParts(file, parts, { fetch: deps.fetch, sleep: deps.sleep });
      if (out.ok) return { code: 0, line: JSON.stringify({ ok: true, projectId: reply.projectId, parts: parts.length, bytes: out.bytes }) };
      return { code: 1, line: JSON.stringify({ ok: false, projectId: reply.projectId, partNumber: out.partNumber, status: out.status }) };
    }
    return fail("usage: probe <file> | name <text…> | put <file> --reply <reply.json>");
  } catch (e) {
    return fail(e?.message ?? e);
  }
}
