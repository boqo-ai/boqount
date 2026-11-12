// The stage: the one world (World.tsx) through the one travelling camera (timeline.ts CAMERA), for the whole film,
// and over the camera the words of lines 2–4 and the three full-frame hits.
//   line 1  "Your plant is thirsty."  (the hook layer's words) the camera pushes in on the dry soil, cracks open.
//   line 2  "It can't tell you."      the drooping leaf shivers on "tell"; on "you." it lets go (hit 1, the loss)
//                                      and the camera tilts down after it as it falls past the sill.
//   line 3  "Quillfern remembers."    the phone wakes, the reminder slides in, the phone buzzes: the camera pushes
//                                      in on the card.
//   line 4  "You water it on time."   the camera pushes onto Done: a finger taps it, the check draws, the count
//                                      rolls back to 0; the card's drop flies to the pot with the camera after it
//                                      and lands on "time." (hit 2); the leaves lift one by one and the camera pulls
//                                      out to the whole plant standing; a new leaf unfurls (hit 3, the one burst).
//   line 5  "A week later…"           (the hook layer's words) the days roll by, a night for each; the soil dries;
//                                      the camera drifts, then pushes in again through frame 0.
// The headlines take the slot one at a time; each leaves before the next one's first word.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {shake} from '../../lib/anim';
import {useF} from '../../lib/scene';
import {D, T, alpha} from '../../lib/theme';
import {Headline} from '../../kit/Kit';
import {Hit} from '../../kit/Fx';
import {Camera, camAt, toScreen} from '../../kit/Camera';
import {World} from './World';
import {FALLER, IMPACT, LEAVES, S, SOIL} from './layout';
import {BURST, CAMERA, DURATION, FALL, LAND, SEAM0, WIDE, cue, night, story} from './timeline';

/** Where the hits' rings start: the stem the leaf falls from, the soil where the water lands. */
const FALL_AT = toScreen(camAt(CAMERA, FALL, DURATION), SOIL[0] + LEAVES[FALLER].dx * S, SOIL[1]);
const LAND_AT = toScreen(camAt(CAMERA, LAND, DURATION), IMPACT[0], IMPACT[1]);

export const Stage: React.FC = () => {
  const f = useF();
  const g = story(f);
  const [sx, sy] = shake(f, FALL, 16, 10, 'loss');
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{translate: `${sx}px ${sy}px`}}>
        <Camera keys={CAMERA} loop={DURATION} rest={WIDE}>
          <World g={g} />
        </Camera>
        {/* each night of the week dims the room */}
        <AbsoluteFill style={{background: alpha(D.deep, 0.35 * night(g))}} />
      </AbsoluteFill>
      {/* a soft shade under the headline slot, so the words read over any part of the world */}
      <AbsoluteFill style={{background: `linear-gradient(${alpha(T.canvas, 0.72)} 0px, ${alpha(T.canvas, 0.5)} 560px, ${alpha(T.canvas, 0)} 780px)`}} />
      <Headline
        out={cue('turn', 0) - 18}
        lines={[
          [
            {t: 'It', at: cue('stake', 0)},
            {t: "can't", at: cue('stake', 1)},
          ],
          [
            {t: 'tell', at: cue('stake', 2)},
            {t: 'you.', at: cue('stake', 3), tone: 'muted'},
          ],
        ]}
      />
      <Headline out={cue('payoff', 0) - 16} lines={[[{t: 'Quillfern', at: cue('turn', 0), tone: 'accent'}], [{t: 'remembers.', at: cue('turn', 1)}]]} />
      <Headline
        out={SEAM0 - 30}
        lines={[
          [
            {t: 'You', at: cue('payoff', 0)},
            {t: 'water', at: cue('payoff', 1)},
            {t: 'it', at: cue('payoff', 2)},
          ],
          [
            {t: 'on', at: cue('payoff', 3)},
            {t: 'time.', at: cue('payoff', 4), tone: 'accent'},
          ],
        ]}
      />
      {/* the three full-frame hits: the loss, the water landing, the new leaf */}
      <Hit at={FALL} tone="danger" x={FALL_AT[0]} y={FALL_AT[1]} strength={0.6} />
      <Hit at={LAND} tone="accent" x={LAND_AT[0]} y={LAND_AT[1]} strength={0.8} />
      <Hit at={BURST} tone="accent2" ring={false} strength={0.7} />
    </AbsoluteFill>
  );
};
