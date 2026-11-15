// The starter's clock: its cues, where each world starts and ends, and the captions' phrases. A story film (film.md →
// The story format): ten parts, one world for each, every change on a spoken word, no loop. The words are on screen
// in the captions (kit/Captions.tsx), timed at speaking pace in ../../../../starter/audio/cues.json, so the film reads
// on mute and takes a voice later without a change here (a voiced cues.json moves every anchor with it).
import {makeCues, type Line} from '../../lib/cues';
import {phrasesOf} from '../../kit/Captions';
import {spans, type Change} from '../../kit/WorldChange';
import cues from './cues.json';

export type LineId =
  | 'hook'
  | 'twist'
  | 'proof'
  | 'catch'
  | 'silent'
  | 'late'
  | 'left'
  | 'guess'
  | 'you'
  | 'carry'
  | 'most'
  | 'sunday'
  | 'result'
  | 'turn'
  | 'name'
  | 'remind'
  | 'done'
  | 'payoff'
  | 'cta';
export const {cue, cueEnd, wordText, DURATION} = makeCues<LineId>(cues);
/** The same, for the kit's components, which take any line id. */
export const cueOf = (line: string, i: number) => cue(line as LineId, i);
export const wordOf = (line: string, i: number) => wordText(line as LineId, i);

/** The code word of the call (line `cta`), as the caption and the comment set it. The account's DM rule for it is
 * in brand/<slug>/accounts.md → DM automation. */
export const CODE = 'FERN';

// ───────────── the worlds: one per part, each change on the first word of its line ─────────────

/** The word each world starts on, and the move into it. */
const at = (id: LineId) => cue(id, 0) - 4;
const MARKS = [0, at('proof'), at('catch'), at('left'), at('you'), at('most'), at('result'), at('name'), at('payoff'), at('cta'), DURATION];
/** The change into worlds 2…10, in order. */
export const MOVES: Change[] = ['push', 'push', 'pull', 'pull', 'push', 'cut', 'push', 'pull', 'cut'];
const S = spans(MARKS, MOVES);
export const WORLD = {
  number: S[0], //   1 hook: nine in ten trips, and your plants stay
  shelf: S[1], //    2 proof: twelve plants, six schedules
  soil: S[2], //     3 catch: a plant can't tell you
  notes: S[3], //    4 who is left: keeping track by memory
  sill: S[4], //     5 where you come in: twelve water days in your head
  week: S[5], //     6 what most do: everything the morning they leave
  pair: S[6], //     7 the result, and the turn: a schedule of their own
  app: S[7], //      8 the product at work
  payoff: S[8], //   9 the payoff
  call: S[9], //     10 the call, shown
} as const;

// ───────────── the captions ─────────────

/** The word indexes (per line) set in the accent: the word that carries each phrase. */
const KEYS: Partial<Record<LineId, number[]>> = {
  hook: [0, 1, 2, 7],
  twist: [2, 3],
  proof: [4, 11],
  catch: [3],
  silent: [6],
  late: [10],
  left: [10],
  guess: [4],
  you: [6],
  carry: [3, 4, 5],
  most: [5],
  sunday: [2, 6],
  result: [6, 13],
  turn: [1, 8],
  name: [0],
  remind: [2, 3, 12],
  done: [0, 1],
  payoff: [3, 4],
  cta: [1],
};
export const PHRASES = phrasesOf(cues.lines as Line[], KEYS as Record<string, number[]>);
