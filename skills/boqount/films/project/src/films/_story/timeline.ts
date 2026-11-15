// The clock of a story film (film.md → The story format): ten parts, one world for each, every change on a spoken
// word, and no loop. `film.mjs new <slug> --story` copies this skeleton; the starter (src/films/starter/) is a whole
// film built on it.
//
// THE CUES: every beat is pinned to a word of cues.json (../<slug>/audio/cues.json, copied here by the sync): the
// voice, or for a voice-free film the words timed at speaking pace (the captions carry it on mute). Write each anchor
// as a cue (`cueAt(line, word)`), never a bare number of frames, so a re-timed line moves everything with it.
//
// Lines are read by position (LINES[0] is the hook's first line), never by a fixed id, so this skeleton builds with
// any ids, and with the empty cues.json `film.mjs new` writes (it is then 8 seconds long, its worlds spread evenly).
import {BASE, makeCues, type Line} from '../../lib/cues';
import {phrasesOf} from '../../kit/Captions';
import {spans, type Change} from '../../kit/WorldChange';
import cues from './cues.json';

/** The lines of cues.json, in order. */
export const LINES = cues.lines as Line[];
const clock = makeCues(cues);

/** The film frame word `w` of line `i` starts on, shifted by `offsetSec` (0 while that line or word is not written). */
export const cueAt = (i: number, w: number, offsetSec = 0) => {
  const line = LINES[i];
  return line?.words[w] ? clock.cue(line.id, w, offsetSec) : 0;
};
/** The same, by line id and word: the shape kit/Captions.tsx asks for. */
export const cueOf = (id: string, w: number) => clock.cue(id, w);
export const wordOf = (id: string, w: number) => clock.wordText(id, w);

/** The film's length in BASE frames: the cue sheet's (a whole number of 30 fps frames), or 8 seconds while empty. */
export const DURATION = cues.duration > 0 ? clock.DURATION : 8 * BASE;

// ───────────── the ten parts ─────────────

/** The parts of the story, in order (hooks.md → The arc: the story format). */
export const PARTS = ['Hook', 'Proof', 'Catch', 'Who is left', 'Where you come in', 'What most do', 'Turn', 'The product at work', 'Payoff', 'Call'] as const;

/** EDIT: the index in LINES of each part's first line, as the script's `Structure:` line numbers them (minus one).
 * The world of part k starts on that line's first word. */
export const FIRST_LINE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** EDIT: the move into parts 2…10, in order: 'push', 'pull' or 'cut' (kit/WorldChange.tsx). */
export const MOVES: Change[] = ['push', 'push', 'pull', 'pull', 'push', 'cut', 'push', 'pull', 'cut'];

/** Where each world starts: four BASE frames before its first word, so the move lands on the word. While the cues are
 * empty, the worlds are spread evenly over the 8 seconds. */
const MARKS =
  LINES.length === 0
    ? [...PARTS.map((_, k) => Math.round((k * DURATION) / PARTS.length)), DURATION]
    : [0, ...FIRST_LINE.slice(1).map((i) => Math.max(1, cueAt(i, 0) - 4)), DURATION];
export const WORLDS = spans(MARKS, MOVES);

// ───────────── the hook's source and the call ─────────────

/** EDIT: the hook's number is real and from a source anyone can open; its source line is on screen by 0.5 s. */
export const SOURCE = {who: '<who published it>', date: '<the date read>'};

/** EDIT: the code word of the call, as the caption sets it; its DM rule is in brand/<slug>/accounts.md → DM automation
 * (a product or offer film with no confirmed rule for its code word is held: check.md). */
export const CODE = 'CODE';
/** The call's line is the last: "Comment <CODE>, and I'll send you the link." Typed on word 1, sent on word 2, the
 * reply arriving on the last word ("link"). */
const CALL = LINES.length - 1;
export const CALL_AT = {
  type: cueAt(CALL, 1),
  send: cueAt(CALL, 2),
  reply: Math.max(0, cueAt(CALL, (LINES[CALL]?.words.length ?? 1) - 1) - 4),
};

// ───────────── the captions ─────────────

/** EDIT: per line id, the word indexes set in the accent (the word that carries each phrase). */
const KEYS: Record<string, number[]> = {};
export const PHRASES = phrasesOf(LINES, KEYS);
