// Copies what the films read at render time into public/ (staticFile() serves only public/), and each film's cues
// into its scene folder. Every npm script runs it first. It never changes what it reads.
//   shared/fonts/                              → public/fonts/
//   <account>/brand/<slug>/fonts/*.ttf|otf|woff2 → public/fonts/   (each loads under its file's name: lib/fonts.ts)
//   <account>/brand/<slug>/logo.svg|.png       → public/brand/
//   <account>/brand/<slug>/media/              → public/brand/media/   (screenshots, recordings: kit/Kit.tsx Device)
//   ../<film>/media/                           → public/media/<film>/
//   ../<film>/audio/mix.wav, vo.wav            → public/audio/<film>/
//   ../<film>/audio/cues.json                  → src/films/<film>/cues.json   (for each film that has a scene folder)
//   ../glimpse/glimpse.json                    → src/films/glimpse/spec.json  (the first look's words and colours)
//   ../glimpse/assets/fonts/*.ttf|otf|woff2    → public/fonts/                (its face, before the brand folder exists)
//   ../glimpse/assets/logo.svg|.png            → public/glimpse/
// <account> is the folder that holds films/, two levels above this project; <slug> is the `brand:` line of
// <account>/marketing/config.md. With no config, no slug or no brand folder, nothing of the brand is copied and
// nothing fails. A file is written only when it changed, so Studio does not reload; a copied file whose source is
// gone is removed, so a film never draws what the account no longer has.
import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const films = join(root, '..');
const account = join(films, '..');
const pub = join(root, 'public');

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const same = (a, b) => {
  if (!existsSync(b)) return false;
  const sa = statSync(a);
  const sb = statSync(b);
  if (sa.size !== sb.size) return false;
  return sa.size > 1e6 ? sa.mtimeMs <= sb.mtimeMs : readFileSync(a).equals(readFileSync(b));
};
const copy = (from, to) => {
  if (same(from, to)) return false;
  mkdirSync(dirname(to), {recursive: true});
  cpSync(from, to, {preserveTimestamps: true});
  return true;
};
/** Every file under `dir`, relative to it (none when it is null or not there). Dot files are left out. */
const filesIn = (dir) =>
  dir && isDir(dir)
    ? readdirSync(dir, {withFileTypes: true, recursive: true})
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => relative(dir, join(e.parentPath ?? e.path, e.name)))
    : [];

const done = [];
/** Makes `to` hold exactly the files of `from` (none when `from` is null): copies and removes. */
const mirror = (from, to, label) => {
  const want = new Set(filesIn(from));
  for (const f of want) if (copy(join(from, f), join(to, f))) done.push(`${label}/${f}`);
  for (const f of filesIn(to)) if (!want.has(f)) rmSync(join(to, f));
};

// the brand's slug
let slug = null;
const config = join(account, 'marketing/config.md');
if (existsSync(config)) {
  const m = readFileSync(config, 'utf8').match(/^brand:[ \t]*([a-z0-9-]+)[ \t]*$/m);
  if (m) slug = m[1];
}
const brand = slug ? join(account, 'brand', slug) : null;

// fonts: Inter, and the brand's own faces (a brand face may not take the name of a shipped file)
const FONT = /\.(ttf|otf|woff2)$/i;
const shipped = new Set(filesIn(join(root, 'shared/fonts')));
const glimpse = join(films, 'glimpse');
const faceFiles = (dir) => filesIn(dir).filter((f) => !f.includes('/') && FONT.test(f) && !shipped.has(f));
const brandOwn = brand ? faceFiles(join(brand, 'fonts')) : [];
// the first look's faces come before the brand folder exists; the brand's own win where both have a file
const glimpseFonts = faceFiles(join(glimpse, 'assets/fonts')).filter((f) => !brandOwn.includes(f));
const brandFonts = [...brandOwn, ...glimpseFonts];
for (const f of shipped) if (copy(join(root, 'shared/fonts', f), join(pub, 'fonts', f))) done.push(`fonts/${f}`);
for (const f of brandOwn) if (copy(join(brand, 'fonts', f), join(pub, 'fonts', f))) done.push(`fonts/${f}`);
for (const f of glimpseFonts) if (copy(join(glimpse, 'assets/fonts', f), join(pub, 'fonts', f))) done.push(`fonts/${f}`);
for (const f of filesIn(join(pub, 'fonts'))) if (!shipped.has(f) && !brandFonts.includes(f)) rmSync(join(pub, 'fonts', f));

// a family named in the tokens with no file is drawn in Inter: say so, on one line
const families = new Set(['Inter', ...brandFonts.map((f) => f.replace(FONT, ''))]);
const tokens = JSON.parse(readFileSync(join(root, 'src/lib/tokens.json'), 'utf8'));
const missing = [...new Set([tokens.font_display, tokens.font_text])].filter((f) => typeof f === 'string' && !families.has(f));
const fontNote = missing.length
  ? `fonts: no file for ${missing.map((f) => `"${f}"`).join(' or ')} in ${brand ? `brand/${slug}/fonts/` : 'the brand folder'} (name it "<family>.ttf", .otf or .woff2): drawn in Inter`
  : null;

// the brand's logo, when the account has one
for (const ext of ['svg', 'png']) {
  const src = brand ? join(brand, `logo.${ext}`) : null;
  const dst = join(pub, 'brand', `logo.${ext}`);
  if (src && existsSync(src)) {
    if (copy(src, dst)) done.push(`brand/logo.${ext}`);
  } else if (existsSync(dst)) rmSync(dst);
}

// the first look: its logo and its words
for (const ext of ['svg', 'png']) {
  const src = join(glimpse, `assets/logo.${ext}`);
  const dst = join(pub, 'glimpse', `logo.${ext}`);
  if (existsSync(src)) {
    if (copy(src, dst)) done.push(`glimpse/logo.${ext}`);
  } else if (existsSync(dst)) rmSync(dst);
}
if (existsSync(join(glimpse, 'glimpse.json')) && existsSync(join(root, 'src/films/glimpse'))) {
  if (copy(join(glimpse, 'glimpse.json'), join(root, 'src/films/glimpse/spec.json'))) done.push('src/films/glimpse/spec.json');
}

// the brand's media, for every film
mirror(brand && join(brand, 'media'), join(pub, 'brand/media'), 'brand/media');

// each film's media, sound and cues
const filmNames = readdirSync(films).filter((film) => film !== 'project' && isDir(join(films, film)));
for (const film of filmNames) {
  mirror(join(films, film, 'media'), join(pub, 'media', film), `media/${film}`);
  const audio = join(films, film, 'audio');
  if (!isDir(audio)) continue;
  for (const f of ['mix.wav', 'vo.wav']) {
    const src = join(audio, f);
    const dst = join(pub, 'audio', film, f);
    if (existsSync(src)) {
      if (copy(src, dst)) done.push(`audio/${film}/${f}`);
    } else if (existsSync(dst)) rmSync(dst);
  }
  const scenes = join(root, 'src/films', film);
  if (existsSync(join(audio, 'cues.json')) && existsSync(scenes)) {
    if (copy(join(audio, 'cues.json'), join(scenes, 'cues.json'))) done.push(`src/films/${film}/cues.json`);
  }
}
// media of a film that is gone
for (const film of isDir(join(pub, 'media')) ? readdirSync(join(pub, 'media')) : []) {
  if (!filmNames.includes(film)) rmSync(join(pub, 'media', film), {recursive: true, force: true});
}

console.log(done.length ? `synced: ${done.join(', ')}` : 'synced: nothing changed');
if (fontNote) console.log(fontNote);
