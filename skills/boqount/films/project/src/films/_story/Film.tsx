import React from 'react';
import {AbsoluteFill, getStaticFiles, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {T} from '../../lib/theme';
import {Scenes} from './Scenes';

// The soundtrack: public/audio/<slug>/mix.wav, copied there by the sync from ../<slug>/audio/ (tools/mix.mjs builds
// it). `slug` comes from index.ts through Root.tsx. The film renders silent until the file exists, so it can be
// drawn before its sound is built.
export const Film: React.FC<{slug: string}> = ({slug}) => {
  const audio = `audio/${slug}/mix.wav`;
  const hasAudio = getStaticFiles().some((s) => s.name === audio);
  return (
    <AbsoluteFill style={{background: T.canvas}}>
      <Scenes slug={slug} />
      {hasAudio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
