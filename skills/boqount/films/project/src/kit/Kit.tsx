// The kit: neutral building blocks, drawn only from the style tokens (lib/theme.ts). Sizes are film pixels on the
// 1080×1920 frame: a headline is at least 100 px, any other text a viewer must read at least 32 px.
// Times are BASE frames (60 a second, lib/cues.ts); `at` and `out` are film frames, usually cue() values.
// Default positions and widths come from L (lib/theme.ts): the headline slot and the platforms' safe area.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Video} from '@remotion/media';
import {measureText} from '@remotion/layout-utils';
import {lerp, p, R, box} from '../lib/anim';
import {useFontsLoaded} from '../lib/fonts';
import {useF} from '../lib/scene';
import {D, F, HL, L, M, T, Tone, alpha, onTone} from '../lib/theme';
import {CHECK, Draw, Odo} from './Fx';

// ───────────────────────────── the masked headline ─────────────────────────────

/** One word of a headline: its text, the frame it rises on, and how it is set: plain (the headline's tone), tinted
 * (`tone`), or highlighted (`hl`). */
export type HW = {
  t: string;
  at: number;
  /** Tinted: the word in this colour token. */
  tone?: Tone;
  /** Highlighted, for the one word or number that carries the line: a fill of the accent wipes in left to right
   * behind the word and turns it to the ink that reads on it (theme HL). `true` wipes in with the word as it rises;
   * a number is the film frame the wipe starts on instead. */
  hl?: true | number;
};

/** Frames the highlighter takes to wipe across its word. */
const HL_WIPE = 12 * M.k;

const HEAD_TRACKING = -0.035; // em
const HEAD_GAP = 0.24; // em, between words
const HEAD_WEIGHT = 700;

/** Frames a Headline of `words` words takes to leave once its `out` frame comes: the last word's mask closes then.
 * A scene that holds a Headline must last at least this long past `out`, or the words vanish whole. */
export const headlineExit = (words: number) => Math.max(0, words - 1) * 0.8 + 10 * M.k;

/** The widest line's width at font size `size`, px (in the display face, once it is loaded). */
const widest = (lines: HW[][], size: number) =>
  Math.max(
    0,
    ...lines.map((ws) =>
      ws.reduce((sum, w, i) => sum + measureText({text: w.t, fontFamily: F.display, fontSize: size, fontWeight: HEAD_WEIGHT, letterSpacing: `${HEAD_TRACKING}em`}).width + (i > 0 ? HEAD_GAP * size : 0), 0),
    ),
  );

/** A headline that reveals by word: each word rises out of its own mask on its cue, with a small settle, and the
 * whole block leaves upward through the same masks, word by word, from `out` (it takes headlineExit(words) frames).
 * Centred in the safe area's width, in the headline slot. A line wider than the safe area shrinks the whole block's
 * font size until it fits: the words never leave the frame. */
export const Headline: React.FC<{
  lines: HW[][];
  top?: number;
  size?: number;
  out?: number;
  /** The colour of a word with no tone of its own. */
  tone?: Tone;
  align?: 'center' | 'left';
  /** Frames a word takes to rise. */
  dur?: number;
  lh?: number;
  style?: React.CSSProperties;
}> = ({lines, top = L.headTop, size = L.head, out, tone = 'ink', align = 'center', dur = 18 * M.k, lh = 1.06, style}) => {
  const f = useF();
  const fontsLoaded = useFontsLoaded();
  const room = L.right - L.left;
  const width = fontsLoaded ? widest(lines, size) : 0;
  const fit = width > room ? size * (room / width) : size;
  let k = 0;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: L.left,
        width: room,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'left' ? 'flex-start' : 'center',
        fontFamily: F.display,
        fontWeight: HEAD_WEIGHT,
        fontSize: fit,
        lineHeight: lh,
        letterSpacing: `${HEAD_TRACKING}em`,
        ...style,
      }}
    >
      {lines.map((ws, li) => (
        <div key={li} style={{display: 'flex', gap: `${HEAD_GAP}em`, alignItems: 'baseline', whiteSpace: 'nowrap'}}>
          {ws.map((w, wi) => {
            const idx = k++;
            const tin = p(f, w.at - 2, dur);
            const tout = out === undefined ? 0 : p(f, out + idx * 0.8, 10 * M.k, M.out);
            const y = (1 - tin) * 110 - tout * 110;
            const hlT = w.hl === undefined ? 0 : p(f, w.hl === true ? w.at - 2 + dur * 0.45 : w.hl, HL_WIPE, M.move);
            const ink = T[w.tone ?? tone];
            return (
              <span key={wi} style={{display: 'inline-block', overflow: 'hidden', padding: '0.08em 0.08em 0.18em', margin: '-0.08em -0.08em -0.18em'}}>
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    isolation: 'isolate',
                    translate: `0 ${y}%`,
                    rotate: `${(1 - tin) * 5}deg`,
                    transformOrigin: '0% 100%',
                    color: ink,
                    opacity: tin > 0.002 && tout < 0.998 ? 1 : 0,
                  }}
                >
                  {w.t}
                  {/* the highlighter: the fill and the word again in HL.ink, revealed together left to right, so the
                      word turns colour exactly where the fill has reached */}
                  {hlT > 0 && (
                    <span
                      aria-hidden
                      style={{position: 'absolute', top: 0, bottom: 0, left: '-0.08em', right: '-0.08em', paddingLeft: '0.08em', color: HL.ink, isolation: 'isolate', clipPath: `inset(0 ${(1 - hlT) * 100}% 0 0)`}}
                    >
                      <span style={{position: 'absolute', left: 0, right: 0, top: '0.08em', bottom: '-0.02em', background: HL.fill, borderRadius: '0.12em', zIndex: -1}} />
                      {w.t}
                    </span>
                  )}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Words for a Headline from one string: word i rises at at[i] (or at + i * step). */
export const words = (text: string, at: number | number[], tone?: Tone, step = 4): HW[] =>
  text.split(' ').map((t, i) => ({t, at: Array.isArray(at) ? at[Math.min(i, at.length - 1)] : at + i * step, tone}));

// ───────────────────────────── capsule / label ─────────────────────────────

/** A capsule label. `tone` fills it (the ink flips to read on the fill); the default is a quiet raised panel. */
export const Label: React.FC<{children: React.ReactNode; tone?: Tone; size?: number; style?: React.CSSProperties}> = ({children, tone = 'panel', size = 36, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: size * 0.35,
      height: size * 1.9,
      padding: `0 ${size * 0.7}px`,
      borderRadius: 999,
      background: tone === 'panel' ? D.raised : T[tone],
      boxShadow: tone === 'panel' ? `inset 0 0 0 2px ${D.line}` : undefined,
      color: onTone(tone),
      fontFamily: F.text,
      fontWeight: 600,
      fontSize: size,
      letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </div>
);

// ───────────────────────────── series mark ─────────────────────────────

/** An episode of a series: `<Series> · <NN>` in a small line above the headline, at the top of the safe zone
 * (L.markTop). Drawn whole from frame 0 and through the whole film, outside every Scene's timing, so it never moves:
 * put it once in Scenes.tsx, over everything, and set the headlines' `top` to L.headTopMarked to leave it room. */
export const SeriesMark: React.FC<{series: string; n: number; align?: 'center' | 'left'; style?: React.CSSProperties}> = ({series, n, align = 'center', style}) => (
  <div
    style={{
      position: 'absolute',
      top: L.markTop,
      left: L.left,
      width: L.right - L.left,
      display: 'flex',
      justifyContent: align === 'left' ? 'flex-start' : 'center',
      gap: L.mark * 0.4,
      fontFamily: F.text,
      fontWeight: 600,
      fontSize: L.mark,
      lineHeight: 1.2,
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
      color: T.muted,
      ...style,
    }}
  >
    <span>{series}</span>
    <span>·</span>
    <span style={{color: T.accent, fontVariantNumeric: 'tabular-nums'}}>{String(n).padStart(2, '0')}</span>
  </div>
);

// ───────────────────────────── source line ─────────────────────────────

/** The source of an outside fact, on screen: `Source: <who>, <date read>` in a small line under the thing it belongs
 * to (`top`, frame px), rising in on `at` and leaving from `out`. Never fine print: at least the kit's smallest label
 * (36 px). Kept inside the safe zone: a `top` above or below it is moved in, and the line wraps inside its width. */
export const SourceLine: React.FC<{
  who: string;
  date: string;
  top: number;
  at: number;
  out?: number;
  left?: number;
  width?: number;
  align?: 'center' | 'left';
  size?: number;
  style?: React.CSSProperties;
}> = ({who, date, top, at, out, left = L.left, width = L.right - L.left, align = 'center', size = 38, style}) => {
  const f = useF();
  const s = Math.max(36, size);
  const x = Math.max(L.left, left);
  const w = Math.min(width, L.right - x);
  const y = Math.min(Math.max(L.top, top), L.bottom - s * 1.25 * 2);
  const tin = p(f, at, 12 * M.k);
  const tout = out === undefined ? 0 : p(f, out, 10 * M.k, M.out);
  const v = tin * (1 - tout);
  if (v <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: x,
        width: w,
        textAlign: align,
        fontFamily: F.text,
        fontWeight: 500,
        fontSize: s,
        lineHeight: 1.25,
        letterSpacing: '-0.005em',
        color: T.muted,
        opacity: v,
        translate: `0 ${(1 - tin) * 16 - tout * 10}px`,
        ...style,
      }}
    >
      <span style={{color: T.ink, fontWeight: 600}}>Source:</span> {who}, {date}
    </div>
  );
};

// ───────────────────────────── card / tile ─────────────────────────────

/** A panel at a rectangle: the tokens' panel colour and radius, a hairline and a soft shadow. */
export const Card: React.FC<{r: R; radius?: number; tone?: Tone; children?: React.ReactNode; style?: React.CSSProperties}> = ({r, radius = T.radius, tone = 'panel', children, style}) => (
  <div style={{...box(r), borderRadius: radius, background: T[tone], boxShadow: `inset 0 0 0 2px ${D.line}, ${D.shadow}`, overflow: 'hidden', ...style}}>{children}</div>
);

// ───────────────────────────── number with a unit ─────────────────────────────

/** A number that rolls like an odometer, with its unit beside it ("9 days", "42 %"). */
export const Stat: React.FC<{value: number; unit?: string; size?: number; tone?: Tone; unitTone?: Tone; style?: React.CSSProperties}> = ({value, unit, size = 120, tone = 'ink', unitTone = 'muted', style}) => (
  <span style={{display: 'inline-flex', alignItems: 'baseline', gap: size * 0.18, ...style}}>
    <Odo value={value} size={size} color={T[tone]} />
    {unit && <span style={{fontFamily: F.text, fontWeight: 600, fontSize: size * 0.4, color: T[unitTone], letterSpacing: '-0.01em'}}>{unit}</span>}
  </span>
);

// ───────────────────────────── progress bar ─────────────────────────────

/** A bar filled to `value` (0..1). The fill keeps its round end; it never draws narrower than its own height. */
export const Progress: React.FC<{r: R; value: number; color?: string; style?: React.CSSProperties}> = ({r, value, color = T.accent, style}) => {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div style={{...box(r), borderRadius: 999, background: D.track, overflow: 'hidden', ...style}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: v * r.w, minWidth: v > 0 ? r.h : 0, borderRadius: 999, background: color, opacity: lerp(v, [0, 0.02], [0, 1])}} />
    </div>
  );
};

// ───────────────────────────── a done disc ─────────────────────────────

/** A disc with a check drawn on by `t` (0..1): "done". The ring is empty at t = 0. */
export const Done: React.FC<{size: number; t: number; tone?: Tone}> = ({size, t, tone = 'accent'}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: alpha(T[tone], lerp(t, [0, 0.3], [0, 1])),
      boxShadow: `inset 0 0 0 ${Math.max(3, size * 0.06)}px ${t > 0.15 ? T[tone] : D.line}`,
      scale: `${lerp(t, [0, 0.4, 1], [1, 1.12, 1])}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Draw d={CHECK} t={lerp(t, [0.25, 1], [0, 1])} w={size * 0.9} h={size * 0.9} vb="0 0 1 1" stroke={onTone(tone)} sw={0.12} />
  </div>
);

// ───────────────────────────── list row ─────────────────────────────

/** A list row: an icon, a title over a quieter line, and something on the right (a Done, a Label, a Stat). */
export const Row: React.FC<{icon?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; size?: number; style?: React.CSSProperties}> = ({icon, title, sub, right, size = 44, style}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: size * 0.6, fontFamily: F.text, ...style}}>
    {icon}
    <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: size * 0.12}}>
      <div style={{fontWeight: 700, fontSize: size, color: T.ink, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>{title}</div>
      {sub && <div style={{fontWeight: 500, fontSize: Math.max(32, size * 0.75), color: T.muted, letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>{sub}</div>}
    </div>
    {right}
  </div>
);

// ───────────────────────────── device frame ─────────────────────────────

/** A phone at a rectangle, holding a screenshot (`image`), a screen recording (`video`, muted, playing from the
 * enclosing Scene's start) or drawn children. Paths are relative to public/, where scripts/sync-assets.mjs copies
 * them from two folders of the account:
 *   brand/<slug>/media/   the brand's own screenshots and recordings, for every film  →  image="brand/media/<file>"
 *   films/<film>/media/   this film's                                                  →  video="media/<film>/<file>"
 * The screen is cropped to cover. Keep the rectangle about 9:19.5. */
export const Device: React.FC<{r: R; image?: string; video?: string; children?: React.ReactNode; style?: React.CSSProperties}> = ({r, image, video, children, style}) => {
  const bezel = r.w * 0.035;
  const radius = r.w * 0.14;
  return (
    <div style={{...box(r), borderRadius: radius, background: D.deep, boxShadow: `inset 0 0 0 3px ${D.line}, ${D.shadow}`, ...style}}>
      <div style={{position: 'absolute', inset: bezel, borderRadius: radius - bezel, overflow: 'hidden', background: T.canvas}}>
        {image && <Img src={staticFile(image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
        {video && <Video src={staticFile(video)} muted objectFit="cover" style={{width: '100%', height: '100%'}} />}
        {children}
      </div>
      <div style={{position: 'absolute', top: bezel + r.w * 0.03, left: '50%', width: r.w * 0.28, height: r.w * 0.075, translate: '-50% 0', borderRadius: 999, background: D.deep}} />
    </div>
  );
};

// ───────────────────────────── the safe area, for checking stills ─────────────────────────────

/** The bands the platforms draw their own interface over (the top 14 % above L.top, the bottom 35 % below L.bottom)
 * tinted, and the side margins (6 % each side) dashed: nothing a viewer must read goes outside the dashed box.
 * Root.tsx draws it over a film rendered with the input prop `safe: true`: `npm run still -- <Id> --frame=<n> --safe`.
 * Never part of a film. */
export const SafeArea: React.FC = () => {
  const band: React.CSSProperties = {position: 'absolute', left: 0, right: 0, background: alpha(T.danger, 0.3)};
  const edge = `4px dashed ${T.danger}`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{...band, top: 0, height: L.top, borderBottom: edge}} />
      <div style={{...band, top: L.bottom, bottom: 0, borderTop: edge}} />
      <div style={{position: 'absolute', top: L.top, height: L.bottom - L.top, left: 0, width: L.left, background: alpha(T.danger, 0.18)}} />
      <div style={{position: 'absolute', top: L.top, height: L.bottom - L.top, left: L.right, right: 0, background: alpha(T.danger, 0.18)}} />
      <div style={{position: 'absolute', top: L.top, height: L.bottom - L.top, left: L.left, width: L.right - L.left, borderLeft: edge, borderRight: edge}} />
    </AbsoluteFill>
  );
};

export {Odo};
