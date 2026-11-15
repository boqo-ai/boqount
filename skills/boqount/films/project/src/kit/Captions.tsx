// Captions that carry a film on mute: the story format's words on screen (film.md → The story format). Two or three
// words at a time, each word coming on at its own cue in cues.json, in heavy capitals, white, with the phrase's key
// word in an accent colour. One fixed place for the whole film: centred, the baseline at CAPTION.baseline (about
// 58 % down the frame, inside the safe area, above the bottom 35 % the feeds cover), on a soft dark plate so it reads
// over any picture. A phrase goes the moment the next one starts, so there are never two blocks; and nothing else
// is drawn in the band (CAPTION.top … CAPTION.bottom): the picture has the frame above it.
//
//   const PHRASES = phrasesOf(LINES, {hook: [2]});            // split every line into 2–3-word phrases
//   <Captions phrases={PHRASES} cue={cue} word={wordText} />  // over every world, from 0 to DURATION
//
// A phrase wider than CAPTION.width shrinks until it fits (measured on the loaded face, never guessed).
import React from 'react';
import {measureText} from '@remotion/layout-utils';
import {p} from '../lib/anim';
import type {Line} from '../lib/cues';
import {useFontsLoaded} from '../lib/fonts';
import {useF} from '../lib/scene';
import {F, L, T, alpha} from '../lib/theme';

/** The caption band (frame px). Baseline 58 % down; the band is the plate's extent, kept free of other text. */
export const CAPTION = {
  baseline: 1114,
  top: 960,
  bottom: 1210,
  /** Widest phrase, px: centred, it stays inside x 140–940, clear of the feeds' right-hand buttons. */
  width: 800,
  /** Design size of a phrase, px (96 to 130). A wider phrase shrinks to fit `width`, never below `min`. */
  size: 118,
  min: 84,
} as const;

/** A phrase: words `a`..`b` (inclusive) of line `line`; `keys` are the word indexes set in the accent. */
export type Phrase = {line: string; a: number; b: number; keys?: number[]; accent?: string};

/** A word comes on this many frames (BASE) before its cue: the eye is there as the ear hears it. */
const LEAD = 3;
const TRACK = -0.035; // em
const GAP = 0.26; // em, between words
const WEIGHT = 900;

/** Capitals as a caption sets them: quotes and a trailing comma or full stop dropped, ? ! … kept. */
const capWord = (w: string) => w.replace(/[“”"]/g, '').replace(/[.,;:]+$/, '').toUpperCase();

/** Every line split into phrases of at most `max` words and `chars` characters (so a phrase holds its design size
 * inside CAPTION.width instead of shrinking far: heavy capitals run about 0.7 em a letter), breaking after a word that
 * ends a clause (. , ; : ? !) and never leaving one word alone when two can share. `keys` names, per line id, the
 * word indexes to set in the accent. */
export const phrasesOf = (lines: Line[], keys: Record<string, number[]> = {}, max = 3, chars = 13): Phrase[] => {
  const out: Phrase[] = [];
  const len = (l: Line, a: number, b: number) => l.words.slice(a, b + 1).reduce((n, w) => n + capWord(w.word).length + 1, -1);
  for (const l of lines) {
    const n = l.words.length;
    let a = 0;
    while (a < n) {
      let b = Math.min(n - 1, a + max - 1);
      for (let i = a; i < b; i++) {
        if (/[.,;:?!…]$/.test(l.words[i].word)) {
          b = i;
          break;
        }
      }
      while (b > a && len(l, a, b) > chars) b--;
      // a single word left over at the end of the line joins its neighbour when that keeps the phrase within max
      // words and the characters allowed
      if (b === n - 2 && b - a + 1 < max && len(l, a, n - 1) <= chars) b = n - 1;
      const k = (keys[l.id] ?? []).filter((i) => i >= a && i <= b);
      out.push({line: l.id, a, b, keys: k});
      a = b + 1;
    }
  }
  return out;
};


export const Captions: React.FC<{
  phrases: Phrase[];
  /** The film's cue(line, word) → film frame (lib/cues.ts makeCues). */
  cue: (line: string, i: number) => number;
  /** The film's wordText(line, word). */
  word: (line: string, i: number) => string;
  /** The accent of a key word with no accent of its own (default: the style's accent). */
  accent?: string;
  size?: number;
}> = ({phrases, cue, word, accent = T.accent, size = CAPTION.size}) => {
  const f = useF();
  const fonts = useFontsLoaded();
  if (phrases.length === 0) return null;
  // The first phrase is up, whole, from frame 0; each later one from its first word's cue.
  const start = phrases.map((ph, k) => (k === 0 ? 0 : cue(ph.line, ph.a) - LEAD));
  let k = 0;
  for (let i = 0; i < phrases.length; i++) if (f >= start[i]) k = i;
  const ph = phrases[k];
  const words = Array.from({length: ph.b - ph.a + 1}, (_, i) => capWord(word(ph.line, ph.a + i))).filter((w) => w.length > 0);
  const measure = (s: number) =>
    words.reduce((sum, w, i) => sum + measureText({text: w, fontFamily: F.display, fontSize: s, fontWeight: WEIGHT, letterSpacing: `${TRACK}em`}).width + (i > 0 ? GAP * s : 0), 0);
  const fit = fonts ? Math.max(CAPTION.min, Math.min(size, (size * CAPTION.width) / Math.max(1, measure(size)))) : size;
  // The line box at line-height 1: the baseline sits about 0.82 em under its top.
  const top = CAPTION.baseline - 0.82 * fit;
  const plate = alpha('#000000', 0.5);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: CAPTION.top,
          height: CAPTION.bottom - CAPTION.top,
          background: `linear-gradient(to bottom, ${alpha('#000000', 0)}, ${plate} 34%, ${plate} 66%, ${alpha('#000000', 0)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: L.left,
          right: L.W - L.right,
          top,
          height: fit,
          display: 'flex',
          justifyContent: 'center',
          gap: `${GAP}em`,
          fontFamily: F.display,
          fontWeight: WEIGHT,
          fontSize: fit,
          lineHeight: 1,
          letterSpacing: `${TRACK}em`,
          whiteSpace: 'nowrap',
        }}
      >
        {words.map((w, i) => {
          const idx = ph.a + i;
          const at = k === 0 ? -100 : cue(ph.line, idx) - LEAD;
          const t = p(f, at, 6);
          const key = (ph.keys ?? []).includes(idx);
          return (
            <span
              key={`${k}-${i}`}
              style={{
                display: 'inline-block',
                color: key ? (ph.accent ?? accent) : '#ffffff',
                opacity: Math.min(1, t * 1.5),
                translate: `0 ${(1 - t) * 26}px`,
                scale: `${0.88 + 0.12 * t}`,
                transformOrigin: '50% 80%',
                textShadow: `0 5px 0 ${alpha('#000000', 0.42)}, 0 0 26px ${alpha('#000000', 0.55)}`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </>
  );
};
