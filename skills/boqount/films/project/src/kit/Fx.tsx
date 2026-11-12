// Effects: the odometer counter, stroke-drawn marks, the slam landing, motion blur along one axis, the film's one
// particle burst, and the full-frame hit. Every value is a pure function of the frame.
// A film has at most three full-frame hits (Hit), each on its strongest beat, and at most one Burst.
import React, {useId} from 'react';
import {EXPO, lerp, mix, p, rnd} from '../lib/anim';
import {useF} from '../lib/scene';
import {F, L, T, Tone, alpha} from '../lib/theme';

// ───────────────────────────── odometer ─────────────────────────────

const Reel: React.FC<{pos: number; h: number; color: string}> = ({pos, h, color}) => {
  const m = ((pos % 10) + 10) % 10;
  return (
    <span style={{display: 'inline-block', position: 'relative', height: h, overflow: 'hidden', verticalAlign: 'top'}}>
      <span style={{display: 'flex', flexDirection: 'column', translate: `0 ${-m * h}px`}}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, i) => (
          <span key={i} style={{height: h, lineHeight: `${h}px`, color}}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
};

/** A mechanical counter for every number on screen (never a plain interpolated number). Feed it a value that moves
 * through the frames: the units roll over the last 30 % of each step, and each higher place rolls only while the
 * place below it carries. Places above the leading digit are hidden; a comma every three places. */
export const Odo: React.FC<{value: number; size: number; color?: string; prefix?: string; suffix?: string; minPlaces?: number; weight?: number; style?: React.CSSProperties}> = ({
  value,
  size,
  color = T.ink,
  prefix,
  suffix,
  minPlaces = 1,
  weight = 700,
  style,
}) => {
  const v = Math.max(0, value);
  const h = Math.round(size * 1.12);
  const places = Math.max(minPlaces, Math.floor(Math.log10(Math.max(1, v))) + 1);
  const sm = (x: number) => {
    const c = Math.min(1, Math.max(0, x));
    return c * c * (3 - 2 * c);
  };
  const carry: number[] = [];
  for (let k = 0; k < places; k++) {
    if (k === 0) carry.push(sm((v - Math.floor(v) - 0.7) / 0.3));
    else carry.push(Math.floor(v / 10 ** (k - 1)) % 10 === 9 ? carry[k - 1] : 0);
  }
  const cells: React.ReactNode[] = [];
  for (let k = places - 1; k >= 0; k--) {
    cells.push(<Reel key={k} pos={Math.floor(v / 10 ** k) + carry[k]} h={h} color={color} />);
    if (k > 0 && k % 3 === 0)
      cells.push(
        <span key={`s${k}`} style={{display: 'inline-block', height: h, lineHeight: `${h}px`}}>
          ,
        </span>,
      );
  }
  return (
    <span style={{display: 'inline-flex', fontFamily: F.display, fontWeight: weight, fontSize: size, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color, whiteSpace: 'nowrap', ...style}}>
      {prefix && <span style={{height: h, lineHeight: `${h}px`}}>{prefix}</span>}
      {cells}
      {suffix && <span style={{height: h, lineHeight: `${h}px`, marginLeft: '0.18em'}}>{suffix}</span>}
    </span>
  );
};

// ───────────────────────────── stroke-drawn marks ─────────────────────────────

/** A check mark in a 0..1 box, for Draw with vb="0 0 1 1". */
export const CHECK = 'M 0.24 0.53 L 0.43 0.71 L 0.77 0.33';

/** An SVG path drawn on by `t` (0..1): underlines, checks, arrows, circles round a word. */
export const Draw: React.FC<{d: string; t: number; w: number; h: number; vb?: string; stroke?: string; sw?: number; fill?: string; style?: React.CSSProperties}> = ({
  d,
  t,
  w,
  h,
  vb,
  stroke = T.ink,
  sw = 6,
  fill = 'none',
  style,
}) => (
  <svg width={w} height={h} viewBox={vb ?? `0 0 ${w} ${h}`} style={{overflow: 'visible', display: 'block', ...style}}>
    <path d={d} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${Math.max(0.0001, t)} 2`} opacity={t > 0 ? 1 : 0} />
  </svg>
);

// ───────────────────────────── landings ─────────────────────────────

/** A slam: a fall into place with no overshoot and a two-frame squash at contact. Returns [dy px, scaleY]. */
export const slam = (f: number, at: number, dist = 120, dur = 10): [number, number] => {
  const t = p(f, at, dur, (x) => x * x);
  const squash = lerp(f, [at + dur, at + dur + 2, at + dur + 8], [0, 0.06, 0], [EXPO, EXPO]);
  return [(1 - t) * -dist, 1 - squash];
};

// ───────────────────────────── motion blur along one axis ─────────────────────────────

/** Blur along the axis of motion only, for whips and fast moves. Off below a third of a pixel. */
export const DirBlur: React.FC<{x?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({x = 0, y = 0, children, style}) => {
  const id = `mb${useId().replace(/:/g, '')}`;
  const on = x > 0.3 || y > 0.3;
  return (
    <>
      {on && (
        <svg width={0} height={0} style={{position: 'absolute'}}>
          <filter id={id} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${x.toFixed(2)} ${y.toFixed(2)}`} />
          </filter>
        </svg>
      )}
      <div style={{position: 'absolute', inset: 0, filter: on ? `url(#${id})` : undefined, ...style}}>{children}</div>
    </>
  );
};

/** Speed of a motion curve at frame f, px per frame: feed it to DirBlur so blur follows the real velocity. */
export const speed = (fn: (f: number) => number, f: number) => Math.abs(fn(f) - fn(f - 1));

// ───────────────────────────── the one burst ─────────────────────────────

/** One seeded burst from (x, y): pieces fly out along `dir` (degrees, -90 is up) ± `spread`, then fall.
 * Once per film, aimed clear of any number the viewer is meant to read. Lasts `life` frames. */
export const Burst: React.FC<{x: number; y: number; at: number; seed: string; n?: number; dir?: number; spread?: number; power?: number; size?: number; life?: number; tones?: Tone[]}> = ({
  x,
  y,
  at,
  seed,
  n = 36,
  dir = -90,
  spread = 70,
  power = 1,
  size = 22,
  life = 80,
  tones = ['accent', 'accent2', 'ink'],
}) => {
  const f = useF();
  const t = f - at;
  if (t < 0 || t > life) return null;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {Array.from({length: n}, (_, i) => {
        const a = ((dir + rnd(`${seed}a${i}`, -spread, spread)) * Math.PI) / 180;
        const v = rnd(`${seed}v${i}`, 14, 34) * power;
        const drag = 1 - Math.exp(-t / 14);
        const px = x + Math.cos(a) * v * 14 * drag;
        const py = y + Math.sin(a) * v * 14 * drag + 0.035 * t * t * rnd(`${seed}g${i}`, 0.6, 1.2);
        const w = size * rnd(`${seed}w${i}`, 0.6, 1.3);
        const spin = rnd(`${seed}s${i}`, -12, 12) * t;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px - w / 2,
              top: py - w / 2,
              width: w,
              height: w * rnd(`${seed}h${i}`, 0.4, 0.7),
              background: T[tones[i % tones.length]],
              borderRadius: w * 0.2,
              rotate: `${spin}deg`,
              scale: `1 ${Math.cos((spin * Math.PI) / 90)}`,
              opacity: lerp(t, [0, 2, life * 0.7, life], [0, 1, 1, 0]),
            }}
          />
        );
      })}
    </div>
  );
};

// ───────────────────────────── the full-frame hit ─────────────────────────────

/** A full-frame hit at frame `at`: a vignette in `tone` that swells and fades, and a ring that runs out from
 * (x, y). Pair it with `shake()` on the stage for a loss, without for a win. At most three per film. */
export const Hit: React.FC<{at: number; tone: Tone; x?: number; y?: number; strength?: number; ring?: boolean}> = ({at, tone, x = L.W / 2, y = L.H / 2, strength = 1, ring = true}) => {
  const f = useF();
  const t = f - at;
  if (t < 0 || t > 50) return null;
  const v = lerp(t, [0, 4, 50], [0, 0.34 * strength, 0]);
  const r = mix(0, 1500, p(t, 0, 40));
  const ringOp = lerp(t, [0, 3, 40], [0, 0.55 * strength, 0]);
  const c = T[tone];
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 75% 60% at 50% 50%, ${alpha(c, 0)} 40%, ${alpha(c, v)} 100%)`}} />
      {ring && <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: 9999, boxShadow: `inset 0 0 0 ${mix(18, 4, p(t, 0, 40))}px ${alpha(c, ringOp)}`}} />}
    </div>
  );
};
