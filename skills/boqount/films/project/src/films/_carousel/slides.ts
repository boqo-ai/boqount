// The carousel's words, one entry per slide, in order (carousel.md). `*word*` marks the one word a slide leans on: in
// the accent where it reads on the slide's background, else on a highlighter behind it. A word left alone on its last
// line is held to its neighbour with a no-break space, written as the escape \u00a0 ("3\u00a0hours"), never fixed by
// shrinking the type. `source` is the small print under a slide whose claim comes from outside (its short, human name
// and date, kept in ../<slug>/sources.md with the exact quote); a slide with no outside claim has none.
//
// THESE WORDS ARE PLACEHOLDERS: they show the arc (carousel.md → The arc). Every slide follows from the one before;
// a slide you can delete without breaking the chain is fluff.

export type Bg = 'canvas' | 'ink';

export type Slide =
  | {kind: 'cover'; lines: string[]}
  | {kind: 'text'; bg: Bg; head: string; sub?: string; source?: string}
  | {kind: 'one'; bg: Bg; line: string; source?: string}
  | {kind: 'rows'; bg: Bg; head?: string; rows: {name: string; text: string; note?: string}[]; source?: string}
  | {kind: 'list'; bg: Bg; head: string; items: string[]}
  | {kind: 'end'; bg: Bg; lines: string[]};

export const SLIDES: Slide[] = [
  {kind: 'cover', lines: ['THE HOOK IN', 'FOUR SHORT', '*LINES* THAT', 'PULL A SWIPE…']},
  {kind: 'text', bg: 'ink', head: 'The problem, in one plain sentence.', sub: 'What it looks like in a *real* day of the person this is for.'},
  {kind: 'rows', bg: 'canvas', head: 'What it costs', rows: [
    {name: 'Time', text: 'The hours it *eats* each week.', note: 'a sourced figure'},
    {name: 'Money', text: 'What it *loses* them.', note: 'or an example, said as one'},
  ], source: 'Source name, month year'},
  {kind: 'one', bg: 'ink', line: 'So here is the *turn*.'},
  {kind: 'list', bg: 'canvas', head: 'What it does, in plain words:', items: ['Does the *first* thing', 'Then the second', 'And the third, on\u00a0its\u00a0own']},
  {kind: 'text', bg: 'ink', head: 'The payoff, as *their* gain.', sub: 'One line on what changes for them.'},
  {kind: 'end', bg: 'canvas', lines: ['THE LAST LINE.', 'THE CALL, ONLY', 'WHERE THE RULES', '*ALLOW* ONE.']},
];
