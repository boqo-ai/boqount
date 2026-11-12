import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {K} from './cues';

// Scenes animate on absolute film frames in BASE units (cue() values). A Sequence offsets useCurrentFrame(), so the
// scene's own start is added back here, and the sample index is divided by K. Nothing else reads useCurrentFrame().
const StartCtx = createContext(0);

/** The film frame, in BASE units (fractional between samples). */
export const useF = () => useCurrentFrame() / K + useContext(StartCtx);

/** The enclosing Scene's first film frame. */
export const useStart = () => useContext(StartCtx);

/** A layer of the film over [from, to) BASE frames. `shift` is added to every frame its children read:
 * shift = -DURATION draws a layer a second time over the film's tail, where it reads negative frames (the loop). */
export const Scene: React.FC<{
  name: string;
  from: number;
  to: number;
  shift?: number;
  children: React.ReactNode;
}> = ({name, from, to, shift = 0, children}) => (
  <Sequence name={name} from={from * K} durationInFrames={Math.max(1, (to - from) * K)}>
    <StartCtx.Provider value={from + shift}>
      <AbsoluteFill style={{overflow: 'hidden', isolation: 'isolate'}}>{children}</AbsoluteFill>
    </StartCtx.Provider>
  </Sequence>
);

/** The film's slug, for what a film reads from its own folders (kit/Media.tsx: public/media/<slug>/). Root.tsx
 * provides it around every film. */
export const SlugCtx = createContext('');
export const useSlug = () => useContext(SlugCtx);
