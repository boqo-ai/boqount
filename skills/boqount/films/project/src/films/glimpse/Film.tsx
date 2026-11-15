// The first look (onboarding.md → 2. Say it back, and show it): 16 s, made from the person's own files minutes after
// the deep read, to show their brand moving before any question about it. It is a draft, never a post: no call, no
// link, no loop, and its top line says "first look · draft".
//
// Everything it shows comes from spec.json (copied by the sync from films/glimpse/glimpse.json, which the agent writes
// from the deep read's notes and `film.mjs glimpse` checks): the product's name, its own words, an optional short word
// or number from its own pages, up to two real pictures of the product (screenshots, the site's image, the app icon
// large), each with its source; its colours and face when the files have them; its logo when there is one. With no
// colours the film is drawn in a neutral palette, with no logo the name is the mark, with no pictures the words carry
// the middle: it never shows a stand-in.
//
// The worlds and their starts are timeline.json's, by how many pictures there are; film.mjs glimpse writes the sound
// sheet from the same file, so every sound lands on its event. Each change is a sideways pan (kit/WorldChange.tsx):
// two worlds' words are never on screen at once. Inside a world the camera never rests, and something new arrives
// for the eye about every second (motion.md → Rich motion); nothing flashes.
import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, getStaticFiles, Img, staticFile} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {measureText} from '@remotion/layout-utils';
import {EXPO, INOUT, clamp01, lerp, mix, p} from '../../lib/anim';
import {useFontsLoaded} from '../../lib/fonts';
import {useF, useStart} from '../../lib/scene';
import {L} from '../../lib/theme';
import {World, spans, Change} from '../../kit/WorldChange';
import {Cursor, curve} from '../../kit/Cursor';
import spec from './spec.json';
import timeline from './timeline.json';

/** Words of theirs: `source` is where they are (kept in the record, never drawn); `credit` is the short, human name of
 * that place shown under them ("rectangleapp.com", "the README"), never a file path. */
export type Said = {text: string; source: string; credit?: string | null};
/** A real picture of the product at work: a screenshot or a short clip (.mp4/.webm, `clip` [from, to] s, at most 5 s,
 * muted). `line` is the index of one of the lines it shows happening, set above it; `caption` a short human credit. */
export type Picture = {demo?: 'drag-snap' | null; file: string; source: string; caption?: string | null; line?: number | null; clip?: [number, number] | null; frame?: 'window' | 'phone' | 'none'; crop?: [number, number, number, number]; focus?: [number, number]};
export type Spec = {
  name: Said;
  opening?: Said | null;
  lines: Said[];
  pictures?: Picture[] | null;
  colors?: {canvas: string; ink: string; accent: string; source: string} | null;
  font?: {family: string; source: string} | null;
  logo?: {source: string} | null;
};

const SPEC = spec as Spec;
const PICTURES = (SPEC.pictures ?? []).slice(0, 2);
type WorldName = 'opening' | 'name' | 'picture' | 'things' | 'promise';
const VARIANT = (timeline.variants as unknown as Record<string, [WorldName, number][]>)[String(PICTURES.length)];

/** Film frames (BASE, 60 a second). */
export const DURATION = Math.round(timeline.duration * 60);
const MARKS = [...VARIANT.map(([, s]) => Math.round(s * 60)), DURATION];
const MOVES: Change[] = VARIANT.slice(1).map((_, i) => (i % 2 === 0 ? 'push' : 'pull'));
const S = spans(MARKS, MOVES);

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
const rgba = (hex: string, a: number) => `rgba(${rgb(hex).join(',')},${Math.min(1, Math.max(0, a))})`;

const base = SPEC.colors ? {canvas: hex6(SPEC.colors.canvas), ink: hex6(SPEC.colors.ink), accent: hex6(SPEC.colors.accent)} : NEUTRAL;
/** The accent as it can be drawn on the canvas: itself when it reads there (3:1, large text), else lifted toward the
 * ink just until it does, so it stays the brand's colour (a blue stays blue) and never turns into the ink. */
const readable = (accent: string, canvas: string, ink: string) => {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mixHex(accent, ink, t);
    if (contrast(c, canvas) >= 3) return c;
  }
  return ink;
};
const C = {
  ...base,
  mark: readable(base.accent, base.canvas, base.ink),
  muted: mixHex(base.ink, base.canvas, 0.42),
  panel: mixHex(base.canvas, base.ink, 0.07),
  line: rgba(base.ink, 0.12),
  deep: mixHex(base.canvas, '#000000', 0.45),
};
const FACE = `"${SPEC.font?.family ?? 'Inter'}", "Inter", system-ui, sans-serif`;
const TEXT = `"Inter", system-ui, sans-serif`;
const logoFile = () => getStaticFiles().find((s) => s.name === 'glimpse/logo.svg' || s.name === 'glimpse/logo.png')?.name;

// ───────────── setting a line: broken once, as large as fits ─────────────

const W = L.right - L.left;
/** Space between words, em: Rise draws each word as its own block with this margin. */
const GAP = 0.24;
type Set = {lines: string[]; size: number};
/** The words of `text` broken into at most `maxLines` lines no wider than `width`, at the largest size from `max`
 * down to `min` that fits; measured as Rise draws them (each word alone, GAP between), on the loaded face. */
const setLines = (text: string, width: number, maxLines: number, max: number, min: number, weight: number, family = FACE): Set => {
  const words = text.split(/\s+/).filter(Boolean);
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
    const lines = wrap(s);
    if (lines.length <= maxLines && lines.every((l) => wide(l, s) <= width)) return {lines, size: s};
  }
  return {lines: wrap(min), size: min};
};
/** The setting of a line, worked out once per world: the break never changes while the words move. */
const useSet = (text: string, width: number, maxLines: number, max: number, min: number, weight: number): Set => {
  const fonts = useFontsLoaded();
  return useMemo(() => (fonts ? setLines(text, width, maxLines, max, min, weight) : {lines: [text], size: min}), [fonts, text, width, maxLines, max, min, weight]);
};

// ───────────── pieces ─────────────

/** Behind every world: the canvas, a glow of the mark colour that drifts, motes that rise slowly, and a wide arc of
 * the mark colour in the lower third (picture there, never words: the feeds cover that band). */
const Backdrop: React.FC<{glow: [number, number]}> = ({glow}) => {
  const f = useF();
  const dx = Math.sin(f / 140) * 70;
  const dy = Math.cos(f / 170) * 40;
  const cy = L.H + 760 + lerp(f, [0, DURATION], [40, -40]);
  return (
    <AbsoluteFill style={{background: C.canvas}}>
      <AbsoluteFill style={{background: `radial-gradient(950px 950px at ${glow[0] + dx}px ${glow[1] + dy}px, ${rgba(C.mark, 0.17)}, ${rgba(C.mark, 0)} 70%)`}} />
      <AbsoluteFill style={{background: `radial-gradient(1100px 520px at 540px ${L.H - 120}px, ${rgba(C.mark, 0.2)}, ${rgba(C.mark, 0)} 70%)`}} />
      <svg width={L.W} height={L.H} style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 14}, (_, i) => {
          const sx = ((i * 211) % 1000) + 40;
          const speed = 0.35 + ((i * 37) % 10) / 20;
          const y = L.H + 40 - ((f * speed + i * 157) % (L.H + 80));
          return <circle key={i} cx={sx + Math.sin((f + i * 40) / 90) * 18} cy={y} r={3 + (i % 3)} fill={rgba(C.mark, 0.18 + (i % 4) * 0.05)} />;
        })}
        <g transform={`rotate(${f * 0.05} 540 ${cy})`}>
          <circle cx={540} cy={cy} r={1250} fill="none" stroke={rgba(C.mark, 0.55)} strokeWidth={5} />
          <circle cx={540} cy={cy} r={1180} fill="none" stroke={rgba(C.ink, 0.12)} strokeWidth={2} strokeDasharray="4 22" />
          <circle cx={540} cy={cy} r={1340} fill="none" stroke={rgba(C.mark, 0.18)} strokeWidth={2} strokeDasharray="120 60" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** A source, small and quiet, under (or over) what it backs. */
const Source: React.FC<{said: {credit?: string | null}; y: number; at: number; plate?: boolean}> = ({said, y, at, plate = false}) => {
  const f = useF();
  const o = p(f, at, 24, EXPO);
  if (!said.credit) return null;
  return (
    <div style={{position: 'absolute', left: L.left, width: W, top: y, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${(1 - o) * 14}px)`}}>
      <div style={{maxWidth: W, fontFamily: TEXT, fontSize: 32, fontWeight: 500, color: plate ? C.ink : C.muted, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(plate ? {background: C.deep, padding: '8px 22px', borderRadius: 26} : {})}}>
        {said.credit}
      </div>
    </div>
  );
};

/** Words that rise one by one out of a mask and come up from faint, the `key0` word in the mark colour. */
const Rise: React.FC<{set: Set; top: number; at: number; step?: number; weight?: number; color?: string; key0?: number}> = ({set, top, at, step = 5, weight = 800, color = C.ink, key0 = -1}) => {
  const f = useF();
  let n = 0;
  return (
    <div style={{position: 'absolute', left: L.left, width: W, top, textAlign: 'center', fontFamily: FACE, fontWeight: weight, fontSize: set.size, lineHeight: 1.04, letterSpacing: '-0.03em', color}}>
      {set.lines.map((ln, li) => (
        <div key={li} style={{paddingBottom: set.size * 0.08, whiteSpace: 'nowrap'}}>
          {ln.split(' ').map((w, wi) => {
            const k = n++;
            const t = p(f, at + k * step, 26, EXPO);
            return (
              <span key={wi} style={{display: 'inline-block', transform: `translateY(${(1 - t) * 0.35}em)`, opacity: clamp01(t * 1.4), filter: `blur(${(1 - t) * 8}px)`, color: k === key0 ? C.mark : undefined, marginLeft: wi > 0 ? `${GAP}em` : 0}}>
                {w}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const lastWord = (s: Said) => s.text.split(/\s+/).filter(Boolean).length - 1;

// ───────────── the worlds ─────────────

/** A number at the head of the opening counts up to itself in its first second; any other opening simply rises. */
const NUMBER = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/;
const counted = (text: string, t: number) => {
  const m = NUMBER.exec(text);
  if (!m) return text;
  const raw = m[2];
  const value = parseFloat(raw.replace(/,/g, ''));
  const places = raw.includes('.') ? raw.split('.')[1].length : 0;
  const now = value * mix(0.35, 1, t);
  const s = now.toFixed(places);
  const shown = raw.includes(',') ? Number(s).toLocaleString('en-US', {minimumFractionDigits: places, maximumFractionDigits: places}) : s;
  return `${m[1]}${shown}${m[3]}`;
};

/** The opening: the short word or number (else the promise) huge, on screen and moving on frame 0. */
const Opening: React.FC = () => {
  const f = useF();
  const said = SPEC.opening ?? SPEC.lines[0];
  const short = !!SPEC.opening;
  // set for the width it has at the end of the push, so the push never takes a letter past the side margin
  const set = useSet(said.text, W / 1.1, short ? 2 : 4, short ? 360 : 220, short ? 120 : 84, short ? 900 : 850);
  const h = set.lines.length * set.size * 1.12;
  const top = (L.top + L.bottom) / 2 - h / 2 - 60;
  const push = lerp(f, [0, S[0][1]], [1, 1.1], [INOUT]);
  const drift = Math.sin(f / 50) * 6;
  const isNumber = short && NUMBER.test(said.text);
  const tc = p(f, 0, 60, EXPO);
  // a counting number keeps its final break: its width at the end is the widest it gets
  const shown = isNumber ? {lines: [counted(set.lines.join(' '), tc)], size: set.size} : set;
  return (
    <AbsoluteFill>
      <Backdrop glow={[540, 760]} />
      <AbsoluteFill style={{transform: `scale(${push}) translateY(${drift}px)`}}>
        <Rise set={shown} top={top} at={-24} step={short ? 0 : 6} weight={short ? 900 : 850} color={short ? C.mark : C.ink} key0={short ? -1 : lastWord(said)} />
        <div style={{position: 'absolute', left: L.W / 2 - 180, top: top + h + 6, width: 360, height: 10, borderRadius: 5, background: C.mark, transform: `scaleX(${p(f, 40, 50, EXPO)})`, opacity: 0.9}} />
        <Source said={said} y={top + h + 40} at={30} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The name: the logo swings in, then the name assembles letter by letter, and a rule draws under it. */
const Name: React.FC = () => {
  const f = useF();
  const start = useStart();
  const logo = logoFile();
  const set = useSet(SPEC.name.text, W, 2, 230, 90, 900);
  const h = set.lines.length * set.size * 1.08;
  const logoH = 230;
  const block = (logo ? logoH + 60 : 0) + h;
  const top = (L.top + L.bottom) / 2 - block / 2 - 40;
  const at = start + 10;
  const lt = p(f, at - 16, 40, EXPO);
  const zoom = lerp(f, [start, start + 200], [1.06, 1], [INOUT]);
  const nameTop = top + (logo ? logoH + 60 : 0);
  const halo = p(f, at + 20, 90, EXPO);
  let k = 0;
  return (
    <AbsoluteFill>
      <Backdrop glow={[540, 640]} />
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        {logo && (
          <div style={{position: 'absolute', top, left: 0, width: L.W, height: logoH, display: 'flex', justifyContent: 'center'}}>
            <div style={{position: 'absolute', top: logoH / 2 - 170, left: L.W / 2 - 170, width: 340, height: 340, borderRadius: 170, border: `3px solid ${rgba(C.mark, 0.5 * (1 - halo))}`, transform: `scale(${mix(0.6, 1.5, halo)})`}} />
            <Img src={staticFile(logo)} style={{height: logoH, width: 'auto', maxWidth: W, opacity: clamp01(lt * 1.5), transform: `translateY(${(1 - lt) * 70}px) scale(${mix(0.7, 1, lt)}) rotate(${(1 - lt) * -10}deg)`, filter: `drop-shadow(0 30px 50px ${rgba(C.deep, 0.7)})`}} />
          </div>
        )}
        <div style={{position: 'absolute', left: L.left, width: W, top: nameTop, textAlign: 'center', fontFamily: FACE, fontWeight: 900, fontSize: set.size, lineHeight: 1.04, letterSpacing: '-0.035em', color: C.ink}}>
          {set.lines.map((ln, li) => (
            <div key={li} style={{whiteSpace: 'nowrap'}}>
              {Array.from(ln).map((ch, ci) => {
                const t = p(f, at + 8 + k++ * 2.2, 24, EXPO);
                return (
                  <span key={ci} style={{display: 'inline-block', whiteSpace: 'pre', opacity: clamp01(t * 1.6), transform: `translateY(${(1 - t) * 50}px) scale(${mix(1.3, 1, t)})`, filter: `blur(${(1 - t) * 10}px)`}}>
                    {ch}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', left: L.W / 2 - 170, top: nameTop + h + 24, width: 340, height: 12, borderRadius: 6, background: C.mark, transform: `scaleX(${p(f, at + 40, 40, EXPO)})`}} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Film frames (BASE) into a drag-snap world when each window lands: the sound sheet uses the same numbers. */
export const SNAPS = (timeline as unknown as {demos: Record<string, {snaps: number[]}>}).demos['drag-snap'].snaps.map((x) => Math.round(x * 60));

/** The action a line promises, drawn: on a screen in the brand's colours, a cursor takes a window by its title bar and
 * drags it to the right edge; a footprint of the right half shows where it will go; let go, it snaps there. Then a
 * second window goes to the top-left corner and snaps into that quarter. Generic: any "drag a thing to a place and it
 * fits there" (windows to edges, cards to columns). The line it draws is set above it. */
const DragSnap: React.FC<{line: number; n: number}> = ({line, n}) => {
  const f = useF();
  const start = useStart();
  const t = f - start;
  const said = SPEC.lines[line];
  const head = useSet(said.text, W, 3, 76, 50, 820);
  const headH = head.lines.length * head.size * 1.12;
  // the screen
  // the best moment of the film gets the frame: the full width and about half the height, reaching into the lower
  // band (a picture may; words may not)
  const sw = 1024;
  const sh = 960;
  const sx = (L.W - sw) / 2;
  const sy = L.top + 30 + headH + 90;
  const bar = 40;
  const inner = {x: sx + 16, y: sy + bar + 10, w: sw - 32, h: sh - bar - 26};
  const settle = p(f, start, 40, EXPO);
  const zoom = lerp(f, [start, start + 260], [1, 1.03], [INOUT]);
  // window 1: centre → right half
  const w1 = {w: inner.w * 0.46, h: inner.h * 0.42};
  const from1 = {x: inner.x + inner.w / 2 - w1.w / 2 - inner.w * 0.08, y: inner.y + inner.h * 0.2};
  const drag1 = p(f, start + 30, 60, INOUT);
  const snap1 = p(f, start + SNAPS[0], 16, EXPO);
  const grab1: [number, number] = [from1.x + w1.w - 70, from1.y + 24];
  const edge1: [number, number] = [inner.x + inner.w - 6, inner.y + inner.h * 0.45];
  const [c1x, c1y] = curve(grab1, edge1, 60, drag1);
  const half = {x: inner.x + inner.w / 2 + 4, y: inner.y, w: inner.w / 2 - 4, h: inner.h};
  const g1 = w1.w - 70;
  const pos1 = snap1 > 0 ? {x: mix(c1x - g1, half.x, snap1), y: mix(c1y - 24, half.y, snap1), w: mix(w1.w, half.w, snap1), h: mix(w1.h, half.h, snap1)} : {x: c1x - g1, y: c1y - 24, w: w1.w, h: w1.h};
  const foot1 = clamp01((t - 70) / 14) * (1 - snap1);
  // window 2: lower left → top-left quarter
  const w2 = {w: inner.w * 0.4, h: inner.h * 0.34};
  const from2 = {x: inner.x + 40, y: inner.y + inner.h - w2.h - 40};
  const drag2 = p(f, start + 112, 56, INOUT);
  const snap2 = p(f, start + SNAPS[1], 16, EXPO);
  const grab2: [number, number] = [from2.x + 60, from2.y + 24];
  const edge2: [number, number] = [inner.x + 4, inner.y + 4];
  const [c2x, c2y] = curve(grab2, edge2, -50, drag2);
  const quarter = {x: inner.x, y: inner.y, w: inner.w / 2 - 4, h: inner.h / 2 - 4};
  const pos2 = snap2 > 0 ? {x: mix(c2x - 60, quarter.x, snap2), y: mix(c2y - 24, quarter.y, snap2), w: mix(w2.w, quarter.w, snap2), h: mix(w2.h, quarter.h, snap2)} : {x: c2x - 60, y: c2y - 24, w: w2.w, h: w2.h};
  const foot2 = clamp01((t - 150) / 14) * (1 - snap2);
  const cur = t < 112 ? {x: c1x, y: c1y, press: t > 28 && t < SNAPS[0] ? 1 : 0} : {x: c2x, y: c2y, press: t > 110 && t < SNAPS[1] ? 1 : 0};
  const Win: React.FC<{r: {x: number; y: number; w: number; h: number}; title: string; tone: string}> = ({r, title, tone}) => (
    <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: 18, background: mixHex(C.canvas, C.ink, 0.1), border: `2px solid ${rgba(C.ink, 0.14)}`, boxShadow: `0 24px 60px ${rgba(C.deep, 0.6)}`, overflow: 'hidden'}}>
      <div style={{height: 54, display: 'flex', alignItems: 'center', gap: 11, paddingLeft: 20, background: rgba(C.ink, 0.06)}}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{width: 17, height: 17, borderRadius: 9, background: c}} />
        ))}
        <div style={{marginLeft: 14, fontFamily: TEXT, fontSize: 30, fontWeight: 600, color: C.muted, whiteSpace: 'nowrap'}}>{title}</div>
      </div>
      {[0.8, 0.6, 0.7, 0.45].map((w, i) => (
        <div key={i} style={{margin: '24px 26px 0', height: 18, width: `${w * 100}%`, borderRadius: 7, background: i === 0 ? tone : rgba(C.ink, 0.12)}} />
      ))}
    </div>
  );
  const Foot: React.FC<{r: {x: number; y: number; w: number; h: number}; o: number}> = ({r, o}) => (
    <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: 18, background: rgba(C.mark, 0.22 * o), border: `4px solid ${rgba(C.mark, 0.9 * o)}`}} />
  );
  return (
    <AbsoluteFill>
      <Backdrop glow={[n % 2 ? 300 : 780, 760]} />
      <Rise set={head} top={L.top + 30} at={start + 6} step={3} weight={820} />
      <Source said={{credit: said.credit}} y={L.top - 6 + headH + 30} at={start + 20} plate />
      <div style={{position: 'absolute', inset: 0, transform: `translateY(${(1 - settle) * 90}px) scale(${mix(0.9, 1, settle) * zoom})`, transformOrigin: `540px ${sy + sh / 2}px`, opacity: clamp01(settle * 1.4)}}>
        <div style={{position: 'absolute', left: sx, top: sy, width: sw, height: sh, borderRadius: 30, background: mixHex(C.canvas, '#000000', 0.25), border: `3px solid ${rgba(C.ink, 0.12)}`, boxShadow: `0 50px 120px ${rgba(C.deep, 0.75)}`, overflow: 'hidden'}}>
          <div style={{height: bar, background: rgba(C.ink, 0.07)}} />
        </div>
        <Foot r={half} o={foot1} />
        <Foot r={quarter} o={foot2} />
        <Win r={pos2} title="Notes" tone={rgba(C.ink, 0.3)} />
        <Win r={pos1} title={SPEC.name.text} tone={C.mark} />
        <Cursor x={cur.x} y={cur.y} press={cur.press} size={76} />
      </div>
    </AbsoluteFill>
  );
};

const VIDEO = /\.(mp4|webm|mov)$/i;

/** The picture's (or clip's) own width and height, read once before the frame is drawn. */
const usePictureSize = (src: string, video: boolean) => {
  const [size, setSize] = useState<[number, number] | null>(null);
  const [handle] = useState(() => delayRender(`the size of ${src}`));
  useEffect(() => {
    const done = (w: number, h: number) => {
      setSize([w || 16, h || 10]);
      continueRender(handle);
    };
    if (video) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight);
      v.onerror = () => done(16, 10);
      v.src = src;
      return;
    }
    const im = new Image();
    im.onload = () => done(im.naturalWidth, im.naturalHeight);
    im.onerror = () => done(16, 10);
    im.src = src;
  }, [src, video, handle]);
  return size;
};

/** A real picture of the product at work, large: a screenshot, or a short muted clip of it doing the thing. In a
 * window or a phone when it is a bare screen, as it is when it already has its frame. The line it shows happening is
 * set above it, with its credit; the picture arrives tilted, settles, then the camera pushes in on its focus, where a
 * ring draws round the detail. The whole picture always stays inside the frame: the push never takes an edge out. */
const PictureWorld: React.FC<{pic: Picture; n: number; end: number}> = ({pic, n, end}) => {
  const f = useF();
  const start = useStart();
  const video = VIDEO.test(pic.file);
  const src = staticFile(`glimpse/pictures/${pic.file.split('/').pop()}`);
  const size = usePictureSize(src, video);
  const said = pic.line != null ? SPEC.lines[pic.line] : null;
  const head = useSet(said?.text ?? ' ', W, 3, 76, 50, 820);
  const headH = said ? head.lines.length * head.size * 1.12 : 0;
  const [cx, cy, cw, ch] = pic.crop ?? [0, 0, 1, 1];
  const [fx, fy] = pic.focus ?? [0.5, 0.45];
  const frame = pic.frame ?? 'none';
  const bar = frame === 'window' ? 64 : 0;
  const bezel = frame === 'phone' ? 22 : 0;
  // the region under the headline, down into the lower band (a picture may go there; words may not)
  const roomTop = L.top + 30 + (said ? headH + 70 : 60);
  const roomBottom = 1780;
  const aspect = size ? (size[0] * cw) / (size[1] * ch) : 1;
  const PUSH = 1.22;
  const MARGIN = 24;
  let bw = Math.min(820, (L.W - 2 * MARGIN) / PUSH - bezel * 2);
  let bh = bw / aspect;
  const maxH = (roomBottom - roomTop) / PUSH - bar - bezel * 2;
  if (bh > maxH) {
    bh = maxH;
    bw = bh * aspect;
  }
  const boxW = bw + bezel * 2;
  const boxH = bh + bar + bezel * 2;
  const left = (L.W - boxW) / 2;
  const top = roomTop + Math.max(0, (roomBottom - roomTop - boxH * PUSH) / 2) * 0.4;
  const settle = p(f, start, 50, EXPO);
  const k = lerp(f, [start + 50, end], [0, 1], [INOUT]);
  const push = 1 + (PUSH - 1) * k;
  const ox = bezel + fx * bw;
  const oy = bar + bezel + fy * bh;
  // where the scaled box would sit, and the shift that keeps it whole inside the frame and under the headline
  const sl = left + ox - ox * push;
  const sr = sl + boxW * push;
  const st = top + oy - oy * push;
  const sb = st + boxH * push;
  const wantX = (L.W / 2 - (left + ox)) * 0.5 * k;
  const tx = Math.min(Math.max(wantX, MARGIN - sl), L.W - MARGIN - sr);
  const ty = Math.min(Math.max(0, roomTop - st), roomBottom - sb + 0);
  const ring = p(f, start + 80, 40, EXPO);
  const imgW = bw / cw;
  const imgH = bh / ch;
  const radius = frame === 'phone' ? 70 : 28;
  const clip = pic.clip ?? [0, 5];
  return (
    <AbsoluteFill>
      <Backdrop glow={[n % 2 ? 300 : 780, 700]} />
      {said && <Rise set={head} top={L.top + 30} at={start + 6} step={3} weight={820} />}
      <div style={{position: 'absolute', left, top, width: boxW, height: boxH, perspective: 1600, transform: `translate(${tx}px, ${ty}px)`}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: `${ox}px ${oy}px`,
            transform: `translateY(${(1 - settle) * 120}px) rotateX(${(1 - settle) * 16}deg) rotateZ(${(1 - settle) * (n % 2 ? 3 : -3)}deg) scale(${mix(0.86, 1, settle) * push})`,
            borderRadius: radius,
            background: frame === 'phone' ? '#0B0B0C' : frame === 'window' ? mixHex(C.canvas, '#FFFFFF', 0.9) : 'transparent',
            boxShadow: `0 50px 120px ${rgba(C.deep, 0.75)}`,
            overflow: 'hidden',
          }}
        >
          {frame === 'window' && (
            <div style={{position: 'absolute', left: 0, top: 0, width: boxW, height: bar, display: 'flex', alignItems: 'center', gap: 14, paddingLeft: 26}}>
              {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
                <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />
              ))}
            </div>
          )}
          <div style={{position: 'absolute', left: bezel, top: bar + bezel, width: bw, height: bh, overflow: 'hidden', borderRadius: frame === 'phone' ? 50 : frame === 'none' ? radius : 0}}>
            {size && !video && <Img src={src} style={{position: 'absolute', left: -cx * imgW, top: -cy * imgH, width: imgW, height: imgH}} />}
            {size && video && <Video src={src} muted trimBefore={Math.round(clip[0] * 120)} trimAfter={Math.round(clip[1] * 120)} style={{position: 'absolute', left: -cx * imgW, top: -cy * imgH, width: imgW, height: imgH}} />}
          </div>
          <svg width={boxW} height={boxH} style={{position: 'absolute', inset: 0}}>
            <rect x={ox - 200} y={oy - 100} width={400} height={200} rx={40} fill="none" stroke={C.mark} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} opacity={0.95} />
          </svg>
        </div>
      </div>
      <Source said={{credit: pic.caption ?? (said ? said.credit : null)}} y={L.top - 6 + (said ? headH + 30 : 0)} at={start + 20} plate />
    </AbsoluteFill>
  );
};

/** The lines the real things show: all but the promise, up to three (the promise alone when it is the only one). */
const SHOWN = new Set(PICTURES.map((pic) => pic.line).filter((i): i is number => i != null));
const REST = SPEC.lines.slice(1).filter((_, i) => !SHOWN.has(i + 1)).slice(0, 3);
const THINGS = REST.length ? REST : [SPEC.lines[0]];

/** The product's real things, its own words, card after card from alternate sides while the camera drifts in. */
const Things: React.FC = () => {
  const f = useF();
  const start = useStart();
  const end = S[VARIANT.findIndex(([w]) => w === 'things')][1];
  const items = THINGS;
  const pad = 46;
  const fonts = useFontsLoaded();
  const sets = useMemo(() => items.map((s) => (fonts ? setLines(s.text, W - pad * 2, 3, 72, 48, 760) : {lines: [s.text], size: 58})), [fonts, items]);
  const hs = sets.map((s) => s.lines.length * s.size * 1.12 + pad * 2 + 52);
  const gap = 30;
  const total = hs.reduce((a, b) => a + b, 0) + gap * (hs.length - 1);
  const room: [number, number] = [L.top + 90, L.bottom - 20];
  const top0 = Math.max(room[0], (room[0] + room[1]) / 2 - total / 2);
  const every = Math.min(62, (end - start - 140) / Math.max(1, items.length - 1));
  const cam = lerp(f, [start, end], [1, 1.04], [INOUT]);
  const tops = hs.map((_, i) => top0 + hs.slice(0, i).reduce((a, b) => a + b + gap, 0));
  // once all are in, each card in turn steps forward, about every 1.2 s: the eye always has something new
  const allIn = start + 6 + (items.length - 1) * every + 40;
  const beat = 72;
  const lift = (i: number) => {
    if (f < allIn) return 0;
    const n = (f - allIn) / beat;
    const cur = Math.floor(n) % items.length;
    const into = n - Math.floor(n);
    return cur === i ? Math.sin(Math.PI * Math.min(1, into * 1.15)) : 0;
  };
  return (
    <AbsoluteFill>
      <Backdrop glow={[300, 500]} />
      <AbsoluteFill style={{transform: `scale(${cam}) translateY(${Math.sin(f / 60) * 8}px)`, transformOrigin: `50% ${top0 + total / 2}px`}}>
        {items.map((s, i) => {
          const at = start + 6 + i * every;
          const t = p(f, at, 36, EXPO);
          const side = i % 2 ? 1 : -1;
          const bar = p(f, at + 16, 30, EXPO);
          return (
            <div key={i} style={{position: 'absolute', left: L.left, top: tops[i], width: W, height: hs[i], borderRadius: 34, background: C.panel, border: `2px solid ${rgba(C.mark, 0.12 + 0.6 * lift(i))}`, boxShadow: `0 ${30 + 30 * lift(i)}px 80px ${rgba(C.deep, 0.6)}`, opacity: clamp01(t * 1.5), transform: `translateX(${(1 - t) * side * 260}px) translateY(${-14 * lift(i)}px) rotate(${(1 - t) * side * 4}deg) scale(${1 + 0.03 * lift(i)})`}}>
              <div style={{position: 'absolute', left: pad, top: pad - 6, width: 96 * bar, height: 10, borderRadius: 5, background: C.mark}} />
              <div style={{position: 'absolute', left: pad, top: pad + 26, width: W - pad * 2, fontFamily: FACE, fontWeight: 760, fontSize: sets[i].size, lineHeight: 1.12, letterSpacing: '-0.02em', color: C.ink}}>
                {sets[i].lines.map((ln, li) => (
                  <div key={li} style={{whiteSpace: 'nowrap'}}>{ln}</div>
                ))}
              </div>
              <div style={{position: 'absolute', left: pad, bottom: pad - 14, width: W - pad * 2, fontFamily: TEXT, fontSize: 32, fontWeight: 500, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.credit ?? ""}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The promise, rising word by word under the name, then a rule drawn under it and held. */
const Promise_: React.FC = () => {
  const f = useF();
  const start = useStart();
  const said = SPEC.lines[0];
  const set = useSet(said.text, W / 1.08, 5, 140, 72, 850);
  const h = set.lines.length * set.size * 1.12;
  const top = Math.max((L.top + L.bottom) / 2 - h / 2 + 70, L.top + 230);
  const at = start + 12;
  const nt = p(f, start + 4, 30, EXPO);
  const words = said.text.split(/\s+/).length;
  const logo = logoFile();
  const done = at + words * 3 + 24;
  const zoom = lerp(f, [start, DURATION], [1.03, 1.08], [INOUT]);
  return (
    <AbsoluteFill>
      <Backdrop glow={[540, 900]} />
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <div style={{position: 'absolute', left: L.left, width: W, top: Math.max(L.top + 40, top - 190), display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 28, opacity: nt, transform: `translateY(${(1 - nt) * 30}px)`}}>
          {logo && <Img src={staticFile(logo)} style={{height: 130, width: 'auto', filter: `drop-shadow(0 20px 40px ${rgba(C.deep, 0.7)})`}} />}
          <div style={{fontFamily: FACE, fontWeight: 900, fontSize: 96, color: C.ink, letterSpacing: '-0.02em'}}>{SPEC.name.text}</div>
        </div>
        <Rise set={set} top={top} at={at} step={3} weight={850} key0={lastWord(said)} />
        <div style={{position: 'absolute', left: L.W / 2 - 200, top: top + h + 8, width: 400, height: 12, borderRadius: 6, background: C.mark, transform: `scaleX(${p(f, done, 40, EXPO)})`}} />
        <Source said={said} y={top + h + 44} at={done + 10} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The draft's mark: the film says what it is. */
const DraftMark: React.FC = () => (
  <div style={{position: 'absolute', left: L.left - 14, top: L.top - 58, padding: '6px 14px', borderRadius: 14, background: C.deep, fontFamily: TEXT, fontSize: 32, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted}}>
    first look · draft
  </div>
);

const TITLES: Record<WorldName, string> = {opening: 'The opening', name: 'The name', picture: 'The picture', things: 'The real things', promise: 'The promise'};

export const Film: React.FC<{slug: string}> = ({slug}) => {
  const audio = `audio/${slug}/mix.wav`;
  const hasAudio = getStaticFiles().some((s) => s.name === audio);
  let pic = 0;
  return (
    <AbsoluteFill style={{background: C.canvas}}>
      {VARIANT.map(([w], i) => {
        const here = w === 'picture' ? PICTURES[pic] : null;
        const n = w === 'picture' ? pic++ : 0;
        const body = w === 'opening' ? <Opening /> : w === 'name' ? <Name /> : here?.demo ? <DragSnap line={here.line ?? 0} n={n} /> : here ? <PictureWorld pic={here} n={n} end={S[i][1]} /> : w === 'things' ? <Things /> : <Promise_ />;
        return (
          <World key={i} name={`${i + 1} ${TITLES[w]}`} span={S[i]} inn={i > 0 ? MOVES[i - 1] : undefined} out={i < VARIANT.length - 1 ? MOVES[i] : undefined}>
            {body}
          </World>
        );
      })}
      <DraftMark />
      {hasAudio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
