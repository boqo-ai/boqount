// The film's clock. Every beat is a cue: a word of the film's cues.json (its voice, or for a voice-free film its
// on-screen words timed at reading speed). Each film calls makeCues() with its own cues.json.
//
// Motion is authored on a 60-unit time base: every cue, duration and easing counts BASE frames a second.
// The film is sampled at FPS (120): useF() returns fractional BASE frames, so changing FPS resamples the film and
// never retimes it. The 120 samples are not shipped as 120 fps: the platforms play at most 60 fps, so `feed`
// blends each pair of samples into one 60 fps frame (a 180° shutter).
export const BASE = 60;
export const FPS = 120;
export const K = FPS / BASE;

export type Word = {word: string; start: number; end: number};
export type Line = {id: string; text: string; start: number; end: number; words: Word[]};
export type CuesJson = {duration: number; lines: Line[]};

/** Seconds → the nearest BASE frame. */
export const sec = (s: number) => Math.round(s * BASE);

/** A film's cue functions. `Id` is the union of its line ids, so a typo is a type error:
 * `makeCues<'hook' | 'turn' | 'seam'>(cues)`. */
export const makeCues = <Id extends string = string>(json: {duration: number; lines: {id: string; text: string; start: number; end: number; words: Word[]}[]}) => {
  const lines = json.lines as Line[];
  const byId = new Map(lines.map((l) => [l.id, l]));

  // A film whose cues.json is still the empty skeleton (`film.mjs new`) reads every cue as 0, so the project keeps
  // rendering its other films. Once the file has lines, a missing line or word is an error.
  const word = (id: Id, i: number): Word => {
    if (lines.length === 0) return {word: '', start: 0, end: 0};
    const l = byId.get(id);
    if (!l) throw new Error(`cues.json has no line "${id}"`);
    const w = l.words[i];
    if (!w) throw new Error(`cues.json line "${id}" has no word ${i}`);
    return w;
  };

  /** Frame at which word `i` of line `id` starts, optionally shifted by `offsetSec`. */
  const cue = (id: Id, i: number, offsetSec = 0) => sec(word(id, i).start + offsetSec);
  /** Frame at which word `i` of line `id` ends. */
  const cueEnd = (id: Id, i: number, offsetSec = 0) => sec(word(id, i).end + offsetSec);
  const wordText = (id: Id, i: number) => word(id, i).word;

  // A whole number of 30 fps frames, rounded up (an even count of BASE frames). TikTok re-encodes to 30 fps and pads
  // a length that falls between two of its frames, which stalls the loop. The mix uses the same rounding.
  // At least one second, so a film whose cues are still empty registers.
  const DURATION = Math.max(30, Math.ceil(json.duration * 30)) * (BASE / 30);

  /** Each line's span [start, end) in frames: it starts just before its first word and runs to the next line's. */
  const starts = lines.map((l, i) => (i === 0 ? 0 : sec((l.words[0]?.start ?? l.start) - 0.15)));
  const SCENES = Object.fromEntries(lines.map((l, i) => [l.id, [starts[i], i + 1 < lines.length ? starts[i + 1] : DURATION] as const])) as Record<Id, readonly [number, number]>;

  return {cue, cueEnd, sec, wordText, DURATION, SCENES};
};
