// The starter film's clock: its cues, every anchor (each pinned to a cue word), the camera's keys, and the world's
// state as pure functions of story time. ../../../../starter/audio/sfx-cues.json pins its sounds to the same words.
//
// `g` is story time in BASE frames. The film loops, so the tail is the same story as the time just before frame 0:
// story() maps a film frame to g, which runs 0 … SEAM0 and then SEAM0 - DURATION … 0 over the tail. Every state
// function below is defined on that circle and takes the same value at both ends of the jump (g = SEAM0 and
// g = DRY0 are one moment: the plant just watered, standing), so the world has no seam. The camera's keys loop on
// the film's own frames (Camera `loop`), so its push runs straight through frame 0.
import {EXIT, EXPO, GRAVITY, INOUT, lerp, p, shake} from '../../lib/anim';
import {makeCues} from '../../lib/cues';
import {M} from '../../lib/theme';
import {headlineExit} from '../../kit/Kit';
import type {CamKey} from '../../kit/Camera';
import {CARD, DONE_C, ICON_C, IMPACT, PHONE, SOIL} from './layout';
import cues from './cues.json';

export type LineId = 'hook' | 'stake' | 'turn' | 'payoff' | 'seam';
export const {cue, DURATION} = makeCues<LineId>(cues);

// ───────────── anchors (film frames, BASE units) ─────────────

/** The hook's title leaves, in time for line 2's first word, and its layer ends once the masked exit is over. */
export const HOOK_OUT = cue('stake', 0) - 16;
export const HOOK_END = HOOK_OUT + Math.ceil(headlineExit(4)) + 1;
/** The dry soil cracks open on "thirsty.". */
export const CRACK = cue('hook', 3) - 4;
/** The drooping leaf shivers on "tell" (it cannot say it), and lets go on "you." (hit 1). */
export const TREMBLE = cue('stake', 2);
export const FALL = cue('stake', 3) + 4;
/** The phone's screen wakes and the reminder slides in, just before "Quillfern"; the phone buzzes on it. */
export const WAKE = cue('turn', 0) - 14;
export const NOTE = WAKE + 6;
export const BUZZ = cue('turn', 0);
/** The Done disc asks to be tapped on "remembers.". */
export const ASK = cue('turn', 1);
/** A finger comes in and taps Done on "it"; the count rolls back to 0; the card's drop is flicked toward the pot. */
export const FINGER = cue('payoff', 0) - 6;
export const TAP = cue('payoff', 2);
export const RESET = TAP + 4;
export const LAUNCH = TAP + 16;
/** The height of the drop's arc, world px (World.tsx draws the flight; the camera follows it). */
export const ARC = 260;
/** The water lands just after "time." rises (hit 2); the leaves lift one by one. */
export const LAND = cue('payoff', 4) + 6;
export const LIFT = (i: number) => LAND + 8 + i * 7;
/** A new leaf unfurls where the old one fell; the burst (hit 3) when it opens. */
export const GROW = LAND + 42;
export const BURST = GROW + 18;
/** A bead of water runs off a leaf's tip and drips onto the sill. */
export const DRIP = BURST + 44;
/** The reminder is cleared, then the phone's screen goes back to sleep. */
export const CLEAR = TAP + 40;
export const SLEEP = cue('seam', 0) - 55;
/** The seam: from here the hook layer draws the rest of the film's words ("A week later…" and the title again). */
export const SEAM0 = cue('seam', 0) - 10;
/** The tail's first story frame (negative): the same moment as SEAM0. */
export const DRY0 = SEAM0 - DURATION;
/** The week starts passing: the count rolls up, a night for every day, until the leaf falls. */
export const WEEK0 = cue('seam', 1) - DURATION;

/** Story time at film frame f (see the top of this file). */
export const story = (f: number) => (f < SEAM0 ? f : f - DURATION);

// ───────────── the camera (world px; layout.ts) ─────────────

/** The rest pose: the whole sill, the plant standing in the middle of the frame (and where every Depth layer lines
 * up with the world). */
export const WIDE = {x: 548, y: 975, scale: 0.9};
/** The camera's keys, on film frames, looping (Camera `loop={DURATION}`): the last key eases into the first across
 * the film's end, so the push onto the soil runs through frame 0. */
export const CAMERA: CamKey[] = [
  // push in on the dry soil and the drooping leaf (from the tail, through frame 0), then creep closer while it hangs
  {at: cue('hook', 3) + 50, x: SOIL[0] + 130, y: SOIL[1] - 20, scale: 2.3},
  {at: FALL - 2, x: SOIL[0] + 150, y: SOIL[1] - 12, scale: 2.5},
  // the leaf lets go: tilt down after it as it falls past the sill
  {at: FALL + 34, x: SOIL[0] + 250, y: SOIL[1] + 120, scale: 2.0, ease: EXPO},
  // the phone wakes: push in on the reminder as it arrives, and creep while it is read
  {at: cue('turn', 0) + 24, x: CARD.x + CARD.w / 2, y: CARD.y + 120, scale: 3.0},
  {at: cue('payoff', 0) - 9, x: CARD.x + CARD.w / 2, y: CARD.y + 126, scale: 3.1},
  // push in on Done for the tap, and hold while the count rolls back: the card and the count below it both inside the
  // safe zone, between the headline and the bottom band
  {at: TAP - 3, x: DONE_C[0] - 74, y: DONE_C[1] + 55, scale: 2.75},
  {at: LAUNCH - 2, x: DONE_C[0] - 76, y: DONE_C[1] + 57, scale: 2.75},
  // follow the drop from the phone to the soil: through the top of its arc without stopping, arriving as it lands
  {at: Math.round((LAUNCH + LAND) / 2), x: (ICON_C[0] + IMPACT[0]) / 2 + 20, y: (ICON_C[1] + IMPACT[1]) / 2 - ARC * 0.55, scale: 2.1, ease: EXIT},
  {at: LAND, x: IMPACT[0], y: IMPACT[1] - 40, scale: 1.9, ease: EXPO},
  // pull out to the whole plant standing, and drift
  {at: LAND + 84, ...WIDE},
  {at: cue('seam', 0) + 3, x: 556, y: 982, scale: 0.92},
  // a week later: push in on the count as the days roll by (a night for each), the plant's leaves beside it
  {at: cue('seam', 2) + 32, x: PHONE.x + 10, y: PHONE.y + 215, scale: 1.4},
  {at: cue('seam', 2) + 68, x: PHONE.x - 8, y: PHONE.y + 220, scale: 1.45},
];

// ───────────── the world's state (story time g) ─────────────

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Soil moisture, 0..1: wet after watering, drains through the week, dry from TREMBLE until the water lands. */
export const moisture = (g: number) => {
  if (g < TREMBLE) return Math.pow(1 - clamp01((g - DRY0) / (TREMBLE - DRY0)), 1.3);
  if (g < LAND) return 0;
  return p(g, LAND, 44, M.in);
};
/** How far the wet patch has spread from where the water landed, 0..1 (1 all through the week). */
export const wetSpread = (g: number) => (g >= LAND ? p(g, LAND, 40, EXPO) : 1);
/** The cracks in the dry soil, drawn on as "thirsty." is read, washed away when the water lands. */
export const cracks = (g: number) => (g < 0 ? 0 : g < LAND ? p(g, CRACK, 46) : 1 - p(g, LAND, 26));

/** Days since water: rolls up through the week (fast, then slower), reaching 9 as the leaf falls; rolls back to 0
 * when Done is tapped. */
export const days = (g: number) => {
  if (g < WEEK0) return 0;
  if (g < FALL) return 9 * (1 - Math.pow(1 - clamp01((g - WEEK0) / (FALL - WEEK0)), 1.7));
  return 9 * (1 - p(g, RESET, 14, INOUT));
};
/** Night, 0..1: while the days roll up, the window dims for each night (the count turns over at midnight). */
export const night = (g: number) => {
  if (g < WEEK0 || g >= FALL) return 0;
  const fr = days(g) % 1;
  return fr < 0.5 ? 0 : Math.pow(Math.sin((Math.PI * (fr - 0.5)) / 0.5), 2);
};
/** The sun's drift across each day, -1..1 (for the beam's angle), 0 outside the week. */
export const sun = (g: number) => (g < WEEK0 || g >= FALL ? 0 : Math.sin(Math.PI * 2 * (days(g) % 1)) * lerp(g, [WEEK0, WEEK0 + 20, FALL - 40, FALL], [0, 1, 1, 0], (t) => t));

/** How far leaf i hangs, 0 upright .. 1 wilted. It follows the soil; after watering the leaves lift one by one. */
export const droop = (g: number, i: number) => (g < LAND ? Math.pow(1 - moisture(g), 0.8) : 1 - p(g, LIFT(i), 34, M.in));
/** The falling leaf's shiver on "tell", growing until it lets go. */
export const shiver = (g: number) => (g < TREMBLE || g >= FALL ? 0 : Math.sin((g - TREMBLE) * 0.8) * lerp(g, [TREMBLE, FALL], [1.5, 6], (t) => t));
/** The leaf that falls: 0 attached, 0..1 falling, gone after; it regrows from GROW. */
export const fallT = (g: number) => p(g, FALL, 66, GRAVITY);
export const growT = (g: number) => p(g, GROW, 36, M.in);
/** Water on the leaves, 0..1: beads after watering, drying through the week. */
export const beads = (g: number) => (g >= LAND ? p(g, LIFT(0), 20) : clamp01(moisture(g) * 1.4 - 0.4));

/** The phone's screen, 0 asleep (dim, always on) .. 1 awake. */
export const awake = (g: number) => p(g, WAKE, 10, (t) => t) * (1 - p(g, SLEEP, 30, M.out));
/** The reminder: slides in, and slides away once it is done. */
export const note = (g: number) => p(g, NOTE, 18, M.in) * (1 - p(g, CLEAR, 16, M.out));
/** The phone's buzz: two short, decaying jitters (the kit's shake, one value per 60 Hz frame), [dx, dy] world px. */
export const buzz = (g: number): [number, number] => {
  const [a, b] = shake(g, BUZZ, 10, 3, 'buzz1');
  const [c, d] = shake(g, BUZZ + 14, 10, 3, 'buzz2');
  return [a + c, (b + d) * 0.3];
};
/** The Done disc's check, drawn on after the tap. */
export const doneT = (g: number) => p(g, TAP + 2, 20);
/** The drop's flight from the card's icon into the soil, 0..1. */
export const dropT = (g: number) => lerp(g, [LAUNCH, LAND], [0, 1], (t) => t);
