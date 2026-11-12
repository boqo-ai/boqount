// The plant in its pot, drawn in world px from story time g alone: the soil (grains, the cracks of a dry week, the wet
// patch spreading from where the water lands, its ripples and splash), the five leaves (they hang and yellow as the
// soil dries, one shivers and falls, they lift one by one after watering, a new one unfurls, beads of water on them),
// the pot in its saucer, lit from the window on its left.
import React, {useId} from 'react';
import {lerp, mix, p, rnd} from '../../lib/anim';
import {D, T, alpha, mixColor} from '../../lib/theme';
import {FALLER, IMPACT, LEAVES, POT, PX, RIM, S, SILL, SOIL, SOIL_E} from './layout';
import {DRIP, FALL, LAND, beads, cracks, droop, fallT, growT, moisture, shiver, wetSpread} from './timeline';

const rad = (deg: number) => (deg * Math.PI) / 180;
const dir = (deg: number): [number, number] => [Math.sin(rad(deg)), -Math.cos(rad(deg))];

/** Leaf i's shape for a droop d (0 upright .. 1 wilted) and growth (0 a bud .. 1 grown): the stem's curve and the
 * blade's base point, angle and size. The stem bends outward and the blade hangs as it wilts. */
export const leafGeom = (i: number, d: number, grow = 1) => {
  const {a, l, b, dx} = LEAVES[i];
  const s = a >= 0 ? 1 : -1;
  const ts = a * 0.55 + s * d * 26 - s * (1 - grow) * 10;
  const te = a + s * d * 125 - s * (1 - grow) * 30;
  const len = l * S * (1 - 0.16 * d) * mix(0.12, 1, grow);
  const P0: [number, number] = [SOIL[0] + dx * S, SOIL[1]];
  const d1 = dir(ts);
  const P1: [number, number] = [P0[0] + d1[0] * len * 0.5, P0[1] + d1[1] * len * 0.5];
  const dm = dir((ts + te) / 2);
  const P3: [number, number] = [P1[0] + dm[0] * len * 0.55, P1[1] + dm[1] * len * 0.55];
  const de = dir(te);
  const P2: [number, number] = [P3[0] - de[0] * len * 0.3, P3[1] - de[1] * len * 0.3];
  const B = b * S * grow;
  const w = B * 0.42 * (1 - 0.35 * d);
  const tip: [number, number] = [P3[0] + de[0] * B, P3[1] + de[1] * B];
  return {P0, P1, P2, P3, te, B, w, tip};
};

/** Where the beads sit on a blade (fractions of its half-width and length) and how big they are. */
const BEADS = [
  [0.38, 0.36, 7],
  [-0.3, 0.58, 5.5],
  [0.12, 0.8, 4.5],
];

/** One leaf on its stem: a two-tone blade with a midrib and side veins, a browning tip as it dries, beads after water. */
const Leaf: React.FC<{i: number; d: number; grow?: number; wet?: number; transform?: string; opacity?: number}> = ({i, d, grow = 1, wet = 0, transform, opacity = 1}) => {
  const {P0, P1, P2, P3, te, B, w} = leafGeom(i, d, grow);
  const fill = mixColor(T.accent, T.accent2, d * 0.62);
  const shade = mixColor(fill, T.canvas, 0.16);
  const rib = mixColor(fill, T.canvas, 0.38);
  const brown = mixColor(mixColor(T.accent2, T.danger, 0.25), T.canvas, 0.42);
  const burn = lerp(d, [0.45, 1], [0, 1], (t) => t) * (i === FALLER ? 1 : 0.7);
  const half = (side: number) => `M 0 0 C ${side * w} ${-B * 0.2} ${side * w * 0.9} ${-B * 0.75} 0 ${-B} Z`;
  return (
    <g transform={transform} opacity={opacity}>
      <path d={`M ${P0[0]} ${P0[1]} C ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]} ${P3[0]} ${P3[1]}`} fill="none" stroke={rib} strokeWidth={13} strokeLinecap="round" />
      {B > 1 && (
        <g transform={`translate(${P3[0]} ${P3[1]}) rotate(${te})`}>
          <path d={half(1)} fill={fill} />
          <path d={half(-1)} fill={shade} />
          {/* the dry tip: the last third of the blade, browning as it wilts */}
          {burn > 0.01 && <path d={`M ${-w * 0.62} ${-B * 0.72} Q 0 ${-B * 0.6} ${w * 0.62} ${-B * 0.72} C ${w * 0.5} ${-B * 0.84} ${w * 0.2} ${-B * 0.96} 0 ${-B} C ${-w * 0.2} ${-B * 0.96} ${-w * 0.5} ${-B * 0.84} ${-w * 0.62} ${-B * 0.72} Z`} fill={brown} opacity={burn} />}
          <path d={`M 0 0 Q ${w * 0.1} ${-B * 0.5} 0 ${-B * 0.92}`} fill="none" stroke={rib} strokeWidth={6} strokeLinecap="round" />
          {[0.28, 0.48, 0.68].map((y) =>
            [1, -1].map((side) => <path key={`${y}${side}`} d={`M ${side * 1} ${-B * y} Q ${side * w * 0.35} ${-B * (y + 0.05)} ${side * w * 0.62} ${-B * (y + 0.14)}`} fill="none" stroke={rib} strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />),
          )}
          {wet > 0.01 &&
            BEADS.map(([bx, by, r], k) => (
              <g key={k} opacity={wet}>
                <circle cx={bx * w} cy={-by * B} r={r} fill={alpha(T.ink, 0.28)} />
                <circle cx={bx * w - r * 0.3} cy={-by * B - r * 0.3} r={r * 0.32} fill={alpha(T.ink, 0.85)} />
              </g>
            ))}
        </g>
      )}
    </g>
  );
};

/** The cracks of dry soil: a few seeded, branching lines across the surface, drawn on one after another. */
const CRACKS = Array.from({length: 7}, (_, k) => {
  const a = (k / 7) * Math.PI * 2 + rnd(`ca${k}`, -0.3, 0.3);
  const pts: [number, number][] = [];
  let r = rnd(`c0${k}`, 0.08, 0.22);
  for (let s = 0; s < 5; s++) {
    const aa = a + rnd(`cj${k}${s}`, -0.35, 0.35);
    pts.push([Math.cos(aa) * r, Math.sin(aa) * r]);
    r += rnd(`cr${k}${s}`, 0.13, 0.2);
  }
  return pts.filter(([x, y]) => x * x + y * y < 0.82);
});
const GRAINS = Array.from({length: 46}, (_, k) => {
  const a = rnd(`ga${k}`, 0, Math.PI * 2);
  const r = Math.sqrt(rnd(`gr${k}`, 0, 0.9));
  return {x: Math.cos(a) * r, y: Math.sin(a) * r, s: rnd(`gs${k}`, 2.2, 5.5), light: rnd(`gl${k}`) > 0.5};
});
/** The splash: droplets thrown up and out from where the water lands. */
const SPLASH = Array.from({length: 9}, (_, k) => ({a: rnd(`sa${k}`, -160, -20), v: rnd(`sv${k}`, 4.5, 8.5), r: rnd(`sr${k}`, 4, 8)}));

export const WATER = mixColor(T.accent, T.ink, 0.35);

/** The soil's surface: dry colour, grains, cracks, the wet patch, ripples and the splash. */
const Soil: React.FC<{g: number; clip: string}> = ({g, clip}) => {
  const {cx, cy, rx, ry} = SOIL_E;
  const dry = mixColor(mixColor(T.accent2, T.canvas, 0.58), T.muted, 0.12);
  const wet = mixColor(dry, D.deep, 0.78);
  const spread = wetSpread(g);
  const wetA = g >= LAND ? 1 : moisture(g);
  const ck = cracks(g);
  const st = g - LAND;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={dry} />
      <g clipPath={`url(#${clip})`}>
        {/* the far inner wall of the pot, in shadow */}
        <ellipse cx={cx} cy={cy - ry * 0.55} rx={rx * 1.02} ry={ry * 0.62} fill={alpha(D.deep, 0.3)} />
        {GRAINS.map((q, k) => (
          <ellipse key={k} cx={cx + q.x * rx} cy={cy + q.y * ry} rx={q.s} ry={q.s * 0.6} fill={q.light ? mixColor(dry, T.ink, 0.22) : mixColor(dry, D.deep, 0.4)} />
        ))}
        {CRACKS.map((pts, k) => {
          const t = Math.min(1, Math.max(0, ck * 1.7 - k * 0.1));
          if (t <= 0 || pts.length < 2) return null;
          const d = pts.map(([x, y], j) => `${j ? 'L' : 'M'} ${cx + x * rx} ${cy + y * ry}`).join(' ');
          return <path key={k} d={d} fill="none" stroke={mixColor(dry, D.deep, 0.75)} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${t} 2`} />;
        })}
        {wetA > 0.01 && <ellipse cx={IMPACT[0]} cy={IMPACT[1]} rx={mix(10, rx * 1.35, spread)} ry={mix(4, ry * 1.5, spread)} fill={wet} opacity={wetA} />}
        {/* ripples running out from the landing */}
        {[0, 9, 18].map((o) => {
          const t = p(st, o, 40, (x) => 1 - Math.pow(1 - x, 2));
          if (st < o || t >= 1) return null;
          return <ellipse key={o} cx={IMPACT[0]} cy={IMPACT[1]} rx={mix(8, rx * 1.1, t)} ry={mix(3, ry * 1.1, t)} fill="none" stroke={alpha(WATER, 0.7 * (1 - t))} strokeWidth={4} />;
        })}
      </g>
      {/* the splash, thrown out over the rim */}
      {st >= 0 &&
        st < 34 &&
        SPLASH.map((s, k) => {
          const x = IMPACT[0] + Math.cos(rad(s.a)) * s.v * st;
          const y = IMPACT[1] + Math.sin(rad(s.a)) * s.v * st + 0.32 * st * st;
          return <circle key={k} cx={x} cy={y} r={s.r * (1 - st / 40)} fill={WATER} opacity={lerp(st, [0, 2, 24, 34], [0, 1, 1, 0])} />;
        })}
    </g>
  );
};

/** The plant in its pot at story time g; `light` 0..1 is the window's light on it. */
export const Plant: React.FC<{g: number; light: number}> = ({g, light}) => {
  const id = useId().replace(/:/g, '');
  const potLight = mixColor(T.panel, T.ink, 0.22);
  const potDark = mixColor(T.panel, T.ink, 0.06);
  const rimTop = mixColor(T.panel, T.ink, 0.3);
  const ft = fallT(g);
  const gt = growT(g);
  const wet = beads(g);
  const {top, bottom, topW, bottomW} = POT;
  const sh = shiver(g);
  const faller = LEAVES[FALLER];
  const base: [number, number] = [SOIL[0] + faller.dx * S, SOIL[1]];
  // the drip: a bead gathers at leaf 1's tip, lets go, and falls to the sill
  const tip0 = leafGeom(1, droop(g, 1)).tip;
  const dripGrow = p(g, DRIP - 24, 24);
  const dripFall = p(g, DRIP, 28, (x) => x * x);
  const dripY = mix(tip0[1] + 6, SILL - 4, dripFall);
  const dripSplash = g - (DRIP + 28);
  return (
    <svg width={1} height={1} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <defs>
        <linearGradient id={`pot${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mixColor(potLight, T.accent2, 0.1 * light)} />
          <stop offset="0.45" stopColor={potLight} />
          <stop offset="1" stopColor={potDark} />
        </linearGradient>
        <clipPath id={`soil${id}`}>
          <ellipse cx={SOIL_E.cx} cy={SOIL_E.cy} rx={SOIL_E.rx} ry={SOIL_E.ry} />
        </clipPath>
      </defs>
      {/* the shadow on the sill, the saucer */}
      <ellipse cx={PX + 30} cy={SILL + 4} rx={240} ry={16} fill={alpha(D.deep, 0.8)} />
      <path d={`M ${PX - 182} ${SILL - 18} L ${PX + 182} ${SILL - 18} L ${PX + 170} ${SILL} L ${PX - 170} ${SILL} Z`} fill={potDark} />
      <rect x={PX - 184} y={SILL - 22} width={368} height={8} rx={4} fill={potLight} />
      {/* the pot's body, with the window's light along its left side and a rim of shadow under the band */}
      <path d={`M ${PX - topW / 2} ${top} L ${PX + topW / 2} ${top} L ${PX + bottomW / 2} ${bottom} L ${PX - bottomW / 2} ${bottom} Z`} fill={`url(#pot${id})`} />
      <rect x={PX - topW / 2} y={top} width={topW} height={14} fill={alpha(D.deep, 0.35)} />
      <path d={`M ${PX - topW / 2 + 22} ${top + 30} L ${PX - bottomW / 2 + 18} ${bottom - 12}`} stroke={alpha(T.accent2, 0.2 * light)} strokeWidth={10} strokeLinecap="round" />
      {/* the rim: its band, then its top surface, then the soil inside it */}
      <path d={`M ${RIM.cx - RIM.rx} ${RIM.cy} L ${RIM.cx - RIM.rx} ${RIM.cy + RIM.band} A ${RIM.rx} ${RIM.ry * 0.5} 0 0 0 ${RIM.cx + RIM.rx} ${RIM.cy + RIM.band} L ${RIM.cx + RIM.rx} ${RIM.cy} Z`} fill={`url(#pot${id})`} />
      <ellipse cx={RIM.cx} cy={RIM.cy} rx={RIM.rx} ry={RIM.ry} fill={rimTop} />
      <Soil g={g} clip={`soil${id}`} />
      {LEAVES.map((_, i) => {
        if (i !== FALLER || g < FALL) {
          const t = i === FALLER ? `rotate(${sh} ${base[0]} ${base[1]})` : undefined;
          return <Leaf key={i} i={i} d={droop(g, i)} wet={wet} transform={t} />;
        }
        if (gt > 0) return <Leaf key={i} i={i} d={droop(g, i)} grow={gt} wet={wet} />;
        if (ft >= 1) return null;
        // it lets go: drifts out, turns, and falls past the sill
        return <Leaf key={i} i={i} d={1} transform={`translate(${ft * 210} ${ft * 820}) rotate(${ft * 120} ${base[0]} ${base[1]})`} />;
      })}
      {/* the drip */}
      {dripGrow > 0 && dripFall < 1 && <circle cx={tip0[0]} cy={dripY} r={7 * dripGrow} fill={WATER} />}
      {dripSplash >= 0 && dripSplash < 20 && <ellipse cx={tip0[0]} cy={SILL - 2} rx={mix(4, 30, dripSplash / 20)} ry={mix(1.5, 6, dripSplash / 20)} fill="none" stroke={alpha(WATER, 0.8 * (1 - dripSplash / 20))} strokeWidth={3} />}
    </svg>
  );
};
