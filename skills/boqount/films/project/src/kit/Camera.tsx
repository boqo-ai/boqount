// The travelling camera: a film is one continuous move through one world. The world is drawn once, in world
// coordinates (px, the same unit as the 1080×1920 frame), and the one camera travels over it: it pushes in on the
// thing a line names until its detail fills the frame, and pulls out to show the whole again. A push or a pull is a
// move of this camera, never a cut.
//
//   <Camera keys={[{at: 0, x: 540, y: 960, scale: 1}, {at: cue('turn', 0), x: 700, y: 1100, scale: 2.4}]}>
//     <Depth z={0.5}><Window /></Depth>      far: moves less than the world (parallax)
//     <Plant />                              the world plane (z = 1)
//     <Depth z={1.25}><Dust /></Depth>       near: moves more
//   </Camera>
//   <Headline … />                           over the camera: text that must stay in the safe area
//
// What a scene-writer needs to know:
// - A key is a film frame (BASE units, a cue() value) and a pose: the world point (x, y) the camera looks at, and its
//   zoom (scale 1 = one world px is one frame px). The camera rests on each key and eases to the next with the
//   style's `M.move` (or the key's own `ease`, which shapes the move that ARRIVES at it). Zoom is interpolated in log
//   space, so a push of 1 → 2 feels as even as 2 → 4.
// - `aim` is the frame point the looked-at world point lands on: by default the middle of the safe area under the
//   headline slot, so the subject sits where nothing covers it.
// - `loop` (the film's DURATION) makes the keys a circle: the last key eases into the first across the film's end,
//   so a move can run straight through frame 0 and the join cannot be seen.
// - Every value is a pure function of the fractional frame useF() gives, so the 120-samples-a-second render moves
//   smoothly: no rounding, no stepping.
// - The world is scaled as live layers (HTML, SVG), never as a picture of itself: text and strokes stay crisp at any
//   zoom. Do not put `will-change`, a filter or an <Img> snapshot of the world on it, which would rasterise it.
// - Text that must stay readable and inside the safe area (headlines, captions) goes OUTSIDE the camera, over it.
//   toScreen() gives the frame point of a world point, to pin a mark over the camera to something in the world.
import React, {createContext, useContext} from 'react';
import {AbsoluteFill} from 'remotion';
import {mix} from '../lib/anim';
import {useF} from '../lib/scene';
import {L, M} from '../lib/theme';

/** Where the camera looks (world px) and how close (1 = one world px per frame px). */
export type Pose = {x: number; y: number; scale: number};
/** A key of the camera's move: film frame `at` (BASE units) and the pose it holds there. */
export type CamKey = Pose & {at: number; ease?: (t: number) => number};

/** The frame point the looked-at world point lands on by default: the middle of the safe area below the headline. */
export const AIM: [number, number] = [L.W / 2, (L.headTop + 320 + L.bottom) / 2];

/** The camera's pose at frame t. With `loop`, the keys repeat every `loop` frames and the last eases into the first. */
export const camAt = (keys: CamKey[], t: number, loop?: number): Pose => {
  if (keys.length === 0) return {x: L.W / 2, y: L.H / 2, scale: 1};
  for (let i = 1; i < keys.length; i++) if (keys[i].at < keys[i - 1].at) throw new Error(`Camera: key ${i} (frame ${keys[i].at}) comes before key ${i - 1} (frame ${keys[i - 1].at})`);
  let ks = keys;
  let f = t;
  if (loop !== undefined && loop > 0) {
    const first = keys[0];
    const last = keys[keys.length - 1];
    f = first.at + ((((t - first.at) % loop) + loop) % loop);
    ks = [...keys, {...first, at: first.at + loop}];
    if (last.at - first.at >= loop) throw new Error(`Camera: the keys span ${last.at - first.at} frames, not less than the loop of ${loop}`);
  }
  if (f <= ks[0].at) return ks[0];
  const n = ks.length - 1;
  if (f >= ks[n].at) return ks[n];
  let i = 0;
  while (ks[i + 1].at <= f) i++;
  const a = ks[i];
  const b = ks[i + 1];
  const u = (b.ease ?? M.move)((f - a.at) / (b.at - a.at));
  return {x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), scale: Math.exp(mix(Math.log(a.scale), Math.log(b.scale), u))};
};

/** The frame point (px) where world point (wx, wy) is seen, for a camera at `pose`. */
export const toScreen = (pose: Pose, wx: number, wy: number, aim: [number, number] = AIM): [number, number] => [aim[0] + (wx - pose.x) * pose.scale, aim[1] + (wy - pose.y) * pose.scale];

type Ctx = {pose: Pose; rest: Pose};
const CamCtx = createContext<Ctx>({pose: {x: L.W / 2, y: L.H / 2, scale: 1}, rest: {x: L.W / 2, y: L.H / 2, scale: 1}});

/** The enclosing Camera's pose now, and its rest pose (where every Depth layer lines up). */
export const useCamera = () => useContext(CamCtx);

/** A world seen through one travelling camera. Children are placed in world px. `t` is the frame the keys are read
 * at (default: the film frame); `rest` is the pose at which every Depth layer lines up with the world (default: the
 * first key). */
export const Camera: React.FC<{keys: CamKey[]; loop?: number; aim?: [number, number]; rest?: Pose; t?: number; children: React.ReactNode}> = ({keys, loop, aim = AIM, rest, t, children}) => {
  const f = useF();
  const pose = camAt(keys, t ?? f, loop);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0', transform: `translate(${aim[0]}px, ${aim[1]}px) scale(${pose.scale}) translate(${-pose.x}px, ${-pose.y}px)`}}>
        <CamCtx.Provider value={{pose, rest: rest ?? keys[0] ?? pose}}>{children}</CamCtx.Provider>
      </div>
    </AbsoluteFill>
  );
};

/** A layer at depth `z` inside a Camera (directly, not inside another Depth): z < 1 is farther than the world and moves
 * and zooms less (a wall, a sky: 0.3–0.7), z > 1 is nearer and moves more (dust, a leaf in front: 1.1–1.4). At the
 * camera's rest pose it lines up with the world, so place it in world px like everything else. */
export const Depth: React.FC<{z: number; children: React.ReactNode}> = ({z, children}) => {
  const {pose, rest} = useCamera();
  // The layer sees its own camera: the rest pose moved z times as far, zoomed (scale / rest)^z. Inside the world's
  // transform, that is: translate(pose) · scale(sz / s) · translate(-layer centre).
  const sz = rest.scale * Math.pow(pose.scale / rest.scale, z);
  const cx = rest.x + (pose.x - rest.x) * z;
  const cy = rest.y + (pose.y - rest.y) * z;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0', transform: `translate(${pose.x}px, ${pose.y}px) scale(${sz / pose.scale}) translate(${-cx}px, ${-cy}px)`}}>
      {children}
    </div>
  );
};
