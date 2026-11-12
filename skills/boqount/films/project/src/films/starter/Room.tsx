// The room around the plant, in world px, in depth layers for the camera's parallax (World.tsx places them):
//   Outside (z 0.3)  the sky through the window, the low sun's glow, far hills
//   Wall    (z 0.5)  the wall with the window cut out of it, its frame and glazing bars, reflections on the glass
//   Beam    (z 0.8)  the beam of light from the window onto the sill
//   Sill    (z 1)    the sill the pot and the phone stand on, the beam's patch on it, the small second pot
//   Dust    (z 1.25) motes drifting in the beam, in front of everything
// `light` 0..1 is the daylight (it dips for each night while the week passes); `sun` -1..1 swings the beam.
import React, {useId} from 'react';
import {rnd} from '../../lib/anim';
import {D, T, alpha, mixColor} from '../../lib/theme';
import {SILL, SMALL, WINDOW} from './layout';
import {DURATION} from './timeline';

const W = WINDOW;
const FRAME = 26;
const BAR = 16;

export const Outside: React.FC<{light: number}> = ({light}) => {
  const id = useId().replace(/:/g, '');
  const night = 1 - light;
  const sky0 = mixColor(mixColor(T.canvas, T.accent2, 0.06), D.deep, night * 0.8);
  const sky1 = mixColor(mixColor(T.canvas, T.accent2, 0.34), D.deep, night * 0.75);
  const hill = mixColor(T.canvas, D.deep, 0.35);
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky0} />
          <stop offset="1" stopColor={sky1} />
        </linearGradient>
        <radialGradient id={`sun${id}`}>
          <stop offset="0" stopColor={alpha(mixColor(T.accent2, T.ink, 0.3), 0.75 * light)} />
          <stop offset="0.25" stopColor={alpha(T.accent2, 0.4 * light)} />
          <stop offset="1" stopColor={alpha(T.accent2, 0)} />
        </radialGradient>
      </defs>
      <rect x={-200} y={0} width={1500} height={1500} fill={`url(#sky${id})`} />
      <circle cx={250} cy={1120} r={520} fill={`url(#sun${id})`} />
      <path d="M -200 1230 C 100 1150 260 1190 470 1160 C 680 1130 860 1200 1300 1150 L 1300 1500 L -200 1500 Z" fill={mixColor(hill, T.accent2, 0.06 * light)} />
      <path d="M -200 1300 C 150 1260 420 1290 650 1255 C 880 1225 1050 1270 1300 1250 L 1300 1500 L -200 1500 Z" fill={mixColor(hill, D.deep, 0.4)} />
    </svg>
  );
};

/** The wall with the window cut out of it, the frame, the glazing bars and the glass's reflections. */
export const Wall: React.FC<{light: number}> = ({light}) => {
  const id = useId().replace(/:/g, '');
  const frame = mixColor(T.panel, T.ink, 0.07);
  const inner = {x: W.x + FRAME, y: W.y + FRAME, w: W.w - 2 * FRAME, h: W.h - 2 * FRAME};
  const cols = [inner.x + inner.w / 2 - BAR / 2];
  const rows = [inner.y + inner.h / 3 - BAR / 2, inner.y + (2 * inner.h) / 3 - BAR / 2];
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        <radialGradient id={`glow${id}`}>
          <stop offset="0" stopColor={alpha(T.accent2, 0.07 * light)} />
          <stop offset="1" stopColor={alpha(T.accent2, 0)} />
        </radialGradient>
      </defs>
      <path d={`M -900 -900 H 2000 V 2900 H -900 Z M ${W.x} ${W.y} V ${W.y + W.h} H ${W.x + W.w} V ${W.y} Z`} fill={T.canvas} fillRule="evenodd" />
      <ellipse cx={W.x + W.w / 2} cy={W.y + W.h * 0.7} rx={W.w * 0.95} ry={W.h * 0.7} fill={`url(#glow${id})`} />
      {/* the frame, its inner shadow, the glazing bars */}
      <path d={`M ${W.x} ${W.y} H ${W.x + W.w} V ${W.y + W.h} H ${W.x} Z M ${inner.x} ${inner.y} V ${inner.y + inner.h} H ${inner.x + inner.w} V ${inner.y} Z`} fill={frame} fillRule="evenodd" />
      <rect x={inner.x} y={inner.y} width={inner.w} height={10} fill={alpha(D.deep, 0.5)} />
      {cols.map((x) => (
        <rect key={x} x={x} y={inner.y} width={BAR} height={inner.h} fill={frame} />
      ))}
      {rows.map((y) => (
        <rect key={y} x={inner.x} y={y} width={inner.w} height={BAR} fill={frame} />
      ))}
      {/* reflections on the glass */}
      {[0, 1].map((k) => (
        <path key={k} d={`M ${inner.x + 120 + k * 430} ${inner.y + 40} L ${inner.x + 260 + k * 430} ${inner.y + 40} L ${inner.x + 40 + k * 430} ${inner.y + 520} L ${inner.x - 100 + k * 430} ${inner.y + 520} Z`} fill={alpha(T.ink, 0.035)} />
      ))}
    </svg>
  );
};

/** The beam from the window to the sill; `sun` swings it with the day. */
export const Beam: React.FC<{light: number; sun: number}> = ({light, sun}) => {
  const id = useId().replace(/:/g, '');
  const top = sun * 60;
  const foot = sun * -160;
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        <linearGradient id={`beam${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={alpha(T.accent2, 0.15 * light)} />
          <stop offset="1" stopColor={alpha(T.accent2, 0.03 * light)} />
        </linearGradient>
      </defs>
      <path d={`M ${190 + top} ${560} L ${540 + top} ${470} L ${1120 + foot} ${SILL} L ${560 + foot} ${SILL} Z`} fill={`url(#beam${id})`} />
    </svg>
  );
};

/** The sill, the beam's patch of light on it, and the small second pot (a round cactus with one bud). */
export const Sill: React.FC<{light: number; sun: number}> = ({light, sun}) => {
  const top = mixColor(T.panel, T.ink, 0.13);
  const face = mixColor(T.panel, T.canvas, 0.2);
  const clay = mixColor(mixColor(T.accent2, T.danger, 0.35), T.canvas, 0.38);
  const cactus = mixColor(T.accent, T.canvas, 0.42);
  const {cx, w, h} = SMALL;
  const ct = SILL - h;
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <rect x={-900} y={SILL - 2} width={2900} height={22} fill={top} />
      <rect x={-900} y={SILL - 2} width={2900} height={3} fill={mixColor(top, T.ink, 0.25)} />
      <rect x={-900} y={SILL + 20} width={2900} height={110} fill={face} />
      <rect x={-900} y={SILL + 20} width={2900} height={8} fill={alpha(D.deep, 0.5)} />
      <rect x={-900} y={SILL + 130} width={2900} height={1400} fill={mixColor(T.canvas, D.deep, 0.5)} />
      <ellipse cx={850 - sun * 160} cy={SILL + 8} rx={300} ry={12} fill={alpha(T.accent2, 0.2 * light)} />
      {/* the small pot */}
      <ellipse cx={cx + 16} cy={SILL + 3} rx={w * 0.62} ry={9} fill={alpha(D.deep, 0.8)} />
      <path d={`M ${cx - w / 2} ${ct + 18} L ${cx + w / 2} ${ct + 18} L ${cx + w * 0.38} ${SILL} L ${cx - w * 0.38} ${SILL} Z`} fill={clay} />
      <ellipse cx={cx} cy={ct - 30} rx={44} ry={64} fill={cactus} />
      {[-24, 0, 24].map((dx) => (
        <path key={dx} d={`M ${cx + dx * 0.6} ${ct - 90} Q ${cx + dx * 1.3} ${ct - 30} ${cx + dx * 0.7} ${ct + 22}`} fill="none" stroke={mixColor(cactus, T.canvas, 0.3)} strokeWidth={3} />
      ))}
      {Array.from({length: 14}, (_, k) => (
        <circle key={k} cx={cx + rnd(`sp${k}`, -34, 34)} cy={ct - 30 + rnd(`sq${k}`, -52, 40)} r={1.8} fill={alpha(T.ink, 0.55)} />
      ))}
      <circle cx={cx + 8} cy={ct - 94} r={9} fill={mixColor(T.accent2, T.danger, 0.3)} />
      <rect x={cx - w / 2 - 6} y={ct + 4} width={w + 12} height={22} rx={6} fill={mixColor(clay, T.ink, 0.1)} />
    </svg>
  );
};

/** Dust in the beam: each mote drifts on a slow closed path (whole cycles per film, so the loop is exact) and
 * glints as it turns. */
const MOTES = Array.from({length: 30}, (_, k) => {
  const t = rnd(`mt${k}`, 0.05, 0.95);
  const side = rnd(`ms${k}`, -0.4, 0.4);
  return {
    x: 360 + t * 480 + side * 300,
    y: 520 + t * 860,
    r: rnd(`mr${k}`, 2.2, 5),
    ax: rnd(`max${k}`, 20, 50),
    ay: rnd(`may${k}`, 30, 70),
    kx: 1 + Math.floor(rnd(`mkx${k}`, 0, 2)),
    ky: 1 + Math.floor(rnd(`mky${k}`, 0, 2)),
    ph: rnd(`mp${k}`, 0, Math.PI * 2),
    tw: 3 + Math.floor(rnd(`mw${k}`, 0, 5)),
  };
});

export const Dust: React.FC<{g: number; light: number; sun: number}> = ({g, light, sun}) => {
  const u = (Math.PI * 2 * g) / DURATION;
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      {MOTES.map((m, k) => {
        const tw = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(u * m.tw + m.ph), 3);
        return (
          <circle
            key={k}
            cx={m.x + Math.sin(u * m.kx + m.ph) * m.ax - sun * 80 * ((m.y - 500) / 900)}
            cy={m.y + Math.sin(u * m.ky + m.ph * 1.7) * m.ay}
            r={m.r}
            fill={mixColor(T.ink, T.accent2, 0.35)}
            opacity={0.55 * tw * light}
          />
        );
      })}
    </svg>
  );
};
