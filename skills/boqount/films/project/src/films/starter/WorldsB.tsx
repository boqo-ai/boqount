// Worlds 4 to 7: who is left (keeping track by memory, and guessing), where you come in (twelve water days carried in
// your head), what most do (everything the morning they leave), and its result with the turn (a schedule of each plant's own).
import React from 'react';
import {EXIT as EXIT_EASE, EXPO, GRAVITY, INOUT, bump, lerp, mix, p, rnd} from '../../lib/anim';
import {useF} from '../../lib/scene';
import {D, F, T, alpha, mixColor} from '../../lib/theme';
import {Camera} from '../../kit/Camera';
import {Backdrop, Can, Drop, Foliage, Key, Motes, Pot, Suitcase, Surface, Tag, type Kind} from './draw';
import {WORLD, cue} from './timeline';

const at = (f0: number, x: number, y: number, scale: number) => ({at: f0, x, y, scale});

// ───────────── 4. who is left: keeping track by memory ─────────────

const NOTES = [
  {plant: 'Fern', when: 'Tuesday?'},
  {plant: 'Cactus', when: 'ages ago'},
  {plant: 'Monstera', when: 'Sat?'},
  {plant: 'Snake plant', when: '?'},
  {plant: 'Pothos', when: 'last week?'},
  {plant: 'Basil', when: 'yesterday?'},
];
const PAPER = mixColor(T.accent2, T.ink, 0.55);

export const W4Notes: React.FC = () => {
  const f = useF();
  const a = WORLD.notes[0];
  const t0 = cue('left', 1);
  const t1 = cue('left', 10);
  const guess = cue('guess', 4);
  const fall = p(f, guess + 8, 40, GRAVITY);
  return (
    <>
      <Backdrop a={T.muted} b={T.accent2} hi={0.16} />
      <Camera keys={[at(a, 540, 610, 1.03), at(WORLD.notes[1], 540, 620, 1)]} aim={[540, 610]}>
        <Surface y={1440} />
        <Can x={300} y={1520} s={1.25} tilt={lerp(f, [guess, guess + 30], [0, -4], EXPO)} />
        <Key x={760} y={1500} s={1.3} rot={-14 + 6 * Math.sin(f / 90)} />
        {NOTES.map((n, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const slap = p(f, i === 0 ? a : mix(t0, t1, i / NOTES.length), 10, EXPO);
          const drop = i === 3 ? fall : 0;
          const rot = rnd(`nr${i}`, -5, 5) + drop * 30;
          const q = lerp(f, [guess - 2, guess + 6, guess + 30], [0, 1, 0.6]);
          return slap > 0 ? (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 85 + col * 470,
                top: 300 + row * 215 + drop * 760,
                width: 440,
                height: 190,
                borderRadius: 10,
                background: PAPER,
                boxShadow: `0 14px 30px ${alpha('#000000', 0.35)}`,
                rotate: `${rot}deg`,
                scale: `${mix(1.3, 1, slap)}`,
                opacity: Math.min(1, slap * 2),
                padding: '28px 32px',
                boxSizing: 'border-box',
                fontFamily: F.text,
                color: T.canvas,
              }}
            >
              <div style={{position: 'absolute', left: '50%', top: -12, width: 34, height: 34, borderRadius: 99, background: T.danger, translate: '-50% 0', boxShadow: `0 4px 6px ${alpha('#000000', 0.3)}`}} />
              <div style={{fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em'}}>{n.plant}</div>
              <div style={{fontSize: 42, fontWeight: 600, marginTop: 6, color: n.when.includes('?') ? mixColor(T.canvas, T.danger, q) : T.canvas, scale: n.when.includes('?') ? `${1 + 0.08 * q}` : undefined, transformOrigin: '0 50%'}}>{n.when}</div>
            </div>
          ) : null;
        })}
      </Camera>
      <Motes n={16} color={T.muted} />
      <Foliage reach={0.85} />
    </>
  );
};

// ───────────── the full windowsill (worlds 5 and 9) ─────────────

const SILL: Kind[] = ['leafy', 'cactus', 'fern', 'snake', 'leafy', 'fern', 'cactus', 'leafy', 'snake', 'fern', 'leafy', 'cactus'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Wed', 'Thu', 'Sat', 'Sun'];
/** Twelve pots in two rows on the sill: six behind, six in front and bigger. [x, y, scale] of pot i. */
const POS = (i: number): [number, number, number] => (i < 6 ? [150 + i * 156, 1390, 0.62] : [228 + (i - 6) * 156, 1580, 0.8]);
const SILL_Y = 1390;
/** Where drop i sits in the thought cloud. */
const cell = (i: number): [number, number] => [190 + (i % 6) * 140, 420 + Math.floor(i / 6) * 150];

/** The windowsill full of plants, and the twelve water days carried above it in a cloud. `lift(i)` 0..1 carries
 * drop i from its pot up into the cloud; `cloud` 0..1 is the cloud's presence. */
export const Sill: React.FC<{lift: (i: number) => number; cloud: number; healthy?: boolean}> = ({lift, cloud, healthy}) => (
  <>
    {/* the window behind the sill: four panes in the low light, the whole height above it */}
    <div style={{position: 'absolute', left: 120, top: 200, width: 840, height: 1160, borderRadius: 24, background: `linear-gradient(to bottom, ${alpha(T.accent2, 0.1)}, ${alpha(T.accent, 0.06)})`, boxShadow: `inset 0 0 0 16px ${mixColor(T.panel, T.ink, 0.05)}`}} />
    <div style={{position: 'absolute', left: 532, top: 200, width: 16, height: 1160, background: mixColor(T.panel, T.ink, 0.05)}} />
    <div style={{position: 'absolute', left: 120, top: 772, width: 840, height: 16, background: mixColor(T.panel, T.ink, 0.05)}} />
    <Surface y={SILL_Y - 4} depth={210} />
    {SILL.map((k, i) => {
      const [x, y, sc] = POS(i);
      return <Pot key={i} x={x} y={y} s={sc} kind={k} dry={healthy ? 0 : 0.25} />;
    })}
    {cloud > 0 && (
      <div style={{position: 'absolute', left: 95, top: 330, width: 890, height: 330, borderRadius: 120, background: alpha(mixColor(T.panel, T.ink, 0.1), 0.92), boxShadow: D.shadow, opacity: Math.min(1, cloud * 1.5), scale: `${mix(0.7, 1, cloud)}`, transformOrigin: '50% 100%'}} />
    )}
    {SILL.map((_, i) => {
      const t = lift(i);
      if (t <= 0) return null;
      const [cx, cy] = cell(i);
      const [px, py, sc] = POS(i);
      const x = mix(px, cx, t);
      const y = mix(py - 190 * sc, cy, t) - Math.sin(Math.PI * t) * 120;
      return (
        <React.Fragment key={i}>
          <Drop x={x} y={y} size={mix(34, 50, t)} />
          {t > 0.9 && cloud > 0.5 && <div style={{position: 'absolute', left: cx - 60, width: 120, top: cy + 38, textAlign: 'center', fontFamily: F.text, fontWeight: 700, fontSize: 34, color: T.ink, opacity: (t - 0.9) * 10}}>{DAYS[i]}</div>}
        </React.Fragment>
      );
    })}
  </>
);

// ───────────── 5. where you come in ─────────────

export const W5Sill: React.FC = () => {
  const f = useF();
  const a = WORLD.sill[0];
  const t0 = cue('carry', 3);
  const t1 = cue('carry', 7);
  const lift = (i: number) => p(f, mix(t0, t1, i / 12), 22, INOUT);
  const cloud = p(f, t0 - 10, 16, EXPO);
  return (
    <>
      <Backdrop a={T.accent} b={T.ink} hi={0.14} lo={0.08} />
      <Camera keys={[at(a, 540, 1300, 1.45), at(cue('you', 2), 540, 1120, 1.16), at(cue('carry', 0), 540, 960, 1), at(WORLD.sill[1], 540, 950, 1.02)]} aim={[540, 960]}>
        <Sill lift={lift} cloud={cloud} />
      </Camera>
      <Motes />
      <Foliage reach={0.8} />
    </>
  );
};

// ───────────── 6. what most do: everything the morning they leave ─────────────

const AWAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BIG = {x: 110, y: 300, w: 360, h: 630};
const SMALL = {x: 500, y: 300, w: 470, h: 82, gap: 9};

export const W6Week: React.FC = () => {
  const f = useF();
  const a = WORLD.week[0];
  const t0 = cue('sunday', 1);
  const t1 = cue('sunday', 4);
  const leave = cue('sunday', 6);
  const big = p(f, a - 20, 14, EXPO);
  return (
    <>
      <Backdrop a={T.accent2} b={T.muted} hi={0.16} />
      <Camera keys={[at(a, 540, 620, 1), at(t0, 540, 630, 1.04), at(leave, 540, 620, 1), at(WORLD.week[1], 540, 630, 1.03)]} aim={[540, 610]}>
        <Surface y={1560} />
        {/* the suitcase: in by the door as the morning starts, off to the right as they leave */}
        <Suitcase x={mix(mix(-260, 330, p(f, a - 10, 26, EXPO)), 1500, p(f, leave + 2, 40, EXIT_EASE))} y={1600} s={1.05} style={{rotate: `${lerp(f, [leave, leave + 8, leave + 40], [0, -6, -4])}deg`, transformOrigin: '50% 100%'}} />
        <Can x={800} y={1610} s={1.1} />
        {/* the one day: all the water goes in here */}
        <div style={{position: 'absolute', left: BIG.x, top: BIG.y, width: BIG.w, height: BIG.h, borderRadius: 28, background: alpha(T.accent2, 0.1), boxShadow: `inset 0 0 0 4px ${alpha(T.accent2, 0.7)}`, opacity: big, scale: `${mix(0.9, 1, big)}`}}>
          <div style={{position: 'absolute', left: 30, top: 24, fontFamily: F.text, fontWeight: 800, fontSize: 52, color: T.ink}}>Sat</div>
          <div style={{position: 'absolute', left: 30, top: 90, fontFamily: F.text, fontWeight: 600, fontSize: 36, color: T.accent2, opacity: p(f, leave - 6, 10)}}>you leave</div>
        </div>
        {Array.from({length: 12}, (_, i) => {
          const t = p(f, mix(t0, t1, i / 12), 18, GRAVITY);
          if (t <= 0) return null;
          const x = BIG.x + 80 + (i % 3) * 110;
          const y = mix(180, BIG.y + 250 + Math.floor(i / 3) * 95, t);
          return <Drop key={i} x={x} y={y} size={58} style={{scale: `${bump(f, mix(t0, t1, i / 12) + 18, 0.12)}`}} />;
        })}
        {/* then a week away: no water on any of its days */}
        {AWAY.map((d, i) => {
          const show = p(f, a - 20 + i * 3, 12, EXPO);
          const pass = p(f, leave + 4 + i * 5, 10);
          return (
            <div key={d} style={{position: 'absolute', left: SMALL.x, top: SMALL.y + i * (SMALL.h + SMALL.gap), width: SMALL.w, height: SMALL.h, borderRadius: 18, background: D.track, opacity: show, translate: `${(1 - show) * 40}px 0`, display: 'flex', alignItems: 'center', padding: '0 26px', boxSizing: 'border-box', fontFamily: F.text}}>
              <span style={{fontWeight: 700, fontSize: 40, color: T.ink}}>{d}</span>
              <span style={{marginLeft: 'auto', fontWeight: 600, fontSize: 36, color: mixColor(T.muted, T.danger, pass), opacity: 0.4 + 0.6 * pass}}>no water</span>
            </div>
          );
        })}
      </Camera>
      <Motes n={14} />
      <Foliage reach={0.7} />
    </>
  );
};

// ───────────── 7. the result, and the turn ─────────────

export const W7Pair: React.FC = () => {
  const f = useF();
  const a = WORLD.pair[0];
  const fernDry = lerp(f, [cue('result', 4), cue('result', 6) + 10], [0.2, 0.85]);
  const water = lerp(f, [cue('result', 9), cue('result', 13) + 20], [0.1, 1]);
  const strike = p(f, cue('turn', 1), 14);
  const own = p(f, cue('turn', 8) - 4, 14, EXPO);
  const tag = (x: number, own2: string) => (
    <>
      <Tag x={x} y={300} size={44} color={T.accent2} style={{opacity: 1 - 0.5 * own}}>
        Saturday
        <div style={{position: 'absolute', left: 18, top: '50%', height: 6, width: `calc(${strike * 100}% - 36px)`, background: T.danger, borderRadius: 3}} />
      </Tag>
      {own > 0 && (
        <Tag x={x} y={410 - (1 - own) * 40} size={44} color={T.accent} style={{opacity: own, scale: `${bump(f, cue('turn', 8) + 8, 0.06)}`}}>
          {own2}
        </Tag>
      )}
    </>
  );
  return (
    <>
      <Backdrop a={T.danger} b={T.accent} hi={0.18} />
      <Camera keys={[at(a, 540, 960, 1), at(cue('turn', 0), 540, 960, 1.04), at(WORLD.pair[1], 540, 950, 1.02)]} aim={[540, 960]}>
        <Surface y={1240} />
        <Pot x={290} y={1250} s={2.5} kind="fern" dry={fernDry} />
        <Pot x={790} y={1250} s={2.5} kind="cactus" water={water} />
      </Camera>
      <Motes n={14} color={T.danger} />
      <Foliage reach={0.6} dry={fernDry * 0.3} />
      {tag(290, 'every 4 days')}
      {tag(790, 'every 3 weeks')}
    </>
  );
};

