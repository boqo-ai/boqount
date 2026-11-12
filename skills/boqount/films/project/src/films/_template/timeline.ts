// The film's clock. THE CUES: every beat is pinned to a word of cues.json (../<slug>/audio/cues.json, copied here by
// the sync): the voice, or for a voice-free film the on-screen words timed at reading speed. Write each anchor below
// as a cue (`cueAt(line, word)`), never as a bare number of frames, so a re-timed line moves everything with it,
// and pin the sounds of ../<slug>/audio/sfx-cues.json to the same words ("<line id>.<word>").
//
// Lines are read by position (LINES[0] is the hook), never by a fixed id, so this skeleton builds with any ids, and
// with the empty cues.json `film.mjs new` writes (it is then 8 seconds long).
//
// THE CARRIED OBJECT: the one thing the film carries through every line with no cut. Write its state here as pure
// functions of story time g (BASE frames), defined on the whole loop, g from SEAM0 - DURATION up to SEAM0, so the
// last frame and frame 0 come from one curve (see the starter's timeline.ts: moisture(), days(), droop()).
import {BASE, makeCues, sec, type Line} from '../../lib/cues';
import {headlineExit} from '../../kit/Kit';
import {AIM, type CamKey} from '../../kit/Camera';
import cues from './cues.json';

/** The lines of cues.json, in order. */
export const LINES = cues.lines as Line[];
const clock = makeCues(cues);

/** The film frame word `w` of line `i` starts on, shifted by `offsetSec` (0 while that line or word is not written). */
export const cueAt = (i: number, w: number, offsetSec = 0) => {
  const line = LINES[i];
  return line?.words[w] ? clock.cue(line.id, w, offsetSec) : 0;
};
/** The film frame word `w` of line `i` ends on. */
export const cueEndAt = (i: number, w: number, offsetSec = 0) => {
  const line = LINES[i];
  return line?.words[w] ? clock.cueEnd(line.id, w, offsetSec) : 0;
};

/** The film's length in BASE frames: the cue sheet's (a whole number of 30 fps frames), or 8 seconds while empty. */
export const DURATION = cues.duration > 0 ? clock.DURATION : 8 * BASE;

// ───────────── the series (an episode only) ─────────────

/** OPTIONAL: a film that is an episode of a series (a `niche` film) shows `<Series> · <NN>` above the headline for
 * the whole film (kit SeriesMark, drawn in Scenes.tsx; the headlines move down under it). Not an episode: leave it
 * null. An episode: switch the line below on, with the series' name and this episode's number. */
export const SERIES: {name: string; n: number} | null = null;
// export const SERIES = {name: 'Windowsill Physics', n: 1};

// ───────────── anchors (film frames, BASE units) ─────────────

/** The hook: the first line's words, or the film's slug while there are no cues. */
export const HOOK_WORDS = (LINES[0]?.text ?? '').split(/\s+/).filter(Boolean);
/** The hook's title leaves when its line has been read (2.5 s while there are no cues). */
export const HOOK_OUT = LINES[0]?.words.length ? cueEndAt(0, LINES[0].words.length - 1) : sec(2.5);
/** The hook scene ends once the title's masked exit is over: sooner, and the title is cut off whole. */
export const HOOK_END = HOOK_OUT + Math.ceil(headlineExit(Math.max(1, HOOK_WORDS.length))) + 1;
/** THE SEAM: from here the hook layer draws the film's tail again (Scenes.tsx), so the last frame runs into frame 0.
 * On screen, the last line is left unfinished and the title on frame 0 completes it. */
export const SEAM0 = Math.max(HOOK_END, DURATION - sec(1));

// ───────────── the carried object's state ─────────────

/** A stand-in: a slow swing that repeats once per film, so it is the same on the last frame and on frame 0. */
export const swing = (g: number) => Math.sin((2 * Math.PI * g) / DURATION);

// ───────────── the camera ─────────────

/** THE CAMERA'S KEYS (kit/Camera.tsx): one travelling camera over the world, never a cut. Write one key per beat,
 * each at a cue: push in on the thing a line names (scale 2–3.5, x and y on that thing, in world px) until its detail
 * fills the frame, and pull out to the whole again (scale about 1). The camera rests on each key and eases between
 * them; Stage passes `loop={DURATION}`, so the last key eases into the first across the film's end.
 * This skeleton's move: one gentle push in on the carried object over the first half, and the pull out over the
 * second, back to the first key's pose at the loop. */
export const CAMERA: CamKey[] = [
  {at: 0, x: AIM[0], y: AIM[1], scale: 1},
  // e.g. {at: cueAt(1, 0), x: <the thing line 2 names>, y: …, scale: 2.4},
  {at: Math.round(DURATION / 2), x: AIM[0], y: AIM[1] + 40, scale: 1.25},
];
