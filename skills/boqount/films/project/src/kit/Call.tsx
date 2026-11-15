// The call, shown: the last world of a story film (film.md → The story format). The film's last line asks for one
// comment ("Comment <CODE>, and I'll send you the link."); the picture shows it happening. A comment field rises,
// the code word is typed letter by letter on its spoken word, sent on the next, and goes up to the top of the
// picture; then the brand's reply arrives under it, with its sender mark (the brand's logo file when the account has
// one, else a plain disc in the accent), and holds to the end. No logo card, no link on screen, and nothing in the
// caption band (kit/Captions.tsx CAPTION): the comment, the reply and the field fill the picture's part of the frame.
//
//   <Call code="PLANT" type={cue('cta', 1)} send={cue('cta', 2)} reply={cue('cta', 4)} />
import React from 'react';
import {INOUT, lerp, mix, p} from '../lib/anim';
import {useF} from '../lib/scene';
import {D, F, L, T, alpha, onTone} from '../lib/theme';
import {hasLogo, Logo} from './Logo';

const FIELD = {x: L.left, y: 760, w: L.right - L.left, h: 170};
const POSTED = {x: L.left, y: 300, h: 190};
const REPLY = {x: L.left, y: 530, w: L.right - L.left, h: 200};
/** Frames (BASE) between two typed letters. */
const PER_LETTER = 4;

/** A plain round avatar for the viewer's own comment: no person, no face. */
const You: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, borderRadius: 999, background: D.raised, boxShadow: `inset 0 0 0 3px ${D.line}`, flex: 'none', position: 'relative', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: '50%', top: '24%', width: size * 0.34, height: size * 0.34, translate: '-50% 0', borderRadius: 999, background: T.muted}} />
    <div style={{position: 'absolute', left: '50%', top: '66%', width: size * 0.62, height: size * 0.5, translate: '-50% 0', borderRadius: 999, background: T.muted}} />
  </div>
);

/** The brand's mark as the reply's sender: its logo file, or a disc in the accent. */
const Sender: React.FC<{size: number}> = ({size}) =>
  hasLogo() ? (
    <div style={{width: size, height: size, borderRadius: size * 0.24, background: T.panel, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none'}}>
      <Logo height={size * 0.7} />
    </div>
  ) : (
    <div style={{width: size, height: size, borderRadius: size * 0.24, background: T.accent, flex: 'none'}} />
  );

export const Call: React.FC<{
  /** The code word, as the caption sets it (capitals). */
  code: string;
  /** The film frame the code word is spoken on: typing starts here. */
  type: number;
  /** The frame the comment is sent on (the next word). */
  send: number;
  /** The frame the reply arrives on ("link"). */
  reply: number;
  /** The reply's words. */
  says?: string;
  /** The film's last frame, for the slow push that runs under the hold. */
  end: number;
  /** The world's first frame. */
  from: number;
}> = ({code, type, send, reply, says = 'Here’s your link', end, from}) => {
  const f = useF();
  const fieldIn = p(f, from, 12);
  const n = Math.max(0, Math.min(code.length, Math.floor((f - type) / PER_LETTER) + 1));
  const press = lerp(f, [send - 2, send + 2, send + 10], [0, 1, 0]);
  const up = p(f, send + 2, 16, INOUT);
  const fy = mix(430, FIELD.y, up);
  const re = p(f, reply - 1, 10);
  const ring = lerp(f, [reply, reply + 8, reply + 36], [0, 1, 0]);
  const push = lerp(f, [from, end], [1, 1.03]);
  const typed = f < type || up > 0.34 ? '' : code.slice(0, n);
  return (
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(120% 60% at 50% 30%, ${D.raised}, ${T.canvas})`}}>
      <div style={{position: 'absolute', inset: 0, scale: `${push}`, transformOrigin: '50% 33%'}}>
        {up > 0 && (
          <div style={{position: 'absolute', left: mix(FIELD.x + 18, POSTED.x, up), top: mix(420, POSTED.y, up), height: POSTED.h, display: 'flex', alignItems: 'center', gap: 30, opacity: Math.min(1, up * 3)}}>
            <You size={150} />
            <div style={{height: 170, padding: '0 60px', borderRadius: 56, background: D.raised, boxShadow: `inset 0 0 0 3px ${D.line}`, display: 'flex', alignItems: 'center', fontFamily: F.text, fontWeight: 800, fontSize: 104, letterSpacing: '-0.025em', color: T.ink}}>{code}</div>
          </div>
        )}
        {re > 0 && (
          <div
            style={{
              position: 'absolute',
              left: REPLY.x,
              top: REPLY.y + (1 - re) * 70,
              width: REPLY.w,
              height: REPLY.h,
              borderRadius: 60,
              background: D.raised,
              boxShadow: `inset 0 0 0 3px ${D.line}, 0 0 0 ${7 * ring}px ${alpha(T.accent, 0.55)}, ${D.shadow}`,
              opacity: Math.min(1, re * 2),
              display: 'flex',
              alignItems: 'center',
              padding: '0 40px',
              gap: 34,
              boxSizing: 'border-box',
            }}
          >
            <Sender size={130} />
            <div style={{fontFamily: F.text, fontWeight: 700, fontSize: 80, letterSpacing: '-0.03em', color: T.ink, whiteSpace: 'nowrap'}}>{says}</div>
            <div style={{marginLeft: 'auto', width: 30, height: 30, borderRadius: 99, background: T.accent, flex: 'none'}} />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: FIELD.x,
            top: fy + (1 - fieldIn) * 80,
            width: FIELD.w,
            height: FIELD.h,
            borderRadius: 999,
            background: T.panel,
            boxShadow: `inset 0 0 0 4px ${n > 0 && f >= type && up < 0.5 ? T.accent : D.line}`,
            opacity: fieldIn,
            display: 'flex',
            alignItems: 'center',
            padding: '0 22px 0 24px',
            gap: 28,
            boxSizing: 'border-box',
          }}
        >
          <You size={122} />
          <span style={{fontFamily: F.text, fontWeight: 800, fontSize: 92, letterSpacing: '-0.025em', color: T.ink}}>{typed}</span>
          <span style={{width: 6, height: 92, borderRadius: 6, background: T.accent, marginLeft: -16, opacity: Math.floor(f / 16) % 2 === 0 || (f >= type && f < send) ? 1 : 0.15}} />
          <div style={{marginLeft: 'auto', width: 126, height: 126, borderRadius: 99, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', scale: `${1 - 0.1 * press}`, flex: 'none'}}>
            <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke={onTone('accent')} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
