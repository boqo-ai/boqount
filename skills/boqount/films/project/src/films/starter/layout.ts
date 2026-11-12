// The world, in world px (kit/Camera.tsx): a windowsill with the plant in its pot, a phone propped beside it, a small
// second pot, and a window behind. At the camera's rest pose (WIDE, timeline.ts) one world px is 0.9 frame px.
import type {R} from '../../lib/anim';

/** The sill's top surface: everything stands on it. */
export const SILL = 1400;

/** The plant: its pot's centre line and its size against the base leaf table below. */
export const PX = 400;
export const S = 1.45;
/** Where the stems leave the soil. */
export const SOIL: [number, number] = [PX, 1110];
/** The pot's rim: its top surface (an ellipse seen from a little above) and the band below it. */
export const RIM = {cx: PX, cy: 1098, rx: 222, ry: 42, band: 40};
/** The pot's body under the rim, standing in its saucer on the sill. */
export const POT = {top: RIM.cy + RIM.band, bottom: SILL - 14, topW: 410, bottomW: 300};
/** The soil's surface, inside the rim. */
export const SOIL_E = {cx: PX, cy: RIM.cy + 4, rx: 198, ry: 33};
/** Where the water lands. */
export const IMPACT: [number, number] = [PX + 46, SOIL_E.cy + 8];

/** The five leaves at S = 1: angle from upright (deg), stem length, blade length, where the stem leaves the soil. */
export const LEAVES = [
  {a: -56, l: 185, b: 138, dx: -36},
  {a: -27, l: 240, b: 150, dx: -16},
  {a: 4, l: 262, b: 156, dx: 0},
  {a: 31, l: 226, b: 148, dx: 18},
  {a: 58, l: 178, b: 134, dx: 38},
];
/** The leaf that falls and grows back. */
export const FALLER = 4;

/** The phone, propped on the sill to the right, and what its lock screen holds (world px). */
export const PHONE: R = {x: 790, y: 860, w: 270, h: 540};
export const BEZEL = 9;
const SX = PHONE.x + BEZEL;
const SY = PHONE.y + BEZEL;
/** The reminder (a notification) and the lock-screen widget with the count. */
export const CARD: R = {x: SX + 10, y: SY + 66, w: PHONE.w - 2 * BEZEL - 20, h: 112};
export const WIDGET: R = {x: SX + 10, y: SY + 196, w: PHONE.w - 2 * BEZEL - 20, h: 112};
export const ICON = 30;
export const DONE = 40;
/** The card's drop icon and its Done disc, in world px: the drop leaves from one, the finger taps the other. */
export const ICON_C: [number, number] = [CARD.x + 12 + ICON / 2, CARD.y + 12 + ICON / 2];
export const DONE_C: [number, number] = [CARD.x + CARD.w - 12 - DONE / 2, CARD.y + 76];

/** The window behind the sill (drawn at depth 0.5) and the small second pot on the left. */
export const WINDOW: R = {x: 120, y: 240, w: 860, h: SILL - 8 - 240};
export const SMALL = {cx: 92, w: 120, h: 112};
