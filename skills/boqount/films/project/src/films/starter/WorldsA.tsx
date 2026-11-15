// Worlds 1 to 3: the hook (a number about something everyone knows, summer trips, its source on screen by 0.5 s,
// already moving on frame 0, then the twist that turns it to the viewer's plants), the proof (the same survey's second number), and the catch (a plant cannot say it is thirsty). The
// picture has the frame above the caption band (kit/Captions.tsx CAPTION); nothing here is drawn inside the band.
import React from 'react';
import {EXIT, EXPO, lerp, mix, p, rnd} from '../../lib/anim';
import {useF} from '../../lib/scene';
import {F, L, T, alpha, mixColor} from '../../lib/theme';
import {Camera} from '../../kit/Camera';
import {Odo} from '../../kit/Fx';
import {SourceLine} from '../../kit/Kit';
import {Backdrop, Board, Pot, type Kind} from './draw';
import {WORLD, cue} from './timeline';

/** The frame point the camera's looked-at world point lands on: the middle of the picture's part of the frame. */
export const PIC: [number, number] = [L.W / 2, 610];
const at = (f0: number, x: number, y: number, scale: number) => ({at: f0, x, y, scale});

/** Who the example's numbers come from. The starter's brand and its survey are invented; a real film's hook is a
 * number anyone can open at its source (film.md → The story format). */
export const SURVEY = 'Quillfern travel survey, example data';
const READ = 'Nov 2026';

// ───────────── 1. the number: nine in ten trips last a week or longer; your plants stay ─────────────

/** Ten summer trips as bars of their length; the one week mark across them. Nine pass it. */
const TRIPS = [0.92, 0.78, 1.0, 0.84, 0.42, 0.88, 0.96, 0.8, 0.9, 0.86];
const BAR = {x0: 240, w: 56, gap: 22, base: 940, max: 250};
const WEEK_Y = BAR.base - 0.62 * BAR.max;

export const W1Number: React.FC = () => {
  const f = useF();
  // the counter is rolling on frame 0 and lands on 9 as "ten" is read
  const v = lerp(f, [0, cue('hook', 2) + 6], [6.2, 9], EXPO);
  // the trips grow from frame 0 and are all grown by "longer."
  const grow = (i: number) => lerp(f, [-30 + i * 4, cue('hook', 9) + 6], [0.15, 1], EXPO);
  // "Your plants aren't coming.": the trips leave to the right, one after another; the plants stay on the sill
  const go = (i: number) => p(f, cue('twist', 0) + (9 - i) * 2, 22, EXIT);
  const stay = p(f, cue('twist', 1) - 4, 16, EXPO);
  const mark = 1 - p(f, cue('twist', 0), 14);
  return (
    <>
      <Backdrop a={T.accent2} b={T.accent} />
      <Camera keys={[at(0, 540, 760, 1), at(cue('twist', 0), 540, 760, 1.02), at(WORLD.number[1], 540, 820, 1.12)]} aim={[540, 760]}>
        <Board y={BAR.base} x0={0} x1={1080} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Pot key={i} x={190 + i * 175} y={BAR.base + 4} s={0.5} kind={(['fern', 'leafy', 'cactus', 'snake', 'leafy'] as Kind[])[i]} style={{opacity: stay, translate: `0 ${(1 - stay) * 40}px`}} />
        ))}
        {TRIPS.map((h, i) => {
          const hh = h * BAR.max * grow(i);
          const over = h * BAR.max > BAR.base - WEEK_Y;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: BAR.x0 + i * (BAR.w + BAR.gap) + go(i) * 1100,
                top: BAR.base - hh,
                width: BAR.w,
                height: hh,
                borderRadius: 14,
                background: over ? T.accent2 : T.muted,
              }}
            />
          );
        })}
        <div style={{position: 'absolute', left: 70, width: 940, top: WEEK_Y, height: 0, borderTop: `4px dashed ${alpha(T.ink, 0.6)}`, opacity: mark}} />
        <div style={{position: 'absolute', left: 70, top: WEEK_Y - 52, fontFamily: F.text, fontWeight: 700, fontSize: 36, color: T.ink, whiteSpace: 'nowrap', opacity: mark}}>1 week</div>
      </Camera>
      <div style={{position: 'absolute', top: 290, left: L.left, right: L.W - L.right, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 24}}>
        <Odo value={v} size={210} color={T.accent2} weight={800} />
        <span style={{fontFamily: F.display, fontWeight: 800, fontSize: 120, letterSpacing: '-0.035em', color: T.ink}}>in 10</span>
      </div>
      <SourceLine who={SURVEY} date={READ} top={530} at={4} size={36} />
    </>
  );
};

// ───────────── 2. the proof: twelve plants, six schedules ─────────────

const SHELF: Kind[] = ['leafy', 'snake', 'fern', 'cactus', 'fern', 'leafy', 'cactus', 'snake', 'snake', 'cactus', 'leafy', 'fern'];
/** The six schedules, two plants on each: six colours from the style. */
const SCHEDULE = [T.accent, T.accent2, T.danger, T.ink, T.muted, mixColor(T.accent, T.ink, 0.45)];

export const W2Shelf: React.FC = () => {
  const f = useF();
  const a = WORLD.shelf[0];
  const count0 = cue('proof', 3);
  const count1 = cue('proof', 9);
  const six = cue('proof', 11);
  const n = lerp(f, [count0, count1], [0, 12], (t) => t);
  return (
    <>
      <Backdrop a={T.accent2} b={T.accent} />
      <Camera keys={[at(a, 540, 700, 1), at(WORLD.shelf[1], 540, 720, 1.05)]} aim={[540, 700]}>
        {[598, 770, 942].map((y) => (
          <Board key={y} y={y} x0={60} x1={1020} />
        ))}
        {SHELF.map((kind, i) => {
          const x = 195 + (i % 4) * 230;
          const y = 602 + Math.floor(i / 4) * 172;
          const t0 = mix(count0, count1, i / 12);
          const pop = p(f, t0, 12, EXPO);
          const tag = p(f, six + (i % 6) * 3, 12, EXPO);
          return (
            <React.Fragment key={i}>
              <Pot x={x} y={y} s={0.42} kind={kind} style={{opacity: Math.min(1, pop * 2), scale: `${mix(0.6, 1, pop)}`, transformOrigin: '50% 100%'}} />
              {tag > 0 && <div style={{position: 'absolute', left: x + 46, top: y - 74 - (1 - tag) * 40, width: 40, height: 40, borderRadius: 999, background: SCHEDULE[i % 6], boxShadow: `0 0 0 5px ${alpha(T.canvas, 0.8)}`, opacity: tag}} />}
            </React.Fragment>
          );
        })}
      </Camera>
      <div style={{position: 'absolute', top: 290, left: L.left, right: L.W - L.right, display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 56, fontFamily: F.display, fontWeight: 800, letterSpacing: '-0.03em'}}>
        <span style={{display: 'inline-flex', alignItems: 'baseline', gap: 16}}>
          <Odo value={n} size={110} color={T.ink} weight={800} />
          <span style={{fontSize: 52, color: T.muted}}>plants</span>
        </span>
        <span style={{display: 'inline-flex', alignItems: 'baseline', gap: 16, opacity: p(f, six - 4, 10)}}>
          <Odo value={lerp(f, [six - 4, six + 20], [0, 6])} size={110} color={T.accent2} weight={800} />
          <span style={{fontSize: 52, color: T.muted}}>schedules</span>
        </span>
      </div>
    </>
  );
};

// ───────────── 3. the catch: a plant can't tell you ─────────────

/** The cracks the dry soil opens, as strokes on the soil's face (frame px around its centre). */
const CRACKS = Array.from({length: 7}, (_, i) => {
  const a = rnd(`ca${i}`, -1, 1) * 150;
  const l = rnd(`cl${i}`, 40, 85);
  return {x0: a, y0: rnd(`cy${i}`, -6, 6), x1: a + rnd(`cx${i}`, -1, 1) * l, y1: rnd(`cz${i}`, -10, 10)};
});

export const W3Soil: React.FC = () => {
  const f = useF();
  const a = WORLD.soil[0];
  const say = cue('silent', 2);
  const bubble = p(f, cue('silent', 0), 10, EXPO) * (1 - p(f, cue('silent', 6), 10));
  const dry = lerp(f, [cue('late', 3), cue('late', 6)], [0.15, 0.9]);
  const crack = p(f, cue('late', 6), 40);
  const days = lerp(f, [cue('late', 9), cue('late', 12) + 10], [0, 4], (t) => t);
  // the soil's centre on screen: the pot at s 1.6 stands on y 940, its soil 112 viewBox px under its top edge
  const sx = 540;
  const sy = 940 - (320 - 208) * 1.6;
  return (
    <>
      <Backdrop a={T.accent2} b={T.danger} hi={0.26} />
      {/* a low sun from the right, one beam across the pot */}
      <div style={{position: 'absolute', left: 260, top: 180, width: 900, height: 1000, background: `linear-gradient(115deg, ${alpha(T.accent2, 0)} 30%, ${alpha(T.accent2, 0.1)} 48%, ${alpha(T.accent2, 0)} 66%)`}} />
      <Camera keys={[at(a, 540, 700, 1), at(cue('late', 0), 540, 700, 1.02), at(cue('late', 8), sx, sy - 60, 1.28), at(WORLD.soil[1], sx, sy - 50, 1.32)]} aim={[540, 640]}>
        <Board y={944} x0={0} x1={1080} />
        <Pot x={540} y={940} s={1.6} kind="leafy" dry={dry} />
        <svg width={420} height={60} viewBox="-210 -30 420 60" style={{position: 'absolute', left: sx - 210, top: sy - 30, overflow: 'visible'}}>
          {CRACKS.map((c, i) => (
            <line key={i} x1={c.x0 * 0.6} y1={c.y0} x2={mix(c.x0, c.x1, crack) * 0.6} y2={mix(c.y0, c.y1, crack)} stroke={alpha('#000000', 0.55)} strokeWidth={3} strokeLinecap="round" opacity={crack > 0 ? 1 : 0} />
          ))}
        </svg>
        {/* it cannot say it: an empty speech bubble rises from the leaves and closes, unsaid */}
        {bubble > 0 && (
          <div style={{position: 'absolute', left: 600, top: 470 - bubble * 30, width: 230, height: 130, borderRadius: 60, background: D_BUBBLE, opacity: bubble, scale: `${mix(0.4, 1, bubble)}`, transformOrigin: '10% 100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{width: 22, height: 22, borderRadius: 99, background: T.muted, opacity: lerp(f, [say + k * 8, say + k * 8 + 6], [0.2, 1])}} />
            ))}
          </div>
        )}
      </Camera>
      {/* the style's device: days since water, top right, rolling as the days pass */}
      <div style={{position: 'absolute', top: 290, right: L.W - L.right, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, fontFamily: F.text}}>
        <span style={{fontSize: 36, fontWeight: 600, color: T.muted}}>days since water</span>
        <Odo value={days} size={110} color={days > 0.5 ? T.danger : T.muted} weight={800} />
      </div>
    </>
  );
};
const D_BUBBLE = mixColor(T.panel, T.ink, 0.12);
