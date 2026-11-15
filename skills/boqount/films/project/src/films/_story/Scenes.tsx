// A story film runs once (film.md → The story format). One world for each of the ten parts, each brought in on a
// spoken word by the move MOVES names (kit/WorldChange.tsx); the captions are one layer over every world and carry
// the film on mute; the last world is the call, shown (kit/Call.tsx), held to the end. No seam, no hook drawn twice.
//
// Each world below is a stand-in: two colours of its own, its part's name, and where the picture goes. Replace each
// with the part's one picture, readable in a second (a counter, three cards, a crowd, a bar, a screen), showing the
// sentence as it is said, inside the picture's part of the frame (L.top to CAPTION.top): nothing is drawn in the
// caption band. Inside a world, the old rules hold: one camera (kit/Camera.tsx), things carried and transformed.
import React from 'react';
import {Call} from '../../kit/Call';
import {CAPTION, Captions} from '../../kit/Captions';
import {Odo} from '../../kit/Fx';
import {SourceLine} from '../../kit/Kit';
import {World} from '../../kit/WorldChange';
import {lerp} from '../../lib/anim';
import {Scene, useF} from '../../lib/scene';
import {F, L, T, alpha} from '../../lib/theme';
import {CALL_AT, CODE, DURATION, MOVES, PARTS, PHRASES, SOURCE, WORLDS, cueOf, wordOf} from './timeline';

/** Each world's two colours (style tokens): change them so no two worlds side by side share both. */
const COLOURS: [string, string][] = [
  [T.accent2, T.danger],
  [T.accent, T.accent2],
  [T.danger, T.muted],
  [T.muted, T.accent2],
  [T.accent, T.ink],
  [T.accent2, T.muted],
  [T.danger, T.accent],
  [T.accent, T.panel],
  [T.accent, T.accent2],
  [T.accent, T.canvas],
];

const Backdrop: React.FC<{a: string; b: string}> = ({a, b}) => (
  <div style={{position: 'absolute', inset: 0, background: `radial-gradient(90% 45% at 50% 22%, ${alpha(a, 0.22)}, ${alpha(a, 0)} 70%), radial-gradient(110% 40% at 50% 92%, ${alpha(b, 0.16)}, ${alpha(b, 0)} 70%), ${T.canvas}`}} />
);

/** A stand-in for a part's picture: its number and name where the picture goes. */
const StandIn: React.FC<{k: number}> = ({k}) => (
  <div style={{position: 'absolute', left: L.left, right: L.W - L.right, top: L.top + 120, height: CAPTION.top - L.top - 240, borderRadius: T.radius, boxShadow: `inset 0 0 0 3px ${alpha(T.ink, 0.15)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: F.text, color: T.muted}}>
    <span style={{fontSize: 44, fontWeight: 700}}>{`${k + 1} · ${PARTS[k]}`}</span>
    <span style={{fontSize: 36}}>one picture, readable in a second</span>
  </div>
);

/** Part 1: the number, already moving on frame 0, its source under it by 0.5 s. EDIT the number and its unit. */
const Hook: React.FC = () => {
  const f = useF();
  return (
    <>
      <div style={{position: 'absolute', top: L.top + 20, left: L.left, right: L.W - L.right, display: 'flex', justifyContent: 'center'}}>
        <Odo value={lerp(f, [0, 60], [60, 90])} size={210} color={T.accent2} weight={800} suffix="%" />
      </div>
      <SourceLine who={SOURCE.who} date={SOURCE.date} top={L.top + 270} at={4} />
    </>
  );
};

export const Scenes: React.FC<{slug: string}> = () => (
  <>
    {WORLDS.map((span, k) => (
      <World key={k} name={`${k + 1} ${PARTS[k]}`} span={span} inn={k > 0 ? MOVES[k - 1] : undefined} out={k < WORLDS.length - 1 ? MOVES[k] : undefined}>
        <Backdrop a={COLOURS[k][0]} b={COLOURS[k][1]} />
        {k === 0 && <Hook />}
        {k > 0 && k < PARTS.length - 1 && <StandIn k={k} />}
        {k === PARTS.length - 1 && <Call code={CODE} type={CALL_AT.type} send={CALL_AT.send} reply={CALL_AT.reply} from={span[0]} end={DURATION} />}
      </World>
    ))}
    <Scene name="Captions" from={0} to={DURATION}>
      <Captions phrases={PHRASES} cue={cueOf} word={wordOf} />
    </Scene>
  </>
);
