// The hook layer: the words of frame 0, the hook, and the loop's other half. Scenes.tsx draws it twice: at the head,
// where it reads film frames (hf = 0 … HOOK_END), and over the film's tail shifted by -DURATION, where it reads
// negative frames (hf = SEAM0 - DURATION … -1). The film's last frame is hf = -1 and frame 0 is hf = 0: one function
// of hf, so the words loop by construction. The world under them is the stage's, through the camera (Stage.tsx).
//   hf < 0   the seam: "A week later…" rises (the film's last line, left unfinished), then leaves, and the title
//            rises so that it is whole on frame 0 and finishes the sentence: "A week later… your plant is thirsty."
//   frame 0  finished and moving: the title is up, the camera is pushing in on the wilting plant, the count rolling.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Headline} from '../../kit/Kit';
import {cue, DURATION, HOOK_OUT} from './timeline';

export const Hook: React.FC = () => {
  // the seam's words, on the tail: their cues less one film length
  const seam = (i: number) => cue('seam', i) - DURATION;
  return (
    <AbsoluteFill>
      <Headline lines={[[{t: 'A', at: seam(0)}, {t: 'week', at: seam(1)}, {t: 'later…', at: seam(2), tone: 'muted'}]]} top={360} size={120} out={-44} />
      <Headline
        out={HOOK_OUT}
        lines={[
          [
            {t: 'Your', at: -26},
            {t: 'plant', at: -24},
          ],
          [
            {t: 'is', at: -21},
            {t: 'thirsty.', at: -19, hl: true},
          ],
        ]}
      />
    </AbsoluteFill>
  );
};
