// The starter's drawn things, in frame px: a plant in its pot (four kinds), a drop of water, a tag on a thing, and a
// world's backdrop. Flat shapes with soft shading, from the style tokens alone (lib/theme.ts), so a brand's own
// tokens recolour the film.
import React from 'react';
import {mix} from '../../lib/anim';
import {useF} from '../../lib/scene';
import {D, F, T, alpha, mixColor} from '../../lib/theme';

export type Kind = 'leafy' | 'fern' | 'cactus' | 'snake';

/** Terracotta: the pot, from the style's loss colour toward its panel. */
export const CLAY = mixColor(T.danger, T.panel, 0.42);
/** A leaf as it dries, 0 healthy (the accent) .. 1 dry (toward the loss colour, dulled). */
export const leafColor = (dry: number) => mixColor(T.accent, mixColor(T.danger, T.muted, 0.35), Math.min(1, dry));
/** Water. */
export const WATER = mixColor(T.accent, T.ink, 0.35);

const LEAFY = [-58, -28, 0, 28, 58];
const FERN = [-70, -48, -26, -8, 8, 26, 48, 70];
const SNAKE = [-14, -4, 6, 16];

/** A plant in its pot. Its pot's bottom centre stands at (x, y); `s` scales the whole (1: the pot is 120 px wide).
 * `dry` 0..1 hangs and browns the leaves; `water` 0..1 fills the saucer under the pot (too much water). */
export const Pot: React.FC<{x: number; y: number; s?: number; kind?: Kind; dry?: number; water?: number; style?: React.CSSProperties}> = ({x, y, s = 1, kind = 'leafy', dry = 0, water = 0, style}) => {
  const W = 200;
  const H = 320;
  const leaf = leafColor(dry);
  const dark = mixColor(leaf, '#000000', 0.25);
  return (
    <svg width={W * s} height={H * s} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', left: x - (W * s) / 2, top: y - H * s, overflow: 'visible', ...style}}>
      {/* the saucer, and water standing in it */}
      <ellipse cx={100} cy={312} rx={78} ry={9} fill={mixColor(CLAY, '#000000', 0.25)} />
      {water > 0 && <ellipse cx={100} cy={311} rx={mix(30, 92, water)} ry={mix(4, 11, water)} fill={alpha(WATER, 0.75)} />}
      {/* the plant */}
      {kind === 'leafy' &&
        LEAFY.map((a, i) => {
          const len = 118 - Math.abs(a) * 0.5;
          const ang = a + Math.sign(a || 1) * dry * (62 + i * 4);
          return (
            <g key={i} transform={`rotate(${ang} 100 214)`}>
              <line x1={100} y1={214} x2={100} y2={214 - len * 0.5} stroke={dark} strokeWidth={5} strokeLinecap="round" />
              <ellipse cx={100} cy={214 - len * 0.62} rx={22 * (1 - 0.25 * dry)} ry={len * 0.42} fill={leaf} />
              <line x1={100} y1={214 - len * 0.3} x2={100} y2={214 - len * 0.95} stroke={dark} strokeWidth={2.5} />
            </g>
          );
        })}
      {kind === 'fern' &&
        FERN.map((a, i) => {
          const len = 150 - Math.abs(a) * 0.6;
          const ang = a + Math.sign(a || 1) * dry * 55;
          return (
            <g key={i} transform={`rotate(${ang} 100 214)`}>
              <path d={`M 100 214 Q ${100 + 18 * dry} ${214 - len * 0.6} ${100 + 30 * dry} ${214 - len}`} stroke={dark} strokeWidth={3} fill="none" />
              {Array.from({length: 7}, (_, k) => {
                const t = 0.25 + k * 0.1;
                const cx = 100 + 30 * dry * t * t;
                const cy = 214 - len * t;
                const l = 26 * (1 - t * 0.6);
                return <ellipse key={k} cx={cx} cy={cy} rx={l} ry={6} fill={leaf} transform={`rotate(${k % 2 ? 22 : -22} ${cx} ${cy})`} />;
              })}
            </g>
          );
        })}
      {kind === 'snake' &&
        SNAKE.map((a, i) => {
          const len = 170 - Math.abs(a) * 3;
          return (
            <g key={i} transform={`rotate(${a + Math.sign(a || 1) * dry * 30} 100 214)`}>
              <path d={`M ${86} 214 Q 88 ${214 - len * 0.6} 100 ${214 - len} Q 112 ${214 - len * 0.6} 114 214 Z`} fill={i % 2 ? leaf : dark} />
              <path d={`M 100 ${214 - len * 0.1} L 100 ${214 - len * 0.85}`} stroke={alpha(T.ink, 0.25)} strokeWidth={2} />
            </g>
          );
        })}
      {kind === 'cactus' && (
        <g>
          <rect x={78} y={70} width={44} height={150} rx={22} fill={leaf} />
          <path d="M 80 150 Q 50 150 50 120 L 50 100" stroke={leaf} strokeWidth={22} strokeLinecap="round" fill="none" />
          <path d="M 120 128 Q 148 128 148 100 L 148 86" stroke={leaf} strokeWidth={22} strokeLinecap="round" fill="none" />
          {[0, 1, 2, 3, 4].map((k) => (
            <line key={k} x1={100} y1={86 + k * 26} x2={100} y2={98 + k * 26} stroke={dark} strokeWidth={3} strokeLinecap="round" />
          ))}
        </g>
      )}
      {/* the pot: a rim over a tapered body, lit from the left */}
      <path d="M 40 222 L 160 222 L 146 308 Q 145 312 140 312 L 60 312 Q 55 312 54 308 Z" fill={CLAY} />
      <path d="M 40 222 L 70 222 L 66 312 L 60 312 Q 55 312 54 308 Z" fill={alpha(T.ink, 0.08)} />
      <rect x={32} y={204} width={136} height={26} rx={8} fill={mixColor(CLAY, T.ink, 0.1)} />
      <ellipse cx={100} cy={208} rx={62} ry={7} fill={mixColor(T.canvas, CLAY, 0.35 + 0.3 * dry)} />
    </svg>
  );
};

/** A drop of water, its centre at (x, y), `size` wide. */
export const Drop: React.FC<{x: number; y: number; size: number; color?: string; style?: React.CSSProperties}> = ({x, y, size, color = WATER, style}) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 20 26" style={{position: 'absolute', left: x - size / 2, top: y - size * 0.75, overflow: 'visible', ...style}}>
    <path d="M 10 0 C 13 6 19 11 19 17 A 9 9 0 0 1 1 17 C 1 11 7 6 10 0 Z" fill={color} />
    <ellipse cx={7} cy={16} rx={2.2} ry={3.4} fill={alpha(T.ink, 0.55)} />
  </svg>
);

/** A small label standing on a thing: a pill in the panel colour, its text at least 36 px. Centred on x. */
export const Tag: React.FC<{x: number; y: number; children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties}> = ({x, y, children, color = T.ink, size = 36, style}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      translate: '-50% 0',
      height: Math.round(size * 1.6),
      padding: `0 ${Math.round(size * 0.55)}px`,
      borderRadius: 999,
      background: D.raised,
      boxShadow: `inset 0 0 0 2px ${D.line}`,
      display: 'flex',
      alignItems: 'center',
      gap: size * 0.3,
      fontFamily: F.text,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: '-0.015em',
      color,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </div>
);

/** A world's backdrop: the canvas lit by its own two colours, one glowing high, one low. */
export const Backdrop: React.FC<{a: string; b: string; hi?: number; lo?: number}> = ({a, b, hi = 0.22, lo = 0.16}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(90% 45% at 50% 22%, ${alpha(a, hi)}, ${alpha(a, 0)} 70%), radial-gradient(110% 40% at 50% 92%, ${alpha(b, lo)}, ${alpha(b, 0)} 70%), ${T.canvas}`,
    }}
  />
);

/** A shelf or sill board across the frame at y, from x0 to x1. */
export const Board: React.FC<{y: number; x0?: number; x1?: number}> = ({y, x0 = 20, x1 = 1060}) => (
  <div style={{position: 'absolute', left: x0, top: y, width: x1 - x0, height: 26, borderRadius: 8, background: mixColor(T.panel, T.ink, 0.06), boxShadow: `0 18px 30px ${alpha('#000000', 0.35)}`}} />
);

// ───────────── the room: what fills the frame under the caption band ─────────────
// The picture uses the whole height: a surface the world stands on, big leaves in the foreground, light in the air.
// None of it is text, so it may run behind the caption band (whose plate keeps the words readable) and through the
// bottom 35 % that the feeds cover with their own buttons and captions.

/** A tabletop or sill seen from a little above: a lit top face `depth` px deep at y, then its front face to the frame's
 * bottom. Inside a Camera it moves with the world. */
export const Surface: React.FC<{y: number; depth?: number; tone?: string}> = ({y, depth = 90, tone = mixColor(T.panel, T.accent2, 0.12)}) => (
  <>
    <div style={{position: 'absolute', left: -400, width: 1880, top: y, height: depth, background: `linear-gradient(to bottom, ${mixColor(tone, T.ink, 0.1)}, ${tone})`, boxShadow: `inset 0 3px 0 ${alpha(T.ink, 0.12)}`}} />
    <div style={{position: 'absolute', left: -400, width: 1880, top: y + depth, height: 2400, background: `linear-gradient(to bottom, ${mixColor(tone, '#000000', 0.35)}, ${mixColor(T.canvas, '#000000', 0.3)} 700px)`}} />
    {/* the light pooled on the top face */}
    <div style={{position: 'absolute', left: 140, width: 800, top: y - 40, height: depth + 120, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(T.accent2, 0.16)}, ${alpha(T.accent2, 0)})`}} />
  </>
);

type Leaf = {x: number; a: number; len: number; w: number; ph: number; shade: number};
const LEAVES: Leaf[] = [
  {x: -70, a: 30, len: 560, w: 116, ph: 0.0, shade: 0.72},
  {x: 10, a: 12, len: 430, w: 96, ph: 1.3, shade: 0.62},
  {x: 90, a: 46, len: 330, w: 80, ph: 2.1, shade: 0.78},
  {x: 1150, a: -32, len: 580, w: 120, ph: 0.7, shade: 0.7},
  {x: 1070, a: -12, len: 420, w: 94, ph: 2.6, shade: 0.6},
  {x: 990, a: -48, len: 320, w: 78, ph: 1.8, shade: 0.78},
];

/** Big leaves rising from under the frame's bottom corners, close to the lens: dark, a little soft, swaying slowly. They
 * frame the world and give the bottom of the frame a picture without covering the middle. `drift` (px) moves them
 * sideways with the camera (a near layer moves more). */
export const Foliage: React.FC<{dry?: number; drift?: number; reach?: number}> = ({dry = 0, drift = 0, reach = 1}) => {
  const f = useF();
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', filter: 'blur(3px)', pointerEvents: 'none'}}>
      {LEAVES.map((l, i) => {
        const sway = Math.sin((f / 120) * Math.PI * 0.42 + l.ph) * 3.2 + Math.sin((f / 120) * Math.PI * 0.17 + l.ph * 2) * 1.6;
        const col = mixColor(leafColor(dry), T.canvas, l.shade);
        const len = l.len * reach;
        return (
          <svg key={i} width={l.w * 2} height={len + 40} viewBox={`${-l.w} ${-len} ${l.w * 2} ${len + 40}`} style={{position: 'absolute', left: l.x - l.w + drift * (i % 2 ? 1.1 : 0.9), top: 1940 - len, overflow: 'visible', transformOrigin: '50% 100%', rotate: `${l.a + sway}deg`}}>
            <path d={`M 0 30 C ${-l.w} ${-len * 0.25}, ${-l.w * 0.7} ${-len * 0.8}, 0 ${-len} C ${l.w * 0.7} ${-len * 0.8}, ${l.w} ${-len * 0.25}, 0 30 Z`} fill={col} />
            <path d={`M 0 30 Q ${l.w * 0.08} ${-len * 0.5} 0 ${-len * 0.96}`} stroke={mixColor(col, '#000000', 0.3)} strokeWidth={6} fill="none" />
          </svg>
        );
      })}
    </div>
  );
};

/** Dust in the light: small motes drifting up and sideways, each on its own slow path. Something always moves. */
export const Motes: React.FC<{n?: number; color?: string; top?: number; bottom?: number}> = ({n = 22, color = T.accent2, top = 200, bottom = 1700}) => {
  const f = useF();
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const s = (f / 120) * (8 + (i % 5) * 3);
        const h = bottom - top;
        const y = bottom - ((s * 6 + i * 157) % h);
        const x = ((i * 389) % 1000) + 40 + Math.sin(f / 120 + i) * 30;
        const r = 2 + (i % 3) * 1.6;
        const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(f / 50 + i * 1.7));
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: r * 2, height: r * 2, borderRadius: 99, background: alpha(color, tw), boxShadow: `0 0 ${r * 4}px ${alpha(color, tw * 0.6)}`}} />;
      })}
    </>
  );
};

/** A watering can standing on a surface, its base's centre at (x, y); `s` scales it (1: about 300 px wide). */
export const Can: React.FC<{x: number; y: number; s?: number; tilt?: number; style?: React.CSSProperties}> = ({x, y, s = 1, tilt = 0, style}) => {
  const body = mixColor(T.accent, T.panel, 0.35);
  return (
    <svg width={320 * s} height={240 * s} viewBox="0 0 320 240" style={{position: 'absolute', left: x - 160 * s, top: y - 240 * s, overflow: 'visible', rotate: `${tilt}deg`, transformOrigin: '50% 100%', ...style}}>
      <path d="M 110 70 Q 160 10 210 70" stroke={mixColor(body, '#000000', 0.25)} strokeWidth={16} fill="none" strokeLinecap="round" />
      <path d="M 210 150 L 300 70 L 312 82 L 226 178 Z" fill={mixColor(body, '#000000', 0.15)} />
      <ellipse cx={306} cy={74} rx={14} ry={9} fill={mixColor(body, T.ink, 0.2)} transform="rotate(-42 306 74)" />
      <rect x={70} y={70} width={160} height={170} rx={28} fill={body} />
      <rect x={70} y={70} width={44} height={170} rx={22} fill={alpha(T.ink, 0.1)} />
      <rect x={70} y={96} width={160} height={14} fill={alpha('#000000', 0.12)} />
    </svg>
  );
};

/** A house key lying on a surface, its centre at (x, y). */
export const Key: React.FC<{x: number; y: number; s?: number; rot?: number}> = ({x, y, s = 1, rot = -14}) => {
  const metal = mixColor(T.accent2, T.ink, 0.25);
  return (
    <svg width={220 * s} height={90 * s} viewBox="0 0 220 90" style={{position: 'absolute', left: x - 110 * s, top: y - 45 * s, rotate: `${rot}deg`, overflow: 'visible'}}>
      <circle cx={45} cy={45} r={38} fill={metal} />
      <circle cx={45} cy={45} r={14} fill={T.canvas} />
      <path d="M 80 38 L 210 38 L 210 52 L 196 52 L 196 66 L 182 66 L 182 52 L 168 52 L 168 62 L 156 62 L 156 52 L 80 52 Z" fill={metal} />
    </svg>
  );
};

/** A suitcase on its wheels, its base's centre at (x, y); `s` scales it (1: about 360 px wide). */
export const Suitcase: React.FC<{x: number; y: number; s?: number; style?: React.CSSProperties}> = ({x, y, s = 1, style}) => {
  const shell = mixColor(T.accent2, T.panel, 0.3);
  return (
    <svg width={360 * s} height={560 * s} viewBox="0 0 360 560" style={{position: 'absolute', left: x - 180 * s, top: y - 560 * s, overflow: 'visible', ...style}}>
      <rect x={150} y={0} width={14} height={120} rx={6} fill={mixColor(T.muted, '#000000', 0.2)} />
      <rect x={196} y={0} width={14} height={120} rx={6} fill={mixColor(T.muted, '#000000', 0.2)} />
      <rect x={140} y={0} width={80} height={20} rx={10} fill={T.muted} />
      <rect x={20} y={110} width={320} height={410} rx={42} fill={shell} />
      {[90, 180, 270].map((cx) => (
        <rect key={cx} x={cx - 6} y={130} width={12} height={370} rx={6} fill={alpha('#000000', 0.12)} />
      ))}
      <rect x={20} y={110} width={70} height={410} rx={35} fill={alpha(T.ink, 0.1)} />
      <circle cx={80} cy={536} r={22} fill={mixColor(T.canvas, '#000000', 0.2)} />
      <circle cx={280} cy={536} r={22} fill={mixColor(T.canvas, '#000000', 0.2)} />
    </svg>
  );
};
