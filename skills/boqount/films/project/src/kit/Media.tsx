// Stills and shots of the real thing a film talks about, inside the film's own composition: a photo of the product,
// a few seconds of it in use. Drawn only from the style tokens; the pictures are the account's.
//
// Where the files come from (scripts/sync-assets.mjs copies both into public/):
//   films/<slug>/media/    this film's        → <Still src="pot.jpg" />          (public/media/<slug>/pot.jpg)
//   brand/<slug>/media/    the brand's own    → <Still src="pot.jpg" brand />    (public/brand/media/pot.jpg)
// `src` is a path inside that folder: a path that leaves it ("..", an absolute path, a URL) stops the render with an
// error naming it. Every media/ folder carries a SOURCES.md that names where each file came from (shot by the
// brand, a licence and its link, a supplier's press kit): a picture whose source is not written there is not used.
import React from 'react';
import {Img, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Video} from '@remotion/media';
import {lerp, R, box} from '../lib/anim';
import {K} from '../lib/cues';
import {useF, useSlug, useStart} from '../lib/scene';
import {D, F, M, T, alpha} from '../lib/theme';

/** A camera position over a picture: `scale` ≥ 1 zooms in; `x` and `y` (-1 … 1) say how far the view leans toward an
 * edge of the room that zoom makes (0 is the centre, 1 the right or bottom edge), so no empty edge ever shows. */
export type Cam = {scale: number; x: number; y: number};
/** A slow camera move from `from` to `to` over film frames [start, end] (BASE units, usually cue() values). */
export type Move = {from: Cam; to: Cam; start: number; end: number};

const STILL: Cam = {scale: 1, x: 0, y: 0};

/** The public/ path of a media file, or an error naming a path that leaves its folder. */
const mediaPath = (kind: string, src: string, brand: boolean, slug: string) => {
  const parts = src.split('/');
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/') || src.includes('\\') || parts.some((p) => p === '..' || p === '.' || p === '')) {
    throw new Error(`${kind}: "${src}" is not a path inside the ${brand ? 'brand' : 'film'}'s media/ folder (no "..", no absolute path, no URL)`);
  }
  if (!brand && !slug) throw new Error(`${kind}: no film slug to find media/<slug>/${src} (draw it inside a film)`);
  return brand ? `brand/media/${src}` : `media/${slug}/${src}`;
};

/** The camera at film frame f, as a CSS transform for a picture filling a w × h frame. */
const camera = (f: number, w: number, h: number, move?: Move) => {
  const c = move ? (['scale', 'x', 'y'] as const).map((k) => lerp(f, [move.start, move.end], [move.from[k], move.to[k]], M.move)) : [STILL.scale, STILL.x, STILL.y];
  const [s, x, y] = c;
  const room = Math.max(0, s - 1) / 2;
  return {scale: `${s}`, translate: `${-x * room * w}px ${-y * room * h}px`};
};

/** The frame around a picture: the theme's radius, a hairline, a soft shadow, and an optional caption on a scrim. */
const Frame: React.FC<{r: R; radius: number; caption?: string; style?: React.CSSProperties; children: React.ReactNode}> = ({r, radius, caption, style, children}) => (
  <div style={{...box(r), borderRadius: radius, overflow: 'hidden', background: D.deep, boxShadow: `inset 0 0 0 2px ${D.line}, ${D.shadow}`, isolation: 'isolate', ...style}}>
    {children}
    {caption && (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '64px 32px 26px',
          background: `linear-gradient(${alpha(T.canvas, 0)}, ${alpha(T.canvas, 0.82)})`,
          color: T.ink,
          fontFamily: F.text,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {caption}
      </div>
    )}
  </div>
);

/** A still image cropped to cover the rectangle `r`, with an optional slow camera move across it and a caption. */
export const Still: React.FC<{src: string; brand?: boolean; r: R; move?: Move; caption?: string; radius?: number; style?: React.CSSProperties}> = ({
  src,
  brand = false,
  r,
  move,
  caption,
  radius = T.radius,
  style,
}) => {
  const f = useF();
  const path = mediaPath('Still', src, brand, useSlug());
  return (
    <Frame r={r} radius={radius} caption={caption} style={style}>
      <Img src={staticFile(path)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...camera(f, r.w, r.h, move)}} />
    </Frame>
  );
};

/** A short clip, muted unless `sound` is given, cropped to cover `r`: seconds [startFrom, endAt) of the file, played
 * at its real speed from film frame `at` (default: the enclosing Scene's start). The frame stays empty before `at` and
 * once the clip has run out, so hold it on screen only that long. Same camera move and caption as Still. */
export const Shot: React.FC<{
  src: string;
  brand?: boolean;
  r: R;
  startFrom?: number;
  endAt: number;
  at?: number;
  move?: Move;
  caption?: string;
  radius?: number;
  /** The clip's own sound under the shot, at this volume (0 … 1), for the shot's length only. Off unless the person's
   * word for this source covers its sound: without that word, leave it out and the shot is muted. A source's song is
   * never a film's bed: this is the source's sound under a shot of that same source, nothing longer. */
  sound?: number;
  style?: React.CSSProperties;
}> = ({src, brand = false, r, startFrom = 0, endAt, at, move, caption, radius = T.radius, sound, style}) => {
  const f = useF();
  const start = useStart();
  const {fps} = useVideoConfig();
  const path = mediaPath('Shot', src, brand, useSlug());
  if (!(Number.isFinite(startFrom) && Number.isFinite(endAt) && startFrom >= 0 && endAt > startFrom)) {
    throw new Error(`Shot "${src}": startFrom ${startFrom} and endAt ${endAt} must be seconds with 0 ≤ startFrom < endAt`);
  }
  if (sound !== undefined && !(typeof sound === 'number' && Number.isFinite(sound) && sound >= 0 && sound <= 1)) {
    throw new Error(`Shot "${src}": sound ${String(sound)} must be a volume from 0 to 1 (or left out: muted)`);
  }
  // The clip's own clock runs in the composition's samples (fps, 120 a second), so it plays at its real speed.
  const from = Math.round(((at ?? start) - start) * K);
  return (
    <Frame r={r} radius={radius} caption={caption} style={style}>
      <Sequence from={from} durationInFrames={Math.max(1, Math.round((endAt - startFrom) * fps))} layout="none">
        <Video
          src={staticFile(path)}
          muted={sound === undefined}
          volume={sound ?? 0}
          trimBefore={Math.round(startFrom * fps)}
          objectFit="cover"
          style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...camera(f, r.w, r.h, move)}}
        />
      </Sequence>
    </Frame>
  );
};
