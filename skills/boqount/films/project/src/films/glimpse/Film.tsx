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
import {Audio} from '@remotion/media';
import {measureText} from '@remotion/layout-utils';
import {EXPO, INOUT, clamp01, lerp, mix, p} from '../../lib/anim';
import {useFontsLoaded} from '../../lib/fonts';
import {useF, useStart} from '../../lib/scene';
import {L} from '../../lib/theme';
import {World, spans, Change} from '../../kit/WorldChange';
import spec from './spec.json';
import timeline from './timeline.json';

export type Said = {text: string; source: string};
export type Picture = {file: string; source: string; frame?: 'window' | 'phone' | 'none'; crop?: [number, number, number, number]; focus?: [number, number]};
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
const Source: React.FC<{said: {source: string}; y: number; at: number; plate?: boolean}> = ({said, y, at, plate = false}) => {
  const f = useF();
  const o = p(f, at, 24, EXPO);
  return (
    <div style={{position: 'absolute', left: L.left, width: W, top: y, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateY(${(1 - o) * 14}px)`}}>
      <div style={{maxWidth: W, fontFamily: TEXT, fontSize: 32, fontWeight: 500, color: plate ? C.ink : C.muted, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(plate ? {background: rgba(C.deep, 0.82), padding: '8px 22px', borderRadius: 26} : {})}}>
        {said.source}
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
        <div key={li} style={{overflow: 'hidden', paddingBottom: set.size * 0.08, whiteSpace: 'nowrap'}}>
          {ln.split(' ').map((w, wi) => {
            const k = n++;
            const t = p(f, at + k * step, 26, EXPO);
            return (
              <span key={wi} style={{display: 'inline-block', transform: `translateY(${(1 - t) * 100}%)`, opacity: clamp01(t * 1.8), color: k === key0 ? C.mark : undefined, marginLeft: wi > 0 ? `${GAP}em` : 0}}>
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
  const set = useSet(said.text, W, short ? 2 : 4, short ? 360 : 220, short ? 120 : 84, short ? 900 : 850);
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
        <Source said={SPEC.name} y={nameTop + h + 66} at={at + 60} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The picture's own width and height, read once before the frame is drawn. */
const usePictureSize = (src: string) => {
  const [size, setSize] = useState<[number, number] | null>(null);
  const [handle] = useState(() => delayRender(`the size of ${src}`));
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      setSize([im.naturalWidth, im.naturalHeight]);
      continueRender(handle);
    };
    im.onerror = () => {
      setSize([16, 10]);
      continueRender(handle);
    };
    im.src = src;
  }, [src, handle]);
  return size;
};

/** A real picture of the product, large: in a window or a phone when it is a bare screen, as it is when it already
 * has its frame; it arrives tilted, settles, then the camera pushes in on its focus, where a ring draws round the
 * detail. Its source sits above it. */
const PictureWorld: React.FC<{pic: Picture; n: number; end: number}> = ({pic, n, end}) => {
  const f = useF();
  const start = useStart();
  const src = staticFile(`glimpse/pictures/${pic.file.split('/').pop()}`);
  const size = usePictureSize(src);
  const [cx, cy, cw, ch] = pic.crop ?? [0, 0, 1, 1];
  const [fx, fy] = pic.focus ?? [0.5, 0.45];
  const frame = pic.frame ?? 'none';
  const bar = frame === 'window' ? 64 : 0;
  const bezel = frame === 'phone' ? 22 : 0;
  // the shown region's aspect, and a box as large as the frame allows (the picture may reach into the lower band)
  const aspect = size ? (size[0] * cw) / (size[1] * ch) : 1;
  const maxW = 960;
  const maxH = 1200;
  let bw = maxW;
  let bh = bw / aspect;
  if (bh > maxH) {
    bh = maxH;
    bw = bh * aspect;
  }
  const boxW = bw + bezel * 2;
  const boxH = bh + bar + bezel * 2;
  const left = (L.W - boxW) / 2;
  const top = 400 + Math.max(0, (1250 - boxH) / 2) * 0.5;
  const settle = p(f, start, 50, EXPO);
  // the camera: the picture grows toward its focus and the focus travels toward the frame's centre, so the detail
  // ends large and in the middle, never pushed off the side
  const k = lerp(f, [start + 50, end], [0, 1], [INOUT]);
  const push = 1 + 0.32 * k;
  const ox = bezel + fx * bw;
  const oy = bar + bezel + fy * bh;
  const ring = p(f, start + 80, 40, EXPO);
  const imgW = bw / cw;
  const imgH = bh / ch;
  const radius = frame === 'phone' ? 70 : 28;
  return (
    <AbsoluteFill>
      <Backdrop glow={[n % 2 ? 300 : 780, 700]} />
      <div style={{position: 'absolute', left, top, width: boxW, height: boxH, perspective: 1600, transform: `translate(${(L.W / 2 - (left + ox)) * 0.55 * k}px, ${(760 - (top + oy)) * 0.55 * k}px)`}}>
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
            {size && <Img src={src} style={{position: 'absolute', left: -cx * imgW, top: -cy * imgH, width: imgW, height: imgH}} />}
          </div>
          <svg width={boxW} height={boxH} style={{position: 'absolute', inset: 0}}>
            <rect x={ox - 230} y={oy - 110} width={460} height={220} rx={40} fill="none" stroke={C.mark} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} opacity={0.95} />
          </svg>
        </div>
      </div>
      <Source said={pic} y={L.top + 40} at={start + 20} plate />
    </AbsoluteFill>
  );
};

/** The lines the real things show: all but the promise, up to three (the promise alone when it is the only one). */
const THINGS = SPEC.lines.slice(1, 4).length ? SPEC.lines.slice(1, 4) : [SPEC.lines[0]];

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
  const cam = lerp(f, [start, end], [1, 1.08], [INOUT]);
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
              <div style={{position: 'absolute', left: pad, bottom: pad - 14, width: W - pad * 2, fontFamily: TEXT, fontSize: 32, fontWeight: 500, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.source}</div>
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
  const set = useSet(said.text, W, 5, 140, 72, 850);
  const h = set.lines.length * set.size * 1.12;
  const top = (L.top + L.bottom) / 2 - h / 2;
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
        <div style={{position: 'absolute', left: L.left, width: W, top: top - 120, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: nt, transform: `translateY(${(1 - nt) * 30}px)`}}>
          {logo && <Img src={staticFile(logo)} style={{height: 72, width: 'auto'}} />}
          <div style={{fontFamily: FACE, fontWeight: 800, fontSize: 56, color: C.ink, letterSpacing: '-0.02em'}}>{SPEC.name.text}</div>
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
  <div style={{position: 'absolute', left: L.left, top: L.top - 50, fontFamily: TEXT, fontSize: 32, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted}}>
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
        const body = w === 'opening' ? <Opening /> : w === 'name' ? <Name /> : w === 'picture' ? <PictureWorld pic={PICTURES[pic]} n={pic++} end={S[i][1]} /> : w === 'things' ? <Things /> : <Promise_ />;
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
