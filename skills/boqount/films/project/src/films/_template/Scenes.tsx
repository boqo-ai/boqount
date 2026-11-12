// One continuous piece with no cuts, in two layers.
//   The stage runs the whole film (0 → DURATION): the world, seen through one travelling Camera (kit/Camera.tsx)
//   whose keys are timeline.ts's CAMERA. Draw the world in world px and the carried object from story time; put each
//   line's beats on it, one after another, each anchored to a cue, and move the camera onto each one. One object,
//   carried, never cut away from.
//   The hook layer (Hook.tsx) draws frame 0 and the hook (0 → HOOK_END), and is drawn a second time over the tail
//   (SEAM0 → DURATION) shifted by -DURATION, so the film's last frame is the hook's frame -1: the loop. Its headlines
//   are drawn over the camera, so they stay put and inside the safe zone while the camera moves.
//   Over both, two optional parts: the series mark of an episode (timeline.ts SERIES), and the source line under a
//   thing that states an outside fact (below, in Stage).
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Card, Progress, SeriesMark} from '../../kit/Kit';
// import {SourceLine} from '../../kit/Kit';
import {AIM, Camera, Depth} from '../../kit/Camera';
import {Scene, useF} from '../../lib/scene';
import {D, T, alpha} from '../../lib/theme';
import {Hook} from './Hook';
import {CAMERA, DURATION, HOOK_END, SEAM0, SERIES, swing} from './timeline';
// import {cueAt} from './timeline';

/** The carried object, a stand-in: a card where the camera looks, swinging once per film. Replace it with the film's
 * own object, drawn from story time alone. */
const W = 640;
const Hh = 360;
const Carried: React.FC<{g: number}> = ({g}) => {
  const s = swing(g);
  const r = {x: AIM[0] - W / 2, y: AIM[1] - Hh / 2, w: W, h: Hh};
  return (
    <Card r={r} style={{rotate: `${s * 3}deg`, scale: `${1 + s * 0.02}`}}>
      <Progress r={{x: 60, y: Hh - 100, w: W - 120, h: 28}} value={0.5 + 0.4 * s} />
    </Card>
  );
};

/** A far layer, a stand-in for the world's background: a field of dots that moves less than the world as the camera
 * travels (parallax). Replace it with the film's own room, sky or wall. */
const Field: React.FC = () => (
  <div style={{position: 'absolute', left: -540, top: -480, width: 2160, height: 2880, backgroundImage: `radial-gradient(${D.line} 3px, ${alpha(T.ink, 0)} 3.5px)`, backgroundSize: '90px 90px'}} />
);

const Stage: React.FC = () => {
  const f = useF();
  return (
    <AbsoluteFill>
      <Camera keys={CAMERA} loop={DURATION}>
        <Depth z={0.5}>
          <Field />
        </Depth>
        <Carried g={f} />
      </Camera>
      {/* OPTIONAL: a line that states an outside fact (a figure, a study, a date) shows its source under the thing it
          belongs to, from that line's cue, with the date it was read; over the camera, so it stays in the safe zone.
          To switch it on, take the line below out of this comment and the two imports marked above out of theirs.
      <SourceLine who="<who published it>" date="<the date read>" top={AIM[1] + 200} at={cueAt(1, 0)} out={cueAt(2, 0) - 10} /> */}
    </AbsoluteFill>
  );
};

export const Scenes: React.FC<{slug: string}> = ({slug}) => (
  <>
    <Scene name="The stage: the world through the camera, every line" from={0} to={DURATION}>
      <Stage />
    </Scene>
    <Scene name="Frame 0 and the hook" from={0} to={HOOK_END}>
      <Hook slug={slug} />
    </Scene>
    <Scene name="The seam: the hook again, on the tail" from={SEAM0} to={DURATION} shift={-DURATION}>
      <Hook slug={slug} />
    </Scene>
    {/* an episode's series mark, whole from frame 0 to the last frame (timeline.ts SERIES) */}
    {SERIES && <SeriesMark series={SERIES.name} n={SERIES.n} />}
  </>
);
