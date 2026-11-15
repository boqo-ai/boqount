// The brand's mark as a lit object: its real path, extruded by stacking darker copies behind a lit front face, with a
// specular rim and a glow in its own colour. Drawn in code, so the mark is exact: an image model redraws a logo, this
// never does. A small rotateY turns it in 3D; the side shows on the side it turns away from.
//
// The path is the brand's own: an SVG mark's `d` (one path, or several joined into one), or a PNG logo traced into one
// with `node <skill>/tools/trace-png.mjs <logo.png> --json <film>/mark.json` and imported: `import mark from './mark.json'`
// then `<Logo3D d={mark.d} vw={mark.width} vh={mark.height} … />`.
import React, {useId} from 'react';
import {D, T, Tone, alpha, mixColor} from '../lib/theme';

/** `d`: the mark's path in a vw × vh box. `h`: its height on screen, px; (x, y): its centre. `ry` turns it (deg), `rot`
 * tilts it, `depth` is the extrusion in layers, `glow` 0 → 1, `tone` the colour token it is made of. */
export const Logo3D: React.FC<{d: string; vw: number; vh: number; x: number; y: number; h: number; ry?: number; rot?: number; depth?: number; glow?: number; tone?: Tone; opacity?: number}> = ({
  d,
  vw,
  vh,
  x,
  y,
  h,
  ry = -14,
  rot = 0,
  depth = 18,
  glow = 1,
  tone = 'accent',
  opacity = 1,
}) => {
  const id = `l3${useId().replace(/:/g, '')}`;
  if (opacity <= 0.001 || h <= 1) return null;
  const base = T[tone];
  const w = (h * vw) / vh;
  // one unit of extrusion, in the mark's own units, so a mark of any size gets the same look
  const u = vh / 300;
  // the side shows on the side the mark turns away from
  const dx = (0.5 + Math.sin((-ry * Math.PI) / 180) * 1.6) * u;
  const dy = 0.85 * u;
  // from the colour pushed into the canvas at the back to a darker shade just behind the face
  const back = (k: number) => mixColor(mixColor(base, T.canvas, 0.75), mixColor(base, T.canvas, 0.3), k / depth);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        opacity,
        transform: `perspective(1200px) rotateY(${ry}deg) rotate(${rot}deg)`,
        filter: `drop-shadow(0 0 ${30 * glow}px ${alpha(base, 0.55 * glow)}) ${D.drop}`,
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${vw} ${vh}`} style={{overflow: 'visible', display: 'block'}}>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={mixColor(base, T.ink, 0.6)} />
            <stop offset="0.32" stopColor={mixColor(base, T.ink, 0.2)} />
            <stop offset="0.7" stopColor={base} />
            <stop offset="1" stopColor={mixColor(base, T.canvas, 0.2)} />
          </linearGradient>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={T.ink} stopOpacity="0.85" />
            <stop offset="0.35" stopColor={T.ink} stopOpacity="0" />
          </linearGradient>
        </defs>
        <g>
          {Array.from({length: depth}, (_, k) => (
            <path key={k} d={d} fill={back(k)} fillRule="evenodd" transform={`translate(${(depth - k) * dx} ${(depth - k) * dy})`} />
          ))}
          <path d={d} fill={`url(#${id}f)`} fillRule="evenodd" />
          <path d={d} fill="none" stroke={`url(#${id}s)`} strokeWidth={7 * u} />
        </g>
      </svg>
    </div>
  );
};
