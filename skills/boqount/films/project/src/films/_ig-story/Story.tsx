// An Instagram Story (production.md → Stories): a short animated video, never a still. 1080×1920, 8 to 15 s, the brand's
// tokens (lib/theme.ts) and faces. Every word is on screen within the first second: each element rises on its own beat,
// 0.3 s each, staggered in reading order, expo-out with no overshoot; then it holds. After 1 s only a decoration moves
// (the highlighter sweeping its word). Nothing idles, loops or drifts. The clock is cues.json (copied here by the sync
// from ../<slug>/audio/cues.json); `film.mjs sfx <slug>` puts the sounds on the same beats.
//
// THE WORDS are the person's, or a story idea they took, in the account's language and its voice (brand-book →
// Voice). The Line holds: no invented count. A word like "yesterday" or "right now" holds only on its day: the record
// says which. Write them in WORDS below; a line that does not fit its width is a line too long: shorten it, never
// shrink the type.
//
// THE LINK STICKER: with `"link": true` in cues.json, y 1300 to 1580 stays empty for the sticker the person adds in
// the app (above the story's own controls), and the arrow points down at it.
import React from 'react';
import {AbsoluteFill, getStaticFiles, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {EXPO, p} from '../../lib/anim';
import {sec} from '../../lib/cues';
import {useF} from '../../lib/scene';
import {D, F, HL, T, alpha} from '../../lib/theme';
import {Pill} from '../../kit/Parts';
import cues from './cues.json';

/** The words, in reading order. `hl` is the word of head2 the highlighter sweeps (it must be in head2). */
const WORDS = {
  pill: 'Thank you',
  head1: "Yesterday's post",
  head2: 'took off.',
  hl: 'took off.',
  status: 'Working on it',
  line1: 'So many of you came at once.',
  line2: 'Everyone gets in, one by one.',
  ask: 'Not sure where to start?',
  tap: 'Tap the link.',
};

type Beat = keyof typeof cues.beats;
const at = (b: Beat) => sec(cues.beats[b].t);
/** The story's length in BASE frames: a whole number of 30 fps frames. */
export const DURATION = Math.ceil(cues.duration * 30) * 2;
/** The band the link sticker takes. */
const STICKER = {top: 1300, bottom: 1580};
const RISE = 18; // frames, 0.3 s

/** Rises into place and fades in on its beat, then holds. */
const Rise: React.FC<{beat: Beat; dist?: number; children: React.ReactNode; style?: React.CSSProperties}> = ({beat, dist = 36, children, style}) => {
  const t = p(useF(), at(beat), RISE, EXPO);
  return <div style={{...style, opacity: t, translate: `0 ${(1 - t) * dist}px`}}>{children}</div>;
};

/** The highlighter: one box behind the word, tall enough for its descenders; the plain layer and the ink layer are the
 * same block, each clipped to its side of the sweep, so nothing pokes out. Read a full-size still of it before the
 * render. */
const Highlight: React.FC<{text: string; t: number}> = ({text, t}) => (
  <span style={{position: 'relative', display: 'inline-block', padding: '0.04em 0.18em 0.16em', margin: '-0.04em -0.18em -0.16em', lineHeight: 1}}>
    <span style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${t * 100}%`, background: HL.fill, borderRadius: '0.16em'}} />
    <span style={{position: 'relative', display: 'block', color: T.muted, clipPath: `inset(-40% 0 -40% ${t * 100}%)`}}>{text}</span>
    <span style={{position: 'absolute', left: '0.18em', top: '0.04em', display: 'block', color: HL.ink, clipPath: `inset(-40% ${(1 - t) * 100}% -40% -0.2em)`}}>{text}</span>
  </span>
);

const Story: React.FC = () => {
  const f = useF();
  const card = p(f, at('card'), 22, EXPO);
  const ring = p(f, at('status'), 40, EXPO);
  const hl = p(f, at('hl'), 24, EXPO);
  const pill = p(f, at('pill'), RISE, EXPO);
  const [before, after] = WORDS.head2.split(WORDS.hl);
  return (
    <AbsoluteFill style={{background: T.canvas, fontFamily: F.text, color: T.ink, letterSpacing: '-0.03em'}}>
      <div style={{position: 'absolute', left: 90, right: 90, top: 270}}>
        <div style={{opacity: pill, translate: `0 ${(1 - pill) * 30}px`, scale: `${0.92 + 0.08 * pill}`, transformOrigin: 'left center'}}>
          <Pill on={1} size={38}>
            {WORDS.pill}
          </Pill>
        </div>
        <div style={{marginTop: 44, fontFamily: F.display, fontWeight: 700, fontSize: 104, lineHeight: 1.04}}>
          <Rise beat="head1" dist={44}>{WORDS.head1}</Rise>
          <Rise beat="head2" dist={44}>
            {before}
            <Highlight text={WORDS.hl} t={hl} />
            {after}
          </Rise>
        </div>
        <div style={{marginTop: 52, background: T.panel, boxShadow: `inset 0 0 0 2px ${D.line}`, borderRadius: T.radius * 1.6, padding: '48px 52px', opacity: card, translate: `0 ${(1 - card) * 50}px`, scale: `${0.97 + 0.03 * card}`}}>
          <Rise beat="status" dist={20} style={{display: 'flex', alignItems: 'center', gap: 20, marginBottom: 30, fontWeight: 700, fontSize: 34, color: T.accent2, letterSpacing: '-0.01em'}}>
            <span style={{position: 'relative', width: 22, height: 22}}>
              <span style={{position: 'absolute', inset: 0, borderRadius: '50%', background: T.accent2}} />
              {/* one ring, once: it spreads and is gone; nothing pulses on a loop */}
              <span style={{position: 'absolute', inset: -ring * 22, borderRadius: '50%', border: `3px solid ${T.accent2}`, opacity: (1 - ring) * 0.8}} />
            </span>
            {WORDS.status}
          </Rise>
          <Rise beat="line1" dist={24} style={{fontWeight: 600, fontSize: 44, lineHeight: 1.22}}>
            {WORDS.line1}
          </Rise>
          <Rise beat="line2" dist={24} style={{marginTop: 24, fontWeight: 600, fontSize: 44, lineHeight: 1.22, color: T.muted}}>
            {WORDS.line2}
          </Rise>
        </div>
        <div style={{marginTop: 60, fontFamily: F.display, fontWeight: 700, fontSize: 58, lineHeight: 1.1}}>
          <Rise beat="ask" dist={40}>{WORDS.ask}</Rise>
          <Rise beat="tap" dist={40} style={{color: T.muted}}>
            {WORDS.tap}
          </Rise>
        </div>
      </div>
      {cues.link && (
        <Rise beat="arrow" dist={-30} style={{position: 'absolute', left: 90, top: STICKER.top - 96}}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <path d="M32 8 V50 M14 34 L32 52 L50 34" fill="none" stroke={T.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Rise>
      )}
    </AbsoluteFill>
  );
};

/** The sticker's band, tinted, for a still checked with --safe: nothing of the story may be drawn in it. */
const StickerBand: React.FC = () => <div style={{position: 'absolute', left: 0, right: 0, top: STICKER.top, height: STICKER.bottom - STICKER.top, background: alpha(T.danger, 0.25)}} />;

export const Film: React.FC<{slug: string; safe?: boolean}> = ({slug, safe}) => {
  const audio = `audio/${slug}/mix.wav`;
  const hasAudio = getStaticFiles().some((s) => s.name === audio);
  return (
    <AbsoluteFill style={{background: T.canvas}}>
      <Story />
      {safe && cues.link && <StickerBand />}
      {hasAudio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
