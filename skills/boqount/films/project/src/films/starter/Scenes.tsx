import React from 'react';
import {Scene} from '../../lib/scene';
import {Hook} from './Hook';
import {Stage} from './Stage';
import {DURATION, HOOK_END, SEAM0} from './timeline';

// One continuous piece with no cuts. The stage runs the whole film: the world through the one camera, drawn from
// story time (timeline.ts story()), which wraps at SEAM0 onto the same moment, so the picture loops by construction;
// the camera's keys loop on the film's frames. The hook layer draws the words of frame 0 and the hook (0 → HOOK_END)
// and is drawn a second time over the tail (SEAM0 → DURATION) shifted by -DURATION, so the film's last frame is the
// hook's frame -1: the words loop too.
export const Scenes: React.FC = () => (
  <>
    <Scene name="The world through the camera, and lines 2–4" from={0} to={DURATION}>
      <Stage />
    </Scene>
    <Scene name="Frame 0 and the hook" from={0} to={HOOK_END}>
      <Hook />
    </Scene>
    <Scene name="The seam: the hook again, on the tail" from={SEAM0} to={DURATION} shift={-DURATION}>
      <Hook />
    </Scene>
  </>
);
