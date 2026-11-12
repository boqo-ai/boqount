import React from 'react';
import {D, T} from '../lib/theme';

/** A pointer cursor in the ink, outlined in the canvas; (x, y) is its tip. `press` 0..1 shrinks it for a click.
 * Move it at a person's speed (about half a second across the frame) on a curve(), never in a straight line. */
export const Cursor: React.FC<{x: number; y: number; press?: number; opacity?: number; size?: number}> = ({x, y, press = 0, opacity = 1, size = 64}) => (
  <svg
    width={size}
    height={size * 1.25}
    viewBox="0 0 40 50"
    style={{position: 'absolute', left: x - size * 0.1, top: y - size * 0.075, scale: `${1 - press * 0.14}`, transformOrigin: '10% 6%', opacity, filter: D.drop, overflow: 'visible'}}
  >
    <path d="M 4 3 L 4 40 Q 4 42 6 40.5 L 14 33 L 20 46 Q 21 48 23 47 L 27 45 Q 29 44 28 42 L 22 29.5 L 33 29.5 Q 35.5 29.5 34 27.5 L 6 1.5 Q 4 0 4 3 Z" fill={T.ink} stroke={T.canvas} strokeWidth={3} strokeLinejoin="round" />
  </svg>
);

/** A point on a quadratic curve from a to b, bowed `bow` px to one side, at t (0..1): a hand's path. */
export const curve = (a: [number, number], b: [number, number], bow: number, t: number): [number, number] => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const cx = (a[0] + b[0]) / 2 + (-dy / len) * bow;
  const cy = (a[1] + b[1]) / 2 + (dx / len) * bow;
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]];
};
