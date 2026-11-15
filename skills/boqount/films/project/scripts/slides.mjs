// A carousel's slides (carousel.md → Render): every frame of a carousel composition as a still.
//   npm run slides -- <Id>            every slide → ../<slug>/out/slide-NN.png (2160×2880, the master) and
//                                     slide-NN.jpg (1080×1440, the file to post), then ../<slug>/out/sheet.jpg, a contact
//                                     sheet of every slide (four to a row) to read them at a glance
//   npm run slides -- <Id> 3,7        only those slides (counted from 1); the sheet is left as it was
// The slides are counted in src/films/<slug>/slides.ts (one `kind:` per slide). Read every slide at full size and the
// sheet before anything is posted.
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [id, only] = process.argv.slice(2);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const run = (bin, args) => {
  const r = spawnSync(bin, args, {cwd: root, stdio: 'inherit'});
  if (r.error) fail(`${bin}: ${r.error.message}`);
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const carousels = readdirSync(join(root, 'src/films'), {withFileTypes: true})
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(root, 'src/films', d.name, 'slides.ts')))
  .map((d) => {
    const src = readFileSync(join(root, 'src/films', d.name, 'index.ts'), 'utf8');
    return {id: src.match(/\bid:\s*["']([^"']+)["']/)?.[1], slug: src.match(/\bslug:\s*["']([^"']+)["']/)?.[1] ?? d.name, dir: d.name};
  });
if (!id) fail(`npm run slides -- <Id> [n,m]   (carousels: ${carousels.map((c) => c.id).join(', ') || 'none'})`);
const c = carousels.find((x) => x.id === id);
if (!c) fail(`no carousel with id "${id}" (carousels: ${carousels.map((x) => x.id).join(', ') || 'none'})`);

const words = readFileSync(join(root, 'src/films', c.dir, 'slides.ts'), 'utf8').split('export const SLIDES')[1] ?? '';
const n = (words.match(/\bkind:\s*'/g) ?? []).length;
const pick = only ? only.split(',').map(Number) : null;
if (pick && pick.some((k) => !Number.isInteger(k) || k < 1 || k > n)) fail(`slides are 1 to ${n}`);
const out = join(root, '..', c.slug, 'out');
mkdirSync(out, {recursive: true});

run('node', [join(root, 'scripts/sync-assets.mjs')]);
for (let i = 0; i < n; i++) {
  if (pick && !pick.includes(i + 1)) continue;
  const nn = String(i + 1).padStart(2, '0');
  const png = join(out, `slide-${nn}.png`);
  run('npx', ['--no-install', 'remotion', 'still', c.id, png, `--frame=${i}`, '--scale=2', '--log=error']);
  run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-i', png, '-vf', 'scale=1080:1440:flags=lanczos', '-q:v', '2', join(out, `slide-${nn}.jpg`)]);
  console.log(`slide ${nn}`);
}
if (!pick) {
  const cols = Math.min(4, n);
  const rows = Math.ceil(n / cols);
  run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-i', join(out, 'slide-%02d.jpg'), '-vf', `scale=360:480,tile=${cols}x${rows}:padding=12:color=gray`, '-frames:v', '1', join(out, 'sheet.jpg')]);
  console.log(`sheet ${cols}x${rows}: ${join(out, 'sheet.jpg')}`);
}
