// The starter's drawn things, in frame px: a plant in its pot (four kinds), a drop of water, a tag on a thing, and a
// world's backdrop. Flat shapes with soft shading, from the style tokens alone (lib/theme.ts), so a brand's own
// tokens recolour the film.
import React from 'react';
import {mix} from '../../lib/anim';
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
