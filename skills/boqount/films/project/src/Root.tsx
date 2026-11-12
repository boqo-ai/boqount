import React from 'react';
import {Composition} from 'remotion';
import {FPS} from './lib/cues';
import {L} from './lib/theme';
import './lib/fonts';
import {SafeArea} from './kit/Kit';
import {SlugCtx} from './lib/scene';
import {FILMS} from './films';

type Props = {slug: string; safe: boolean};

/** A film with, when the input prop `safe` is true, the safe-area overlay over it (for checking stills only:
 * `npm run still -- <Id> --frame=<n> --safe`). */
const framed = (Film: React.FC<{slug: string}>) => {
  const Framed: React.FC<Props> = ({slug, safe}) => (
    <SlugCtx.Provider value={slug}>
      <Film slug={slug} />
      {safe && <SafeArea />}
    </SlugCtx.Provider>
  );
  return Framed;
};
const COMPOSITIONS = FILMS.map((film) => ({...film, Framed: framed(film.component)}));

// One composition per film. Authored at 1080×1920 on a 60-unit time base, rendered at 120 samples a second and
// shipped at 60 fps with each pair blended (`npm run feed`).
export const RemotionRoot: React.FC = () => (
  <>
    {COMPOSITIONS.map((film) => (
      <Composition key={film.id} id={film.id} component={film.Framed} defaultProps={{slug: film.slug, safe: false}} durationInFrames={film.durationInFrames} fps={FPS} width={L.W} height={L.H} />
    ))}
  </>
);
