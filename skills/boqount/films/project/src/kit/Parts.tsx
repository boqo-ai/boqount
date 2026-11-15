// More kit parts: interface pieces a film draws its product with (a pill, a toggle, an app window, a run of steps),
// and the rule that a headline leaves only once its words are said. Drawn only from the style tokens (lib/theme.ts),
// like everything in kit/. Times are BASE frames (lib/cues.ts); `t` props are 0 → 1 progress the scene computes.
import React from 'react';
import {bump, mix, p} from '../lib/anim';
import {useF} from '../lib/scene';
import {D, F, M, T, Tone, alpha, onTone} from '../lib/theme';
import {CHECK, Draw} from './Fx';

// ───────────────────────────── pill ─────────────────────────────

/** A pill: a tab, a chip, a filter, a status. `on` (0 → 1) fills it with `tone` as it is chosen, the ink flipping where
 * the fill reads; `press` (0 → 1) pushes it in a little, as a finger or the cursor does; `dot` puts a live dot before
 * the words (a status: live, recording, posted). Off, it is a quiet raised panel. */
export const Pill: React.FC<{children: React.ReactNode; on?: number; tone?: Tone; press?: number; dot?: boolean; size?: number; style?: React.CSSProperties}> = ({
  children,
  on = 0,
  tone = 'accent',
  press = 0,
  dot,
  size = 38,
  style,
}) => {
  const fill = on > 0.5 ? onTone(tone) : T.ink;
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.35,
        height: size * 2,
        padding: `0 ${size * 0.72}px`,
        borderRadius: 999,
        overflow: 'hidden',
        isolation: 'isolate',
        background: D.raised,
        boxShadow: `inset 0 0 0 2px ${D.line}`,
        color: fill,
        fontFamily: F.text,
        fontWeight: 650,
        fontSize: size,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        scale: `${1 - press * 0.06}`,
        ...style,
      }}
    >
      {/* the fill grows from the pill's centre, so choosing reads as one press, not a colour swap */}
      <span style={{position: 'absolute', inset: 0, borderRadius: 999, background: T[tone], scale: `${on}`, opacity: on > 0.001 ? 1 : 0, zIndex: -1}} />
      {dot && <span style={{width: size * 0.42, height: size * 0.42, borderRadius: 99, background: on > 0.5 ? onTone(tone) : T[tone]}} />}
      {children}
    </div>
  );
};

// ───────────────────────────── toggle ─────────────────────────────

/** A switch. `t` 0 → 1 slides the knob across and fills the track with `tone`. Width `w`, height 0.56 of it. */
export const Toggle: React.FC<{t: number; w?: number; tone?: Tone; style?: React.CSSProperties}> = ({t, w = 132, tone = 'accent', style}) => {
  const h = w * 0.56;
  const k = Math.min(1, Math.max(0, t));
  return (
    <div style={{position: 'relative', width: w, height: h, borderRadius: h, background: D.track, boxShadow: `inset 0 0 0 2px ${D.line}`, ...style}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: h, background: T[tone], opacity: k}} />
      <div
        style={{
          position: 'absolute',
          top: h * 0.12,
          left: mix(h * 0.12, w - h * 0.88, k),
          width: h * 0.76,
          height: h * 0.76,
          borderRadius: h,
          background: k > 0.5 ? onTone(tone) : T.ink,
          boxShadow: D.shadowSm,
        }}
      />
    </div>
  );
};

// ───────────────────────────── window ─────────────────────────────

/** An app or browser window: a title bar with three dots and the window's real title (the product's own words, re-read
 * on its screen: motion.md → Real labels), and the body. `dim` (0 → 1) sinks it behind what comes next. Sizes are film
 * px; place it with `style` (left, top) or inside a Camera world. */
export const Window: React.FC<{w: number; h: number; title?: string; dim?: number; children?: React.ReactNode; style?: React.CSSProperties}> = ({w, h, title, dim = 0, children, style}) => {
  const bar = Math.max(56, Math.round(w * 0.07));
  return (
    <div style={{position: 'absolute', width: w, height: h, borderRadius: T.radius + 6, background: T.panel, boxShadow: `inset 0 0 0 2px ${D.line}, ${D.shadow}`, overflow: 'hidden', ...style}}>
      <div style={{height: bar, display: 'flex', alignItems: 'center', gap: bar * 0.16, padding: `0 ${bar * 0.38}px`, borderBottom: `2px solid ${D.line}`, background: D.raised}}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{width: bar * 0.24, height: bar * 0.24, borderRadius: 99, background: alpha(T.ink, 0.22)}} />
        ))}
        {title && <span style={{marginLeft: bar * 0.18, fontFamily: F.text, fontWeight: 600, fontSize: Math.max(32, bar * 0.45), color: T.muted, letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>{title}</span>}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: bar + 2, bottom: 0}}>{children}</div>
      {dim > 0 && <div style={{position: 'absolute', inset: 0, background: T.canvas, opacity: dim}} />}
    </div>
  );
};

// ───────────────────────────── steps ─────────────────────────────

/** A run of steps, told the way a person tells them: each step's words, no numbers (script.md: no numbered list, in the
 * voice or on screen). Step i becomes the current one at `starts[i]`: it lifts and fills; a step that is done keeps a
 * drawn check. All of it leaves from `out`. A list, top to bottom, at `top`, in the safe area's width. */
export const Steps: React.FC<{labels: string[]; starts: number[]; out?: number; top: number; left?: number; size?: number; tone?: Tone}> = ({
  labels,
  starts,
  out,
  top,
  left = 110,
  size = 46,
  tone = 'accent',
}) => {
  const f = useF();
  const gone = out === undefined ? 0 : p(f, out, 12 * M.k, M.out);
  let k = -1;
  starts.forEach((s, i) => (f >= s ? (k = i) : null));
  return (
    <div style={{position: 'absolute', top, left, display: 'flex', flexDirection: 'column', gap: size * 0.5, opacity: 1 - gone, translate: `0 ${-gone * 40}px`}}>
      {labels.map((label, i) => {
        const tin = p(f, starts[i] ?? Infinity, 18 * M.k);
        const done = i < k ? p(f, starts[i + 1], 14 * M.k) : 0;
        const current = i === k;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: size * 0.45,
              opacity: tin,
              translate: `${(1 - tin) * 30}px 0`,
              scale: `${current ? bump(f, starts[i], 0.05) : 1}`,
              transformOrigin: '0% 50%',
            }}
          >
            <span
              style={{
                position: 'relative',
                width: size * 1.2,
                height: size * 1.2,
                borderRadius: 99,
                background: i <= k ? T[tone] : D.raised,
                boxShadow: i <= k ? undefined : `inset 0 0 0 2px ${D.line}`,
              }}
            >
              {done > 0 && <Draw d={CHECK} vb="0 0 1 1" t={done} w={size * 1.2} h={size * 1.2} stroke={onTone(tone)} sw={0.12} style={{position: 'absolute', inset: 0}} />}
            </span>
            <span style={{fontFamily: F.text, fontWeight: current ? 700 : 600, fontSize: size, letterSpacing: '-0.015em', color: i <= k ? T.ink : T.muted, whiteSpace: 'nowrap'}}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────────── a headline leaves once it is said ─────────────────────────────

/** The frame a Headline's `out` may start on: never before its last word has been said. `said` is the frame by which
 * that word is said, measured on the voice (pass the said time of the line's last word; null while the voice is not
 * measured yet); `planned` is the scene's own exit. The words stay `hold` frames (0.2 s) after the voice falls silent,
 * so a line is never seen leaving while it is still heard. */
export const headOut = (said: number | null, planned: number, hold = 12) => (said === null ? planned : Math.max(planned, Math.ceil(said + hold)));

