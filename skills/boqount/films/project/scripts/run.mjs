// The npm scripts, by a film's composition id (the `id` in src/films/<slug>/index.ts):
//   npm run sync                      copy fonts, the logo, every film's sound and cues into place
//   npm run dev                       Remotion Studio, every film
//   npm run lint                      eslint and the type check
//   npm run still  -- <Id> --frame=n  one frame → ../<slug>/out/<slug>-<n>.png (n counts 120ths of a second);
//                                     add --safe to tint the bands the platforms cover (→ <slug>-<n>-safe.png)
//   npm run draft  -- <Id>            half scale, blended to 60 fps → ../<slug>/out/<slug>-draft.mp4
//   npm run render -- <Id>            120 samples a second → ../<slug>/out/<slug>-120.mp4 (not a file to show:
//                                     players take it for slow motion)
//   npm run feed   -- <Id>            the file to upload → ../<slug>/out/<slug>-feed.mp4: 1080×1920, H.264 High, no
//                                     B-frames, yuv420p, 60 fps, each pair of samples blended into one frame
// Anything after the id goes to Remotion as it is (`--frame=240`, `--concurrency=8`).
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, id, ...extra] = process.argv.slice(2);

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
const run = (bin, args) => {
  const r = spawnSync(bin, args, {cwd: root, stdio: 'inherit'});
  if (r.error) fail(`${bin}: ${r.error.message}`);
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const remotion = (args) => run('npx', ['--no-install', 'remotion', ...args]);

/** Every film: its id and slug, read from src/films/<folder>/index.ts. A folder whose name starts with _ is not a film
 * (_template is what `film.mjs new` copies). */
const films = () =>
  readdirSync(join(root, 'src/films'), {withFileTypes: true})
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(root, 'src/films', d.name, 'index.ts')))
    .map((d) => {
      const src = readFileSync(join(root, 'src/films', d.name, 'index.ts'), 'utf8');
      return {id: src.match(/\bid:\s*["']([^"']+)["']/)?.[1], slug: src.match(/\bslug:\s*["']([^"']+)["']/)?.[1] ?? d.name};
    });

const film = () => {
  const all = films();
  if (!id || id.startsWith('-')) fail(`npm run ${cmd} -- <Id>   (films: ${all.map((f) => f.id).join(', ')})`);
  const f = all.find((x) => x.id === id);
  if (!f) fail(`no film with id "${id}" (films: ${all.map((x) => x.id).join(', ')})`);
  const out = join(root, '..', f.slug, 'out');
  mkdirSync(out, {recursive: true});
  return {...f, out};
};

/** Blend each pair of 120 samples into one 60 fps frame (a 180° shutter), H.264 High with no B-frames: a feed
 * that drops the MP4 edit list (which B-frames need) would otherwise shift the picture against the sound. */
const blend = (src, dst, crf, preset) =>
  run('ffmpeg', [
    '-nostdin', '-y', '-v', 'error', '-i', src,
    '-vf', "format=gbrp16le,tmix=frames=2,select='mod(n\\,2)',setpts=N/(60*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
    '-r', '60', '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-profile:v', 'high', '-bf', '0',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'copy', '-movflags', '+faststart', dst,
  ]);

const sync = () => run('node', [join(root, 'scripts/sync-assets.mjs')]);

switch (cmd) {
  case 'sync':
    sync();
    break;
  case 'dev':
    sync();
    remotion(['studio']);
    break;
  case 'lint':
    sync();
    run('npx', ['--no-install', 'eslint', 'src']);
    run('npx', ['--no-install', 'tsc']);
    break;
  case 'still': {
    const f = film();
    const n = extra.find((a) => a.startsWith('--frame='))?.slice(8) ?? '0';
    const safe = extra.includes('--safe');
    const rest = extra.filter((a) => !a.startsWith('--frame=') && a !== '--safe');
    sync();
    remotion(['still', f.id, join(f.out, `${f.slug}-${n}${safe ? '-safe' : ''}.png`), `--frame=${n}`, ...(safe ? [`--props=${JSON.stringify({safe: true})}`] : []), ...rest]);
    break;
  }
  case 'draft': {
    const f = film();
    const tmp = join(f.out, `${f.slug}-draft120.mp4`);
    sync();
    remotion(['render', f.id, tmp, '--scale=0.5', '--color-space=bt709', '--crf=20', '--concurrency=4', ...extra]);
    blend(tmp, join(f.out, `${f.slug}-draft.mp4`), 20, 'medium');
    rmSync(tmp);
    break;
  }
  case 'render': {
    const f = film();
    sync();
    remotion(['render', f.id, join(f.out, `${f.slug}-120.mp4`), '--color-space=bt709', '--crf=16', '--concurrency=4', ...extra]);
    break;
  }
  case 'feed': {
    const f = film();
    const src = join(f.out, `${f.slug}-120.mp4`);
    if (!existsSync(src)) fail(`no ${src}: run \`npm run render -- ${f.id}\` first`);
    blend(src, join(f.out, `${f.slug}-feed.mp4`), 16, 'slow');
    break;
  }
  default:
    fail('usage: node scripts/run.mjs <sync|dev|lint|still|draft|render|feed> [Id] [Remotion flags]');
}
