// The hook layer: frame 0, the hook, and the loop's other half. Scenes.tsx draws it twice: at the head, where it
// reads film frames (hf = 0 … HOOK_END), and over the film's tail shifted by -DURATION, where it reads negative
// frames (hf = SEAM0 - DURATION … -1). The last frame is hf = -1 and frame 0 is hf = 0: one function of hf, so the
// loop is continuous by construction.
//   hf < 0   the seam: the film's last line (left unfinished) and the title rising, so it is whole on frame 0.
//   frame 0  finished and moving: the title is up, the carried object already in motion (Scenes.tsx's stage).
//   hf ≥ 0   the title holds while its line is read, and leaves from HOOK_OUT.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Headline, HW} from '../../kit/Kit';
import {L, M} from '../../lib/theme';
import {HOOK_OUT, HOOK_WORDS, SERIES} from './timeline';

/** Words per headline row. */
const ROW = 3;

export const Hook: React.FC<{slug: string}> = ({slug}) => {
  const ws = HOOK_WORDS.length ? HOOK_WORDS : [slug];
  // Each word rises 3 frames after the one before it, the last one landing just before frame 0.
  const land = 2 - 18 * M.k;
  // The word that carries the hook can be set on the highlighter instead: give it `hl: true` (kit Headline). Once per
  // film at most; other key words are tinted (`tone`).
  const words: HW[] = ws.map((t, i) => ({t, at: land - 3 * (ws.length - 1 - i)}));
  const rows = Array.from({length: Math.ceil(words.length / ROW)}, (_, r) => words.slice(r * ROW, r * ROW + ROW));
  return (
    <AbsoluteFill>
      <Headline lines={rows} out={HOOK_OUT} top={SERIES ? L.headTopMarked : L.headTop} />
    </AbsoluteFill>
  );
};
