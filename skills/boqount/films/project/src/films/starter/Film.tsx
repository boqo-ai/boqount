import React from 'react';
import {AbsoluteFill, getStaticFiles, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {T} from '../../lib/theme';
import {Scenes} from './Scenes';

// The soundtrack: public/audio/<slug>/mix.wav (voice + effects + music; vo.wav is the voice alone), copied there by
// the sync from ../<slug>/audio/. `slug` comes from index.ts through Root.tsx. The film renders silent until the
// file exists, so a new film can be drawn before its sound is built.
export const Film: React.FC<{slug: string}> = ({slug}) => {
  const audio = `audio/${slug}/mix.wav`;
  const hasAudio = getStaticFiles().some((s) => s.name === audio);
  return (
    <AbsoluteFill style={{background: T.canvas}}>
      <Scenes />
      {hasAudio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
