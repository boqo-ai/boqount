// Generated props on the stage (gen.md → Explainer props): an object made by an image model on black, cut out, and
// prepared by tools/prop-prep.mjs into films/<slug>/media/props/ (the PNG and its entry in props.json), placed by its
// centre and moved in 2.5D: a perspective tilt, a depth blur, a coloured glow from the tokens, and a "cold" state that
// greys it out (an hour that never comes, a thing that is lost). A device (a phone, a laptop) asked for with a flat
// green screen draws live interface UNDER its glass: prop-prep keyed the screen into a hole and recorded its rectangle,
// so the bezel masks the interface's edges exactly.
//
//   import props from './props.json';                 // written by npm run sync from media/props/props.json
//   <Prop meta={props} name="bulb" cx={540} cy={800} w={420} glow={T.accent} glowT={on} />
//   <PropDevice meta={props} name="phone" ui={{w: 390, h: 844, r: 44}} cx={540} cy={900} w={520}>…</PropDevice>
//
// The brand's own mark is never a generated prop: it is kit/Logo3D.tsx, drawn from the real path.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {useSlug} from '../lib/scene';

export type PropMeta = Record<string, {w: number; h: number; screen?: [number, number, number, number]}>;

export type Pose = {
  cx: number;
  cy: number;
  /** width on the frame, px */
  w: number;
  /** in-plane rotation, deg */
  rot?: number;
  /** tilt about x and y, deg */
  rx?: number;
  ry?: number;
  opacity?: number;
  /** 0..1: grey and dim */
  cold?: number;
  /** a coloured glow around the object (a token's colour), and its strength 0..1 */
  glow?: string;
  glowT?: number;
  /** depth blur, px */
  blur?: number;
  /** 0..1: the drop shadow under it */
  shadow?: number;
  /** clear glass: drawn with a screen blend and a soft radial mask, no shadow (a cut-out keeps only glass's outline) */
  glass?: boolean;
  style?: React.CSSProperties;
};

const filterOf = (cold = 0, glow?: string, glowT = 1, blur = 0, shadow = 1) => {
  const fs: string[] = [];
  if (cold > 0) fs.push(`grayscale(${cold * 0.9})`, `brightness(${1 - cold * 0.32})`);
  if (shadow > 0) fs.push(`drop-shadow(0 ${18 * shadow}px ${26 * shadow}px rgba(0,0,0,${0.55 * shadow}))`);
  if (glow && glowT > 0) fs.push(`drop-shadow(0 0 ${22 * glowT}px ${glow})`, `drop-shadow(0 0 ${8 * glowT}px ${glow})`);
  if (blur > 0.2) fs.push(`blur(${blur}px)`);
  return fs.length ? fs.join(' ') : undefined;
};

const entry = (meta: PropMeta, name: string) => {
  const m = meta[name];
  if (!m) throw new Error(`Prop: no "${name}" in props.json: run tools/prop-prep.mjs on it, then npm run sync`);
  return m;
};

/** A prop image, centred on (cx, cy), `w` wide. */
export const Prop: React.FC<{meta: PropMeta; name: string} & Pose> = ({meta, name, cx, cy, w, rot = 0, rx = 0, ry = 0, opacity = 1, cold = 0, glow, glowT = 1, blur = 0, shadow = 1, glass = false, style}) => {
  const slug = useSlug();
  if (opacity <= 0.001 || w <= 1) return null;
  const m = entry(meta, name);
  const h = (w * m.h) / m.w;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - w / 2,
        top: cy - h / 2,
        width: w,
        height: h,
        opacity,
        transform: `perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rot}deg)`,
        filter: filterOf(cold, glass ? undefined : glow, glowT, blur, glass ? 0 : shadow),
        mixBlendMode: glass ? 'screen' : undefined,
        ...style,
      }}
    >
      <Img src={staticFile(`media/${slug}/props/${name}.png`)} style={{width: '100%', height: '100%', display: 'block', maskImage: glass ? 'radial-gradient(closest-side, black 58%, transparent 100%)' : undefined}} />
    </div>
  );
};

/** A device prop with live interface on its screen. `ui` is the screen's logical size: children are laid out in it
 * and scaled to the keyed screen rectangle. */
export const PropDevice: React.FC<{meta: PropMeta; name: string; ui: {w: number; h: number; r: number}; screenBg?: string; children?: React.ReactNode} & Pose> = ({
  meta,
  name,
  ui,
  children,
  screenBg = '#0b0b0e',
  cx,
  cy,
  w,
  rot = 0,
  rx = 0,
  ry = 0,
  opacity = 1,
  blur = 0,
  shadow = 1,
  style,
}) => {
  const slug = useSlug();
  if (opacity <= 0.001 || w <= 1) return null;
  const m = entry(meta, name);
  if (!m.screen) throw new Error(`PropDevice: "${name}" has no screen: run tools/prop-prep.mjs with --screen`);
  const s = w / m.w;
  const h = m.h * s;
  const [x0, y0, x1, y1] = m.screen;
  const sw = (x1 - x0) * s;
  const sh = (y1 - y0) * s;
  const k = sw / ui.w;
  return (
    <div style={{position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h, opacity, transform: `perspective(1600px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rot}deg)`, filter: filterOf(0, undefined, 0, blur, shadow), ...style}}>
      <div style={{position: 'absolute', left: x0 * s - 2, top: y0 * s - 2, width: sw + 4, height: sh + 4, borderRadius: ui.r * k + 2, overflow: 'hidden', background: screenBg}}>
        <div style={{position: 'absolute', left: 2, top: 2, width: ui.w, height: ui.h, transformOrigin: '0 0', scale: `${k}`}}>{children}</div>
      </div>
      <Img src={staticFile(`media/${slug}/props/${name}.png`)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block'}} />
    </div>
  );
};

/** Where a point in a device's interface coordinates lands on the frame (the 3D tilt left out). */
export const uiToFilm = (meta: PropMeta, name: string, ui: {w: number}, pose: {cx: number; cy: number; w: number}, x: number, y: number) => {
  const m = entry(meta, name);
  const s = pose.w / m.w;
  const [x0, y0, x1] = m.screen ?? [0, 0, m.w, m.h];
  const k = ((x1 - x0) * s) / ui.w;
  return {x: pose.cx - pose.w / 2 + x0 * s + x * k, y: pose.cy - (m.h * s) / 2 + y0 * s + y * k, k};
};
