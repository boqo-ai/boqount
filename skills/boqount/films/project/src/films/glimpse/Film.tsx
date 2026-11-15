// The first look (onboarding.md → 2. Say it back, and show it): about 16 s, made from the person's own files minutes after the
// deep read, to show their brand moving before any question about it. It is a draft, never a post: no call, no link,
// no loop, and its top line says "first look · draft".
//
// Everything it shows comes from spec.json (copied by the sync from films/glimpse/glimpse.json, which the agent writes
// from the deep read's notes and `film.mjs glimpse` checks): the product's name, its own words, an optional short word
// or number from its own pages, each with its source; its colours and face when the files have them; its logo when
// there is one (films/glimpse/assets/logo.svg|png). With no colours the film is drawn in a neutral palette, with no
// logo the name is the mark: it never shows a stand-in.
//
// Four worlds, each changed by a sideways pan (kit/WorldChange.tsx), so two worlds' words are never on screen at once:
//   1  0.0–3.5 s   the opening: the short word or number (else the promise) huge, already moving on frame 0
//   2  3.5–7.0 s   the name: the logo, then the name across the frame, an accent rule drawn under it
//   3  7.0–13.3 s  the real things: the other lines as cards, one after another, the camera pushing in
//   4  13.3–16 s   the promise, held, the name small above it
import React from 'react';
import {AbsoluteFill, getStaticFiles, Img, staticFile} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {EXPO, INOUT, lerp, mix, p} from '../../lib/anim';
import {useFontsLoaded} from '../../lib/fonts';
import {useF} from '../../lib/scene';
import {L} from '../../lib/theme';
import {World, spans} from '../../kit/WorldChange';
import spec from './spec.json';

export type Said = {text: string; source: string};
export type Spec = {
  name: Said;
  opening?: Said | null;
  lines: Said[];
  colors?: {canvas: string; ink: string; accent: string; source: string} | null;
  font?: {family: string; source: string} | null;
  logo?: {source: string} | null;
};

/** Film frames (BASE, 60 a second). */
export const DURATION = 960;
const MARKS = [0, 210, 420, 800, DURATION];
const S = spans(MARKS, ['push', 'pull', 'push']);

// ───────────── the palette: the brand's three colours, or a neutral one ─────────────

const NEUTRAL = {canvas: '#111113', ink: '#F4F4F5', accent: '#F5C451'};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex6 = (h: string) => (h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h).toUpperCase();
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast ratio of two colours. */
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const mixHex = (a: string, b: string, t: number) => {
  const pa = rgb(a);
  const pb = rgb(b);
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
const rgba = (hex: string, a: number) => `rgba(${rgb(hex).join(',')},${a})`;

const SPEC = spec as Spec;
const base = SPEC.colors ? {canvas: hex6(SPEC.colors.canvas), ink: hex6(SPEC.colors.ink), accent: hex6(SPEC.colors.accent)} : NEUTRAL;
/** The accent carries type only where it reads on the canvas (3:1, large text); else the ink does. */
const C = {
  ...base,
  mark: contrast(base.accent, base.canvas) >= 3 ? base.accent : base.ink,
  muted: mixHex(base.ink, base.canvas, 0.42),
  panel: mixHex(base.canvas, base.ink, 0.07),
  line: rgba(base.ink, 0.12),
  deep: mixHex(base.canvas, '#000000', 0.45),
};
const FACE = `"${SPEC.font?.family ?? 'Inter'}", "Inter", system-ui, sans-serif`;
const TEXT = `"Inter", system-ui, sans-serif`;
const logoFile = () => getStaticFiles().find((s) => s.name === 'glimpse/logo.svg' || s.name === 'glimpse/logo.png')?.name;

// ───────────── setting a line: wrapped to at most n lines, as large as fits ─────────────

const W = L.right - L.left;
/** Space between words, em: Rise draws each word as its own block with this margin. */
const GAP = 0.24;
/** The words of `text` broken into at most `maxLines` lines no wider than `width` at the largest size from `max`
 * down to `min` that fits; measured on the loaded face, never guessed. */
const setLines = (text: string, width: number, maxLines: number, max: number, min: number, weight: number, family = FACE) => {
  const words = text.split(/\s+/).filter(Boolean);
  // measured as it is drawn (Rise): each word on its own, with GAP between them
  const one = (w: string, s: number) => measureText({text: w, fontFamily: family, fontSize: s, fontWeight: String(weight), letterSpacing: '-0.03em'}).width;
  const wide = (t: string, s: number) => t.split(' ').reduce((sum, w, i) => sum + one(w, s) + (i > 0 ? GAP * s : 0), 0);
  const wrap = (s: number) => {
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (!cur || wide(next, s) <= width) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  for (let s = max; s >= min; s -= 4) {
    const lines: string[] = [];
    let cur = '';
    let ok = true;
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (wide(next, s) <= width) cur = next;
      else {
        if (!cur || wide(w, s) > width) {
          ok = false;
          break;
        }
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (ok && lines.length <= maxLines) return {lines, size: s};
  }
  // too long for maxLines even at min: every line still broken by measure, never left to the browser to wrap
  return {lines: wrap(min), size: min};
};

// ───────────── pieces ─────────────

const Backdrop: React.FC<{glow: [number, number]; tone?: string}> = ({glow, tone = C.mark}) => {
  const f = useF();
  const dx = Math.sin(f / 140) * 60;
  return (
    <AbsoluteFill style={{background: C.canvas}}>
      <AbsoluteFill style={{background: `radial-gradient(900px 900px at ${glow[0] + dx}px ${glow[1]}px, ${rgba(tone, 0.16)}, ${rgba(tone, 0)} 70%)`}} />
      <Horizon />
    </AbsoluteFill>
  );
};

/** The lower third is picture, not empty: a wide arc of the brand's mark colour rising out of the bottom, turning
 * slowly, with the name set huge and faint along it. Nothing in it has to be read (the feeds cover that band). */
const Horizon: React.FC = () => {
  const f = useF();
  const turn = f * 0.05;
  const rise = lerp(f, [0, DURATION], [40, -30]);
  const R = 1250;
  const cy = L.H + 760 + rise;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: `radial-gradient(1100px 520px at 540px ${L.H - 120}px, ${rgba(C.mark, 0.22)}, ${rgba(C.mark, 0)} 70%)`}} />
      <svg width={L.W} height={L.H} style={{position: 'absolute', inset: 0}}>
        <g transform={`rotate(${turn} 540 ${cy})`}>
          <circle cx={540} cy={cy} r={R} fill="none" stroke={rgba(C.mark, 0.55)} strokeWidth={5} />
          <circle cx={540} cy={cy} r={R - 70} fill="none" stroke={rgba(C.ink, 0.12)} strokeWidth={2} strokeDasharray="4 22" />
          <circle cx={540} cy={cy} r={R + 90} fill="none" stroke={rgba(C.mark, 0.18)} strokeWidth={2} strokeDasharray="120 60" />
        </g>
      </svg>
      <div style={{position: 'absolute', left: -200 - (f * 0.6) % 600, top: L.H - 520, whiteSpace: 'nowrap', fontFamily: FACE, fontWeight: 900, fontSize: 300, letterSpacing: '-0.04em', color: rgba(C.ink, 0.045)}}>
        {`${SPEC.name.text}  ${SPEC.name.text}  ${SPEC.name.text}`}
      </div>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${rgba(C.deep, 0)} 70%, ${rgba(C.deep, 0.55)} 100%)`}} />
    </AbsoluteFill>
  );
};

/** A source, small and quiet, under what it backs. */
const Source: React.FC<{said: Said; y: number; at: number; align?: 'center' | 'left'; x?: number}> = ({said, y, at, align = 'center', x = L.left}) => {
  const f = useF();
  const o = p(f, at, 24, EXPO);
  return (
    <div style={{position: 'absolute', left: x, width: align === 'center' ? W : L.right - x, top: y, textAlign: align, fontFamily: TEXT, fontSize: 32, fontWeight: 500, color: C.muted, opacity: o, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
      {said.source}
    </div>
  );
};

/** Words that rise one by one from a mask, the `key` word in the accent. */
const Rise: React.FC<{lines: string[]; size: number; top: number; at: number; step?: number; weight?: number; color?: string; key0?: number; align?: 'center' | 'left'}> = ({lines, size, top, at, step = 5, weight = 800, color = C.ink, key0 = -1, align = 'center'}) => {
  const f = useF();
  let n = 0;
  return (
    <div style={{position: 'absolute', left: L.left, width: W, top, textAlign: align, fontFamily: FACE, fontWeight: weight, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.03em', color}}>
      {lines.map((ln, li) => (
        <div key={li} style={{overflow: 'hidden', paddingBottom: size * 0.08, whiteSpace: 'nowrap'}}>
          {ln.split(' ').map((w, wi) => {
            const k = n++;
            const t = p(f, at + k * step, 26, EXPO);
            return (
              <span key={wi} style={{display: 'inline-block', transform: `translateY(${(1 - t) * 110}%)`, color: k === key0 ? C.mark : undefined, marginLeft: wi > 0 ? `${GAP}em` : 0}}>
                {w}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ───────────── the four worlds ─────────────

/** 1: the opening, already moving on frame 0. */
const Opening: React.FC = () => {
  const f = useF();
  const fonts = useFontsLoaded();
  const said = SPEC.opening ?? SPEC.lines[0];
  const short = !!SPEC.opening;
  const set = fonts ? (short ? setLines(said.text, W, 2, 360, 120, 900) : setLines(said.text, W, 4, 150, 84, 850)) : {lines: [said.text], size: 120};
  const h = set.lines.length * set.size * 1.12;
  const top = (L.top + L.bottom) / 2 - h / 2 - 60;
  const push = lerp(f, [0, 210], [1, 1.08], [INOUT]);
  const words = said.text.split(/\s+/).length;
  return (
    <AbsoluteFill>
      <Backdrop glow={[540, 760]} />
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        {/* frame 0 is not empty: the first word is up already, the rest follow */}
        <Rise lines={set.lines} size={set.size} top={top} at={-24} step={short ? 0 : 6} weight={short ? 900 : 850} color={short ? C.mark : C.ink} key0={short ? -1 : words - 1} />
        <Source said={said} y={top + h + 30} at={30} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 2: the name, and the logo when there is one. */
const Name: React.FC = () => {
  const f = useF();
  const fonts = useFontsLoaded();
  const logo = logoFile();
  const set = fonts ? setLines(SPEC.name.text, W, 2, 230, 90, 900) : {lines: [SPEC.name.text], size: 160};
  const h = set.lines.length * set.size * 1.08;
  const logoH = 190;
  const block = (logo ? logoH + 60 : 0) + h;
  const top = (L.top + L.bottom) / 2 - block / 2 - 40;
  const at = S[1][0] - 6;
  const lt = p(f, at, 30, EXPO);
  const rule = p(f, at + 24, 40, EXPO);
  const zoom = lerp(f, [S[1][0], S[1][1]], [1.04, 1], [INOUT]);
  const nameTop = top + (logo ? logoH + 60 : 0);
  return (
    <AbsoluteFill>
      <Backdrop glow={[540, 640]} />
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        {logo && (
          <div style={{position: 'absolute', top, left: 0, width: L.W, display: 'flex', justifyContent: 'center', opacity: lt, transform: `translateY(${(1 - lt) * 40}px) scale(${mix(0.86, 1, lt)})`}}>
            <Img src={staticFile(logo)} style={{height: logoH, width: 'auto', maxWidth: W}} />
          </div>
        )}
        <Rise lines={set.lines} size={set.size} top={nameTop} at={at + (logo ? 10 : 0)} step={4} weight={900} />
        <div style={{position: 'absolute', left: L.W / 2 - 160, top: nameTop + h + 26, width: 320, height: 12, borderRadius: 6, background: C.mark, transform: `scaleX(${rule})`}} />
        <Source said={SPEC.name} y={nameTop + h + 70} at={at + 40} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 3: the product's real things, its own words, card after card while the camera pushes in. */
const Things: React.FC = () => {
  const f = useF();
  const fonts = useFontsLoaded();
  const said = SPEC.lines.slice(1, 4);
  const items = said.length ? said : [SPEC.lines[0]];
  const cardW = W;
  const pad = 44;
  const sets = items.map((s) => (fonts ? setLines(s.text, cardW - pad * 2, 3, 68, 46, 750) : {lines: [s.text], size: 58}));
  const hs = sets.map((s) => s.lines.length * s.size * 1.12 + pad * 2 + 52);
  const gap = 30;
  const total = hs.reduce((a, b) => a + b, 0) + gap * (hs.length - 1);
  const room: [number, number] = [L.top + 90, L.bottom - 20];
  const top0 = Math.max(room[0], (room[0] + room[1]) / 2 - total / 2);
  const start = S[2][0];
  const every = Math.min(110, (S[2][1] - start - 120) / Math.max(1, items.length - 1));
  const cam = lerp(f, [S[2][0], S[2][1]], [1, 1.06], [INOUT]);
  let y = top0;
  return (
    <AbsoluteFill>
      <Backdrop glow={[300, 500]} />
      <AbsoluteFill style={{transform: `scale(${cam})`, transformOrigin: `50% ${top0 + total / 2}px`}}>
        {items.map((s, i) => {
          const at = start + i * every;
          const t = p(f, at, 34, EXPO);
          const top = y;
          y += hs[i] + gap;
          return (
            <div key={i} style={{position: 'absolute', left: L.left, top, width: cardW, height: hs[i], borderRadius: 34, background: C.panel, border: `2px solid ${C.line}`, boxShadow: `0 30px 80px ${rgba(C.deep, 0.6)}`, opacity: t, transform: `translateY(${(1 - t) * 140}px)`}}>
              <div style={{position: 'absolute', left: pad, top: pad - 6, width: 64, height: 10, borderRadius: 5, background: C.mark}} />
              <div style={{position: 'absolute', left: pad, top: pad + 26, width: cardW - pad * 2, fontFamily: FACE, fontWeight: 750, fontSize: sets[i].size, lineHeight: 1.12, letterSpacing: '-0.02em', color: C.ink}}>
                {sets[i].lines.map((ln, li) => (
                  <div key={li} style={{whiteSpace: 'nowrap'}}>{ln}</div>
                ))}
              </div>
              <div style={{position: 'absolute', left: pad, bottom: pad - 14, width: cardW - pad * 2, fontFamily: TEXT, fontSize: 32, fontWeight: 500, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.source}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 4: the promise, held, under the name. */
const Promise_: React.FC = () => {
  const f = useF();
  const fonts = useFontsLoaded();
  const said = SPEC.lines[0];
  const set = fonts ? setLines(said.text, W, 5, 140, 72, 850) : {lines: [said.text], size: 110};
  const h = set.lines.length * set.size * 1.12;
  const top = (L.top + L.bottom) / 2 - h / 2;
  const at = S[3][0] - 4;
  const nt = p(f, at, 30, EXPO);
  const words = said.text.split(/\s+/).length;
  const logo = logoFile();
  return (
    <AbsoluteFill>
      <Backdrop glow={[540, 900]} />
      <div style={{position: 'absolute', left: L.left, width: W, top: top - 110, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: nt}}>
        {logo && <Img src={staticFile(logo)} style={{height: 64, width: 'auto'}} />}
        <div style={{fontFamily: FACE, fontWeight: 800, fontSize: 52, color: C.ink, letterSpacing: '-0.02em'}}>{SPEC.name.text}</div>
      </div>
      <Rise lines={set.lines} size={set.size} top={top} at={at} step={3} weight={850} key0={words - 1} />
      <Source said={said} y={top + h + 30} at={at + 40} />
    </AbsoluteFill>
  );
};

/** The draft's mark: the film says what it is. */
const DraftMark: React.FC = () => (
  <div style={{position: 'absolute', left: L.left, top: L.top + 4, fontFamily: TEXT, fontSize: 32, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted}}>
    first look · draft
  </div>
);

export const Film: React.FC<{slug: string}> = () => (
  <AbsoluteFill style={{background: C.canvas}}>
    <World name="1 The opening" span={S[0]} out="push">
      <Opening />
    </World>
    <World name="2 The name" span={S[1]} inn="push" out="pull">
      <Name />
    </World>
    <World name="3 The real things" span={S[2]} inn="pull" out="push">
      <Things />
    </World>
    <World name="4 The promise" span={S[3]} inn="push">
      <Promise_ />
    </World>
    <DraftMark />
  </AbsoluteFill>
);
