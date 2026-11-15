// Two models that name a sound, for `soundlib.mjs build` (`sound.md` → How a take gets in). Optional: they run only
// when @huggingface/transformers is installed (`doctor.mjs` says where it looks), and download their weights on first
// use (about 930 MB, cached inside the package's folder). Without them the library is kept by measurement alone.
//
//   CLAP (Xenova/clap-htsat-unfused): one vector per sound and one per description ("the sound of <is>"); the cosine
//         says how well a take agrees with each description in the library.
//   AST  (Xenova/ast-finetuned-audioset-10-10-0.4593): AudioSet's 527 labels ("Shuffling cards", "Camera", "Tick"),
//         sigmoid scores: what the take is in the model's own words.
//
// Nobody hears anything here: both readings are a machine's, and the person's listen through `audition` decides.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
export const CLAP = "Xenova/clap-htsat-unfused";
export const AST = "Xenova/ast-finetuned-audioset-10-10-0.4593";

/** Where the package is looked for: the film project, the folder the tool runs in, the skill. */
export function findTransformers(cwd = process.cwd()) {
  for (const base of [join(cwd, "films/project"), join(cwd, "../films/project"), cwd, HERE]) {
    try {
      return createRequire(join(base, "noop.js")).resolve("@huggingface/transformers");
    } catch {}
  }
  return null;
}

const norm = (v) => {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
};
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

/** Linear resampling of a mono signal; enough for a classifier's input. */
export function resample(m, from, to) {
  if (from === to) return Float32Array.from(m);
  const n = Math.floor((m.length * to) / from);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i * from) / to;
    const a = Math.floor(t);
    const f = t - a;
    out[i] = (m[a] ?? 0) * (1 - f) + (m[a + 1] ?? m[a] ?? 0) * f;
  }
  return out;
}

/**
 * The two listeners, or { missing } when the package is not installed.
 * ear.texts(labels) → unit vectors; ear.audio(mono48k) → a unit vector; tagger.tags(mono48k, n) → [[label, p], …].
 */
export async function loadListeners({ cwd = process.cwd(), sr = 48000 } = {}) {
  const where = findTransformers(cwd);
  if (!where) return { missing: "@huggingface/transformers is not installed (npm install @huggingface/transformers in films/project)" };
  // require.resolve finds the CommonJS build: its exports arrive under `default`.
  const mod = await import(pathToFileURL(where).href);
  const T = mod.AutoTokenizer ? mod : mod.default;
  const tok = await T.AutoTokenizer.from_pretrained(CLAP);
  const fp32 = { dtype: "fp32" }; // full precision, as the models were trained
  const textModel = await T.ClapTextModelWithProjection.from_pretrained(CLAP, fp32);
  const proc = await T.AutoProcessor.from_pretrained(CLAP);
  const audioModel = await T.ClapAudioModelWithProjection.from_pretrained(CLAP, fp32);
  const fe = await T.AutoFeatureExtractor.from_pretrained(AST);
  const ast = await T.AutoModelForAudioClassification.from_pretrained(AST, fp32);
  const id2label = ast.config.id2label;
  return {
    ear: {
      async texts(labels) {
        const { text_embeds } = await textModel(tok(labels.map((l) => `the sound of ${l}`), { padding: true, truncation: true }));
        return text_embeds.tolist().map(norm);
      },
      async audio(m) {
        // CLAP reads 48 kHz.
        const { audio_embeds } = await audioModel(await proc(resample(m, sr, 48000)));
        return norm(audio_embeds.tolist()[0]);
      },
    },
    tagger: {
      async tags(m, n = 5) {
        let x = resample(m, sr, 16000);
        // A short sound is repeated to two seconds: the model was trained on ten.
        if (x.length < 32000) x = Float32Array.from({ length: 32000 }, (_, i) => x[i % x.length]);
        const { logits } = await ast(await fe(x, { sampling_rate: 16000 }));
        const p = Array.from(logits.data, (v) => 1 / (1 + Math.exp(-v)));
        return p
          .map((v, i) => [id2label[i], Math.round(v * 100) / 100])
          .sort((a, b) => b[1] - a[1])
          .slice(0, n);
      },
    },
  };
}

/**
 * Whether a take passes, exactly as the private build reads it: `s` is the spec entry, `c` the take with `dur`,
 * `centroid`, `rank` (its own description's place among all), `heard` (the description CLAP put first), `tags`
 * ([[label, p]…], best first) and `tagged` (the best score of one of the entry's `tags`); `accepted` the `is` of the
 * entries the spec `accept`s.
 */
export function passes(s, c, accepted = []) {
  // A one-shot either model hears mostly as music or speech is out, unless it is meant to be pitched.
  if (!s.musical && s.kind !== "bed" && c.tags?.length && ["Music", "Speech", "Musical instrument"].includes(c.tags[0][0]) && c.tags[0][1] >= 0.3) return false;
  if (c.dur > (s.max ?? 99) || c.dur < (s.min ?? 0) || c.centroid < (s.minCentroid ?? 0)) return false;
  if ((c.tags ?? []).some(([l, p]) => (s.reject ?? []).includes(l) && p >= 0.1)) return false;
  // Two listeners; a take passes on either. CLAP: its own description among its `maxrank` (5) nearest of every
  // description in the library, or heard as one the entry accepts. AST: one of the entry's `tags` at 0.05 or more.
  if (c.rank <= (s.maxrank ?? 5) || c.tagged >= 0.05) return true;
  return accepted.includes(c.heard);
}

/** The order kept takes go in: best agreement first; a hit that starts late loses a little. */
export const score = (s, c) => c.fit + 0.3 * c.tagged - (s.kind === "hit" && c.attack < -6 ? 0.08 : 0);
