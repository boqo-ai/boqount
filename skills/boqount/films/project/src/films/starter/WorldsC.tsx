// Worlds 8 to 10: the product at work, named here for the first time (its name large, then the app doing what the
// line says, in its own labels), the payoff, and the call shown.
import React from 'react';
import {EXPO, INOUT, bump, lerp, mix, p} from '../../lib/anim';
import {useF} from '../../lib/scene';
import {D, F, L, T, alpha} from '../../lib/theme';
import {Camera} from '../../kit/Camera';
import {Call} from '../../kit/Call';
import {Odo} from '../../kit/Fx';
import {Done} from '../../kit/Kit';
import {hasLogo, Logo} from '../../kit/Logo';
import {Backdrop, Foliage, Motes, Pot, Surface, type Kind} from './draw';
import {Sill} from './WorldsB';
import {CODE, DURATION, WORLD, cue} from './timeline';

const at = (f0: number, x: number, y: number, scale: number) => ({at: f0, x, y, scale});

// ───────────── 8. the product at work ─────────────

/** The app's plant list, in its own labels: each plant on a schedule of its own. */
const ROWS: {plant: string; kind: Kind; every: string}[] = [
  {plant: 'Fern', kind: 'fern', every: 'every 4 days'},
  {plant: 'Cactus', kind: 'cactus', every: 'every 3 weeks'},
  {plant: 'Monstera', kind: 'leafy', every: 'every 7 days'},
  {plant: 'Snake plant', kind: 'snake', every: 'every 2 weeks'},
];
const CARD = {x: L.left, y: 300, w: L.right - L.left, h: 640};
const ROW_Y = (i: number) => CARD.y + 150 + i * 118;
/** The reminder that arrives for the one plant whose day it is, and its Done. */
const NOTE = {x: CARD.x + 24, y: ROW_Y(0) - 22, w: CARD.w - 48, h: 144};
const DONE_C: [number, number] = [NOTE.x + NOTE.w - 110, NOTE.y + NOTE.h / 2];

export const W8App: React.FC = () => {
  const f = useF();
  const a = WORLD.app[0];
  const name = cue('name', 0);
  const dock = p(f, cue('name', 2), 26, INOUT); // the name goes up into the app's header as the schedules arrive
  const card = p(f, cue('name', 2), 20, EXPO);
  const rowIn = (i: number) => p(f, cue('name', 5) + i * 6 - 10, 14, EXPO);
  const note = p(f, cue('remind', 3) - 6, 16, EXPO);
  const none = p(f, cue('remind', 12), 14);
  const tap = cue('done', 1);
  const done = p(f, tap, 20);
  const count = lerp(f, [tap + 10, cue('done', 6)], [4, 0], INOUT);
  const press = lerp(f, [tap - 6, tap, tap + 8], [0, 1, 0]);
  // the name: large in the middle on its word, then small in the card's header
  const nameSize = mix(150, 60, dock);
  const nameX = mix(540, CARD.x + 40, dock);
  const nameY = mix(560, CARD.y + 36, dock);
  return (
    <>
      <Backdrop a={T.accent} b={T.accent2} hi={0.2} lo={0.1} />
      <Camera keys={[at(a, 540, 620, 1), at(cue('remind', 3), 540, 620, 1), at(cue('remind', 10), 540, 640, 1.04), at(tap - 20, 560, DONE_C[1] + 100, 1.06), at(cue('done', 6), 566, DONE_C[1] + 104, 1.07), at(WORLD.app[1], 540, 620, 1.05)]} aim={[540, 620]}>
        <Surface y={1560} />
        {/* the fern the reminder is about, on the table under the app: it lifts as it is watered */}
        <Pot x={540} y={1720} s={1.9} kind="fern" dry={0.55 * (1 - done)} />
        {card > 0 && (
          <div style={{position: 'absolute', left: CARD.x, top: CARD.y + (1 - card) * 120, width: CARD.w, height: CARD.h, borderRadius: T.radius * 1.4, background: T.panel, boxShadow: `inset 0 0 0 2px ${D.line}, ${D.shadow}`, opacity: card}}>
            {ROWS.map((r, i) => {
              const t = rowIn(i);
              const y = ROW_Y(i) - CARD.y;
              const other = i > 0;
              return (
                <div key={r.plant} style={{position: 'absolute', left: 40, right: 40, top: y, height: 100, display: 'flex', alignItems: 'center', gap: 28, opacity: t * (other ? 1 - 0.45 * none : 1), translate: `${(1 - t) * 60}px 0`}}>
                  <div style={{width: 96, height: 96, borderRadius: 26, background: D.raised, position: 'relative', flex: 'none'}}>
                    <Pot x={48} y={92} s={0.26} kind={r.kind} />
                  </div>
                  <div style={{flex: 1, fontFamily: F.text, fontWeight: 700, fontSize: 48, color: T.ink, letterSpacing: '-0.02em'}}>{r.plant}</div>
                  <div style={{fontFamily: F.text, fontWeight: 600, fontSize: 38, color: other && none > 0.5 ? T.muted : T.accent}}>{other && none > 0.5 ? 'not today' : r.every}</div>
                </div>
              );
            })}
          </div>
        )}
        {/* the one reminder: the fern's water day */}
        {note > 0 && (
          <div style={{position: 'absolute', left: NOTE.x, top: NOTE.y - (1 - note) * 160, width: NOTE.w, height: NOTE.h, borderRadius: 40, background: D.raised, boxShadow: `inset 0 0 0 3px ${alpha(T.accent, 0.5)}, ${D.shadow}`, opacity: Math.min(1, note * 2), display: 'flex', alignItems: 'center', padding: '0 36px', gap: 28, boxSizing: 'border-box'}}>
            <div style={{width: 100, height: 100, borderRadius: 26, background: T.panel, position: 'relative', flex: 'none'}}>
              <Pot x={50} y={96} s={0.28} kind="fern" dry={0.4 * (1 - done)} />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6, fontFamily: F.text}}>
              <span style={{fontSize: 46, fontWeight: 800, color: T.ink, letterSpacing: '-0.02em'}}>Fern · water day</span>
              <span style={{display: 'inline-flex', alignItems: 'baseline', gap: 12, fontSize: 38, fontWeight: 600, color: T.muted}}>
                <Odo value={count} size={38} color={count > 0.5 ? T.accent2 : T.accent} weight={700} /> days since water
              </span>
            </div>
            <div style={{position: 'absolute', left: DONE_C[0] - NOTE.x - 50, top: NOTE.h / 2 - 50, scale: `${1 - 0.08 * press}`}}>
              <Done size={100} t={done} />
            </div>
          </div>
        )}
      </Camera>
      <Motes n={16} color={T.accent} />
      <Foliage reach={0.75} dry={0} />
      {/* the name, large on its word, then docked into the header (over the camera: it stays put) */}
      <div style={{position: 'absolute', left: nameX, top: nameY, translate: `${mix(-50, 0, dock)}% 0`, display: 'flex', alignItems: 'center', gap: nameSize * 0.25, opacity: p(f, a - 20, 8), scale: `${bump(f, name + 2, 0.05)}`, transformOrigin: '0 50%'}}>
        {hasLogo() && <Logo height={nameSize * 1.05} />}
        <span style={{fontFamily: F.display, fontWeight: 800, fontSize: nameSize, letterSpacing: '-0.035em', color: T.ink, whiteSpace: 'nowrap'}}>Quillfern</span>
      </div>
    </>
  );
};

// ───────────── 9. the payoff ─────────────

export const W9Payoff: React.FC = () => {
  const f = useF();
  const a = WORLD.payoff[0];
  const t0 = cue('payoff', 3);
  const t1 = cue('payoff', 9);
  // the twelve water days leave the cloud one by one, back down into their pots, and the cloud goes
  const lift = (i: number) => 1 - p(f, mix(t0, t1, i / 12), 18, INOUT);
  const cloud = 1 - p(f, t1, 16);
  return (
    <>
      <Backdrop a={T.accent} b={T.accent2} hi={0.22} lo={0.14} />
      <Camera keys={[at(a, 540, 960, 1.08), at(WORLD.payoff[1], 540, 990, 1)]} aim={[540, 960]}>
        <Sill lift={lift} cloud={cloud} healthy />
      </Camera>
      <Motes color={T.accent} />
      <Foliage reach={0.85} />
    </>
  );
};

// ───────────── 10. the call, shown ─────────────

export const W10Call: React.FC = () => {
  const f = useF();
  const rise = p(f, WORLD.call[0], 24, EXPO);
  return (
    <>
      <Call code={CODE} type={cue('cta', 1)} send={cue('cta', 2)} reply={cue('cta', 7) - 4} from={WORLD.call[0]} end={DURATION} />
      {/* under the call, the plants it is for: all of them well, on the table */}
      <div style={{position: 'absolute', inset: 0, translate: `0 ${(1 - rise) * 160}px`, opacity: rise}}>
        <Surface y={1580} />
        {(['fern', 'leafy', 'cactus', 'snake', 'leafy'] as Kind[]).map((k, i) => (
          <Pot key={i} x={150 + i * 195} y={1610 + (i % 2) * 40} s={0.95} kind={k} />
        ))}
      </div>
      <Motes color={T.accent} top={1100} />
      <Foliage reach={0.7} />
    </>
  );
};
