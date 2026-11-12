// The style: every colour, face, radius and easing a film uses comes from tokens.json through this file.
// `film.mjs theme` rewrites tokens.json from the brand's style; nothing else needs to change.
// Rule: no scene or kit file holds a colour literal. A shade that is not a token is derived here, from a token.
import {Easing} from 'remotion';
import tokens from './tokens.json';

export type Motion = 'snappy' | 'smooth' | 'bouncy';

export type Tokens = {
  canvas: string;
  panel: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  danger: string;
  font_display: string;
  font_text: string;
  radius: number;
  motion: Motion;
};

/** The tokens, typed. */
export const T = tokens as Tokens;

/** A colour token's name, for props that pick one ("tone"). */
export type Tone = 'canvas' | 'panel' | 'ink' | 'muted' | 'accent' | 'accent2' | 'danger';

/** Font stacks. Only Inter ships (shared/fonts/); a brand's own face is its file in brand/<slug>/fonts/, named after
 * its family (fonts.ts loads it). A family with no file falls back to Inter. */
export const F = {
  display: `"${T.font_display}", "Inter", system-ui, sans-serif`,
  text: `"${T.font_text}", "Inter", system-ui, sans-serif`,
} as const;

/** The frame and the platforms' safe zone (1080×1920). The feeds draw their own interface over the top 14 % (270 px),
 * the bottom 35 % (672 px: the caption, the account line, the buttons) and 6 % of each side (65 px), so nothing a
 * viewer must read goes there. The picture itself may run to the frame's edges; text, numbers and labels may not. */
export const L = {
  W: 1080,
  H: 1920,
  top: 270,
  bottom: 1248,
  left: 65,
  right: 1015,
  /** The headline slot: the first line's top. */
  headTop: 300,
  /** Headline size, px. Headlines are at least 100 px, any other text at least 32 px. */
  head: 132,
  /** An episode of a series: its mark's line top and size (kit SeriesMark), and the headline slot under it. */
  markTop: 282,
  mark: 40,
  headTopMarked: 350,
} as const;

// ───────────── colour arithmetic (the only place colours are computed) ─────────────

// Every colour token is #RRGGBB: `film.mjs theme` writes #abc out in full and refuses a colour with alpha.
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** A token at an opacity: `alpha(T.ink, 0.12)`. */
export const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a))})`;
};

/** Mix two hex colours, t 0 → a, 1 → b. */
export const mixColor = (a: string, b: string, t: number) => {
  const pa = rgb(a);
  const pb = rgb(b);
  const k = Math.min(1, Math.max(0, t));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** Derived shades. The darkest is the canvas pushed toward black (shadows); `line` is a hairline on a panel. */
const black = mixColor(T.canvas, '#000000', 0.7);
export const D = {
  line: alpha(T.ink, 0.12),
  track: alpha(T.ink, 0.1),
  raised: mixColor(T.panel, T.ink, 0.08),
  deep: mixColor(T.canvas, '#000000', 0.35),
  shadow: `0 30px 80px ${alpha(black, 0.55)}`,
  shadowSm: `0 10px 30px ${alpha(black, 0.4)}`,
  /** A CSS filter shadow, for SVG shapes (a cursor, a leaf). */
  drop: `drop-shadow(0 8px 14px ${alpha(black, 0.5)})`,
} as const;

/** The ink that reads on a filled token (on an accent, the canvas; on a dark fill, the ink). */
export const onTone = (tone: Tone) => (tone === 'canvas' || tone === 'panel' ? T.ink : T.canvas);

/** The highlighter behind a headline's key word: a fill of the accent, the word in the ink that reads on it. */
export const HL = {fill: T.accent, ink: onTone('accent')} as const;

// ───────────── motion ─────────────

type Ease = (t: number) => number;

/** The easing preset `motion` selects. `in`: an entrance (fast, then settles). `out`: an exit (accelerates away).
 * `move`: a carry from one place to another. `k` scales the kit's default durations. */
const PRESETS: Record<Motion, {in: Ease; out: Ease; move: Ease; k: number}> = {
  snappy: {in: Easing.bezier(0.16, 1, 0.3, 1), out: Easing.bezier(0.7, 0, 0.84, 0), move: Easing.bezier(0.65, 0, 0.35, 1), k: 1},
  smooth: {in: Easing.bezier(0.33, 1, 0.68, 1), out: Easing.bezier(0.32, 0, 0.67, 0), move: Easing.bezier(0.45, 0, 0.55, 1), k: 1.25},
  bouncy: {in: Easing.out(Easing.back(1.5)), out: Easing.bezier(0.7, 0, 0.84, 0), move: Easing.bezier(0.34, 1.3, 0.64, 1), k: 1},
};

export const M = PRESETS[T.motion] ?? PRESETS.snappy;
