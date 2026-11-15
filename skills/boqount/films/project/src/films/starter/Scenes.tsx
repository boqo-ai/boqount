import React from 'react';
import {Captions} from '../../kit/Captions';
import {World} from '../../kit/WorldChange';
import {Scene} from '../../lib/scene';
import {W1Number, W2Shelf, W3Soil} from './WorldsA';
import {W4Notes, W5Sill, W6Week, W7Pair} from './WorldsB';
import {W8App, W9Payoff, W10Call} from './WorldsC';
import {DURATION, MOVES, PHRASES, WORLD, cueOf, wordOf} from './timeline';

// A story film (story.md): it runs once. One world for each part, each change on a spoken word,
// by the move MOVES names (kit/WorldChange.tsx); the captions are one layer over every world and carry the film on
// mute. No loop: no seam, no hook drawn twice; the last world is the call, shown, held to the end.
export const Scenes: React.FC = () => (
  <>
    <World name="1 The number" span={WORLD.number} out={MOVES[0]}>
      <W1Number />
    </World>
    <World name="2 The proof" span={WORLD.shelf} inn={MOVES[0]} out={MOVES[1]}>
      <W2Shelf />
    </World>
    <World name="3 The catch" span={WORLD.soil} inn={MOVES[1]} out={MOVES[2]}>
      <W3Soil />
    </World>
    <World name="4 Who is left" span={WORLD.notes} inn={MOVES[2]} out={MOVES[3]}>
      <W4Notes />
    </World>
    <World name="5 Where you come in" span={WORLD.sill} inn={MOVES[3]} out={MOVES[4]}>
      <W5Sill />
    </World>
    <World name="6 What most do" span={WORLD.week} inn={MOVES[4]} out={MOVES[5]}>
      <W6Week />
    </World>
    <World name="7 The result, the turn" span={WORLD.pair} inn={MOVES[5]} out={MOVES[6]}>
      <W7Pair />
    </World>
    <World name="8 The product at work" span={WORLD.app} inn={MOVES[6]} out={MOVES[7]}>
      <W8App />
    </World>
    <World name="9 The payoff" span={WORLD.payoff} inn={MOVES[7]} out={MOVES[8]}>
      <W9Payoff />
    </World>
    <World name="10 The call" span={WORLD.call} inn={MOVES[8]}>
      <W10Call />
    </World>
    <Scene name="Captions" from={0} to={DURATION}>
      <Captions phrases={PHRASES} cue={cueOf} word={wordOf} />
    </Scene>
  </>
);
