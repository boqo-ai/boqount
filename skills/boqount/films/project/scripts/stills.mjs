// Many stills of one film from one bundle and one browser: `npm run still -- <Id> --frames=a,b,c` runs it (one
// Remotion call a frame would bundle the project again for each). For reading the picture at every cue word.
//   node scripts/stills.mjs <Id> <out-dir> <slug> <frames, comma-separated> [--safe] [--scale=<s>]
// Frames count 120ths of a second, as `--frame=` does; each still is <out-dir>/<slug>-<n>.png (-safe with --safe),
// the same name a single still gets. A frame past the end is drawn as the last one and says so.
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, outArg, slug, list, ...flags] = process.argv.slice(2);
const frames = (list ?? '').split(',').filter(Boolean);
if (!id || !outArg || !slug || !frames.length || frames.some((f) => !/^\d+$/.test(f))) {
  console.error('usage: node scripts/stills.mjs <Id> <out-dir> <slug> <frames: whole numbers, comma-separated> [--safe] [--scale=<s>]');
  process.exit(2);
}
const safe = flags.includes('--safe');
const scale = Number(flags.find((f) => f.startsWith('--scale='))?.slice(8) ?? 1);
if (!(scale > 0 && scale <= 4)) {
  console.error(`--scale must be above 0 and at most 4, got ${scale}`);
  process.exit(2);
}
const out = resolve(outArg);
mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: join(root, 'src/index.ts'), publicDir: join(root, 'public')});
const browser = await openBrowser('chrome');
try {
  const inputProps = safe ? {safe: true} : {};
  const composition = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser});
  for (const f of frames) {
    const n = Number(f);
    const frame = Math.min(composition.durationInFrames - 1, n);
    const file = join(out, `${slug}-${n}${safe ? '-safe' : ''}.png`);
    await renderStill({composition, serveUrl, frame, output: file, scale, inputProps, puppeteerInstance: browser, imageFormat: 'png', overwrite: true});
    console.log(`${file}${frame !== n ? `   (frame ${n} is past the end: drawn at ${frame}, the last)` : ''}`);
  }
} finally {
  await browser.close({silent: true});
}
