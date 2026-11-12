// The phone propped on the sill, in world px: its lock screen holds the app's widget ("Days since water", an
// odometer) and, when the reminder fires, the notification ("Water your plant · Today, 9:00") with its Done disc.
// Asleep, the screen is dim (always on); it wakes for the reminder, its light spills onto the sill, it buzzes.
// Drawn from story time g alone. Its text is world px: it is read when the camera has pushed in (about 3×).
import React from 'react';
import {box, bump, lerp, p} from '../../lib/anim';
import {D, F, T, alpha, mixColor} from '../../lib/theme';
import {Done} from '../../kit/Kit';
import {Odo} from '../../kit/Fx';
import {BEZEL, CARD, DONE, DONE_C, ICON, PHONE, WIDGET} from './layout';
import {ASK, BUZZ, FINGER, LAUNCH, TAP, awake, buzz, days, doneT, note} from './timeline';
import {WATER} from './Plant';

/** A water drop pointing along `rot` (deg), centred on (x, y). */
export const Drop: React.FC<{x: number; y: number; size: number; rot?: number; color: string}> = ({x, y, size, rot = 0, color}) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 20 26" style={{position: 'absolute', left: x - size / 2, top: y - size * 0.75, rotate: `${rot}deg`, transformOrigin: '50% 58%', overflow: 'visible'}}>
    <path d="M 10 0 C 13 6 19 11 19 17 A 9 9 0 0 1 1 17 C 1 11 7 6 10 0 Z" fill={color} />
    <ellipse cx={7} cy={16} rx={2.2} ry={3.4} fill={alpha(T.ink, 0.55)} />
  </svg>
);

const SCREEN_W = PHONE.w - 2 * BEZEL;
const SCREEN_H = PHONE.h - 2 * BEZEL;
const text = (size: number, weight: number, color: string): React.CSSProperties => ({fontFamily: F.text, fontSize: size, fontWeight: weight, color, letterSpacing: '-0.01em', whiteSpace: 'nowrap', lineHeight: 1.15});

/** A fingertip's touch on the glass: it comes down on Done, presses, ripples, and lifts. World px. */
const Touch: React.FC<{g: number}> = ({g}) => {
  const come = p(g, FINGER, TAP - FINGER, (t) => 1 - Math.pow(1 - t, 3));
  const lift = p(g, TAP + 10, 16);
  if (come <= 0 || lift >= 1) return null;
  const press = lerp(g, [TAP - 3, TAP, TAP + 8], [0, 1, 0], (t) => t);
  const x = DONE_C[0] + (1 - come) * 70;
  const y = DONE_C[1] + (1 - come) * 110;
  const r = 24 * (1 + (1 - come) * 0.5) * (1 - press * 0.15);
  const rip = p(g, TAP, 24);
  return (
    <>
      {g >= TAP && rip < 1 && <div style={{position: 'absolute', left: DONE_C[0] - 26 - rip * 40, top: DONE_C[1] - 26 - rip * 40, width: 52 + rip * 80, height: 52 + rip * 80, borderRadius: 999, boxShadow: `inset 0 0 0 3px ${alpha(T.ink, 0.6 * (1 - rip))}`}} />}
      <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: 999, background: alpha(T.ink, 0.3 + press * 0.15), boxShadow: `inset 0 0 0 2.5px ${alpha(T.ink, 0.75)}, 0 6px 14px ${alpha(D.deep, 0.5)}`, opacity: come * (1 - lift)}} />
    </>
  );
};

export const Phone: React.FC<{g: number}> = ({g}) => {
  const on = awake(g);
  const n = note(g);
  const [bx, by] = buzz(g);
  const flying = g >= LAUNCH;
  const ring = Math.sin(Math.max(0, g - BUZZ) * 0.9) * 12 * (1 - p(g, BUZZ, 30, (t) => t)) * (g >= BUZZ ? 1 : 0);
  const ask = g >= ASK && g < ASK + 30 ? p(g, ASK, 30, (t) => t) : 0;
  const lit = 0.62 + 0.38 * on;
  const rel = (r: {x: number; y: number; w: number; h: number}) => ({...r, x: r.x - PHONE.x - BEZEL, y: r.y - PHONE.y - BEZEL});
  return (
    <>
      {/* its light on the sill, and its shadow */}
      <div style={{position: 'absolute', left: PHONE.x - 120, top: PHONE.y + PHONE.h - 30, width: PHONE.w + 240, height: 60, borderRadius: '50%', background: `radial-gradient(closest-side, ${alpha(mixColor(T.accent, T.ink, 0.5), 0.22 * on)}, ${alpha(T.accent, 0)})`}} />
      <div style={{position: 'absolute', left: PHONE.x + 10, top: PHONE.y + PHONE.h - 8, width: PHONE.w + 30, height: 18, borderRadius: '50%', background: alpha(D.deep, 0.8)}} />
      <div
        style={{
          ...box(PHONE),
          translate: `${bx}px ${by}px`,
          borderRadius: 40,
          background: D.deep,
          boxShadow: `inset 0 0 0 2.5px ${mixColor(T.panel, T.ink, 0.18)}, 0 0 ${90 * on}px ${alpha(T.accent, 0.16 * on)}, ${D.shadowSm}`,
        }}
      >
        <div style={{position: 'absolute', inset: BEZEL, borderRadius: 32, overflow: 'hidden', background: mixColor(D.deep, T.canvas, 0.5)}}>
          {/* the wallpaper, lit when it wakes */}
          <div style={{position: 'absolute', inset: 0, opacity: on, background: `linear-gradient(170deg, ${mixColor(T.canvas, T.accent, 0.2)}, ${T.canvas} 55%, ${mixColor(T.canvas, T.accent2, 0.1)})`}} />
          <div style={{position: 'absolute', left: SCREEN_W / 2 - 34, top: 12, width: 68, height: 20, borderRadius: 999, background: D.deep}} />
          {/* the widget: the count the app keeps */}
          <div style={{...box(rel(WIDGET)), borderRadius: 22, background: alpha(T.ink, 0.07), boxShadow: `inset 0 0 0 1.5px ${D.line}`, opacity: lit, padding: '14px 16px'}}>
            <div style={text(14, 600, T.muted)}>Days since water</div>
            <div style={{marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8}}>
              <Odo value={days(g)} size={58} color={days(g) > 6.5 ? mixColor(T.ink, T.accent2, 0.7) : T.ink} />
            </div>
          </div>
          {/* the reminder, sliding down onto the lock screen */}
          {n > 0.002 && (
            <div style={{...box(rel(CARD)), borderRadius: 22, background: mixColor(T.panel, T.ink, 0.1), boxShadow: `inset 0 0 0 1.5px ${D.line}, ${D.shadowSm}`, translate: `0 ${(1 - n) * -70}px`, opacity: Math.min(1, n * 1.6)}}>
              <div style={{position: 'absolute', left: 12, top: 12, width: ICON, height: ICON, borderRadius: 9, background: alpha(T.accent, 0.22), scale: `${bump(g, BUZZ, 0.18)}`, rotate: `${ring}deg`}}>
                {!flying && <Drop x={ICON / 2} y={ICON / 2 + 3} size={15} color={WATER} />}
              </div>
              <div style={{position: 'absolute', left: 12 + ICON + 8, top: 12, height: ICON, display: 'flex', alignItems: 'center', ...text(13, 600, T.muted)}}>Quillfern</div>
              <div style={{position: 'absolute', right: 14, top: 12, height: ICON, display: 'flex', alignItems: 'center', ...text(13, 500, T.muted)}}>now</div>
              <div style={{position: 'absolute', left: 14, top: 52, ...text(16, 700, T.ink)}}>Water your plant</div>
              <div style={{position: 'absolute', left: 14, top: 74, ...text(14, 500, T.muted)}}>Today, 9:00</div>
              <div style={{position: 'absolute', left: DONE_C[0] - CARD.x - DONE / 2, top: DONE_C[1] - CARD.y - DONE / 2}}>
                {ask > 0 && <div style={{position: 'absolute', inset: -ask * 14, borderRadius: 999, boxShadow: `inset 0 0 0 2.5px ${alpha(T.accent, 0.8 * (1 - ask))}`}} />}
                <Done size={DONE} t={doneT(g)} />
              </div>
            </div>
          )}
          <div style={{position: 'absolute', left: SCREEN_W / 2 - 50, top: SCREEN_H - 16, width: 100, height: 5, borderRadius: 999, background: alpha(T.ink, 0.3 + 0.3 * on)}} />
          {/* the glass */}
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(120deg, ${alpha(T.ink, 0.07)}, ${alpha(T.ink, 0)} 38%)`}} />
        </div>
      </div>
      <Touch g={g} />
    </>
  );
};
