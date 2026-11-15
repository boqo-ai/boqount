// Worlds that change on a spoken word: the story format's scenes (film.md → The story format). Each world runs over
// [from, to) film frames; the change into it is a designed move of at most 0.4 s, or a hard cut on the word.
//
//   push  a pan: the old world travels out to the left as the new one travels in from the right, edge to edge
//   pull  the pan the other way: the old world travels out to the right as the new one comes in from the left
//
// Both are sideways: a world never passes through the caption band (kit/Captions.tsx CAPTION) on its way in.
//   cut   a hard cut on the word: the new world is simply there
//
// In a move both worlds are opaque and side by side, never one over the other: two worlds' words are never seen at
// once, and nothing fades, so a change never passes through black or white and never flashes (motion.md → Nothing
// flashes). Inside a world the old rules hold: one camera, things carried and transformed, no jump. The captions
// (kit/Captions.tsx) are drawn over every world and do not move with it.
//
//   const S = spans([0, cue('proof', 0) - 4, cue('catch', 0) - 4, DURATION]);   // where each world starts and ends
//   <World name="1 The number" span={S[0]} out="push"> … </World>
//   <World name="2 The proof" span={S[1]} inn="push" out="pull"> … </World>
import React from 'react';
import {INOUT, p} from '../lib/anim';
import {L} from '../lib/theme';
import {Scene, useF} from '../lib/scene';

export type Change = 'push' | 'pull' | 'cut';

/** Frames (BASE, 60 a second) a move takes: 0.27 s, ending on its mark, the old world leaving as the new one arrives. */
const MOVE = 16;
export const CHANGE = {out: MOVE, inn: MOVE} as const;

/** Each world's [from, to) from the frames its changes fall on (the first 0, the last DURATION): a world that arrives
 * by a move starts CHANGE.inn frames before its mark, travelling in beside the world before as that one leaves. */
export const spans = (marks: number[], moves: Change[] = []): (readonly [number, number])[] =>
  marks.slice(0, -1).map((m, i) => {
    const inn = i > 0 && (moves[i - 1] ?? 'push') !== 'cut' ? CHANGE.inn : 0;
    return [Math.max(0, m - inn), marks[i + 1]] as const;
  });

/** Where a world sits at film frame f: its offset (frame px), from the move that brings it in and the one that takes
 * it out. Both halves of a move run over the same frames with the same curve, so the two worlds stay edge to edge. A
 * world that is fully in returns null (drawn as it is). */
const offset = (f: number, from: number, to: number, inn: Change, out: Change) => {
  const tin = inn === 'cut' ? 1 : p(f, from, MOVE, INOUT);
  const tout = out === 'cut' ? 0 : p(f, to - MOVE, MOVE, INOUT);
  if (tin >= 1 && tout <= 0) return null;
  const side = (c: Change) => (c === 'push' ? 1 : c === 'pull' ? -1 : 0);
  return {x: side(inn) * (1 - tin) * L.W - side(out) * tout * L.W, y: 0};
};

/** One world of a story film, over [span[0], span[1]) film frames, brought in by `inn` and taken out by `out`. Pass
 * the change that actually happens on each side: the first world has no `inn`, the last no `out`. */
export const World: React.FC<{name: string; span: readonly [number, number]; inn?: Change; out?: Change; children: React.ReactNode}> = ({name, span, inn = 'cut', out = 'cut', children}) => (
  <Scene name={name} from={span[0]} to={span[1]}>
    <Moved from={span[0]} to={span[1]} inn={inn} out={out}>
      {children}
    </Moved>
  </Scene>
);

const Moved: React.FC<{from: number; to: number; inn: Change; out: Change; children: React.ReactNode}> = ({from, to, inn, out, children}) => {
  const f = useF();
  const o = offset(f, from, to, inn, out);
  if (!o) return <div style={{position: 'absolute', inset: 0}}>{children}</div>;
  return <div style={{position: 'absolute', inset: 0, translate: `${o.x}px ${o.y}px`}}>{children}</div>;
};
