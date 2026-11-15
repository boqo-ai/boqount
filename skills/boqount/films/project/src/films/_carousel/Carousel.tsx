// A carousel (carousel.md): one topic told one or two sentences a slide, rendered as 1080×1440 stills (Instagram's
// 3:4), in the brand's tokens and faces (lib/theme.ts). The words are slides.ts; this file is the look, and stays the
// same from carousel to carousel: change the words, keep the design.
//
// The look: backgrounds alternate the canvas and its inverse (the ink as the ground, the canvas as the words), each
// with a fine grid at a few percent; the cover is plain. The one word a slide leans on is in the accent where the
// accent reads on that ground (3:1), else on a highlighter of the accent behind it. The cover's hook is four short
// lines in capitals in the display face, its key word on a solid accent block, ending on "…". The second slide carries
// the swipe cue. The brand's mark (its logo file) sits at the bottom left of the cover and the last slide, and nothing
// else signs it: never another creator's name, handle or signature, even when a reference carousel gave the shape.
//
// A carousel is stills: the frame is the slide's index (not a time), so this reads useCurrentFrame() itself.
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {useFontsLoaded} from '../../lib/fonts';
import {F, T, alpha, onTone} from '../../lib/theme';
import {Logo} from '../../kit/Logo';
import {SLIDES, type Bg, type Slide} from './slides';

const W = 1080;
const MARGIN = 104;

/** WCAG contrast of two #RRGGBB colours. */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const ground = (bg: Bg) => (bg === 'ink' ? {back: T.ink, text: T.canvas} : {back: T.canvas, text: T.ink});

/** Text with `*word*` marked: the accent where it reads on `back`, else a highlighter behind the word. */
const Marked: React.FC<{text: string; back: string}> = ({text, back}) => {
  const reads = contrast(T.accent, back) >= 3;
  return (
    <>
      {text.split(/(\*[^*]+\*)/).map((part, i) =>
        part.startsWith('*') && part.endsWith('*') ? (
          reads ? (
            <span key={i} style={{color: T.accent}}>
              {part.slice(1, -1)}
            </span>
          ) : (
            <span key={i} style={{background: T.accent, color: onTone('accent'), borderRadius: '0.14em', padding: '0 0.12em', margin: '0 -0.04em', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone'}}>
              {part.slice(1, -1)}
            </span>
          )
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
};

/** The fine grid of every slide but the cover. */
const Grid: React.FC<{ink: string}> = ({ink}) => (
  <AbsoluteFill style={{backgroundImage: `linear-gradient(${alpha(ink, 0.06)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(ink, 0.06)} 2px, transparent 2px)`, backgroundSize: '54px 54px'}} />
);

const Mark: React.FC = () => (
  <div style={{position: 'absolute', left: MARGIN, bottom: 84}}>
    <Logo height={64} />
  </div>
);

/** The swipe cue: a sticker of the accent with an arrow, bottom right of the second slide. */
const Swipe: React.FC = () => (
  <div style={{position: 'absolute', right: 84, bottom: 92, width: 132, height: 132, borderRadius: 36, background: T.accent, rotate: '-6deg', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <svg width="72" height="72" viewBox="0 0 72 72">
      <path d="M12 36 H58 M40 18 L58 36 L40 54" fill="none" stroke={onTone('accent')} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const Source: React.FC<{text?: string; color: string}> = ({text, color}) =>
  text ? <div style={{position: 'absolute', left: MARGIN, bottom: 72, fontFamily: F.text, fontWeight: 500, fontSize: 30, color, opacity: 0.6, letterSpacing: '0'}}>Source: {text}</div> : null;

/** Lines in capitals in the display face, each kept on one line: the block's size comes down until the widest fits
 * between the margins (a line, never a word, is the unit here). The key word sits on a solid accent block. */
const Caps: React.FC<{lines: string[]; size: number; color: string}> = ({lines, size, color}) => {
  const fontsLoaded = useFontsLoaded();
  const room = W - 2 * MARGIN;
  const widest = fontsLoaded
    ? Math.max(...lines.map((l) => measureText({text: l.replace(/\*/g, '').toUpperCase(), fontFamily: F.display, fontSize: size, fontWeight: 800, letterSpacing: '0em'}).width * 1.04))
    : 0;
  const fit = widest > room ? size * (room / widest) : size;
  return (
    <div style={{fontFamily: F.display, fontWeight: 800, fontSize: fit, lineHeight: 1.0, letterSpacing: '0', color, textTransform: 'uppercase', whiteSpace: 'nowrap'}}>
      {lines.map((l, i) => (
        <div key={i}>
          {l.split(/(\*[^*]+\*)/).map((part, j) =>
            part.startsWith('*') && part.endsWith('*') ? (
              <span key={j} style={{background: T.accent, color: onTone('accent'), padding: '0 0.08em'}}>
                {part.slice(1, -1)}
              </span>
            ) : (
              <React.Fragment key={j}>{part}</React.Fragment>
            ),
          )}
        </div>
      ))}
    </div>
  );
};

const Body: React.FC<{slide: Exclude<Slide, {kind: 'cover'}>; index: number}> = ({slide, index}) => {
  const {back, text} = ground(slide.bg);
  const centred: React.CSSProperties = {position: 'absolute', left: MARGIN, right: MARGIN, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center'};
  const head: React.CSSProperties = {fontFamily: F.display, fontWeight: 700, fontSize: 72, lineHeight: 1.08, letterSpacing: '-0.025em'};
  const sub: React.CSSProperties = {marginTop: 36, fontFamily: F.text, fontWeight: 600, fontSize: 46, lineHeight: 1.25, letterSpacing: '-0.01em', opacity: 0.82};
  return (
    <AbsoluteFill style={{background: back, color: text}}>
      <Grid ink={text} />
      {slide.kind === 'text' && (
        <div style={centred}>
          <div style={head}>
            <Marked text={slide.head} back={back} />
          </div>
          {slide.sub && (
            <div style={sub}>
              <Marked text={slide.sub} back={back} />
            </div>
          )}
        </div>
      )}
      {slide.kind === 'one' && (
        <div style={centred}>
          <div style={{...head, fontSize: 92}}>
            <Marked text={slide.line} back={back} />
          </div>
        </div>
      )}
      {slide.kind === 'rows' && (
        <div style={centred}>
          {slide.head && (
            <div style={{...head, marginBottom: 48}}>
              <Marked text={slide.head} back={back} />
            </div>
          )}
          {slide.rows.map((r, i) => (
            <div key={i} style={{padding: '30px 0', borderTop: `2px solid ${alpha(text, 0.16)}`}}>
              <div style={{fontFamily: F.display, fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em'}}>{r.name}</div>
              <div style={{...sub, marginTop: 10}}>
                <Marked text={r.text} back={back} />
              </div>
              {r.note && <div style={{marginTop: 8, fontFamily: F.text, fontWeight: 500, fontSize: 32, opacity: 0.6}}>{r.note}</div>}
            </div>
          ))}
        </div>
      )}
      {slide.kind === 'list' && (
        <div style={centred}>
          <div style={{...head, marginBottom: 44}}>
            <Marked text={slide.head} back={back} />
          </div>
          {slide.items.map((it, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 28, padding: '18px 0'}}>
              {/* a mark, not a number: the steps are told the way a person tells them */}
              <span style={{flex: 'none', width: 46, height: 46, borderRadius: 14, background: T.accent, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <svg width="30" height="30" viewBox="0 0 1 1">
                  <path d="M 0.2 0.54 L 0.42 0.74 L 0.8 0.3" fill="none" stroke={onTone('accent')} strokeWidth="0.14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span style={{fontFamily: F.text, fontWeight: 600, fontSize: 48, lineHeight: 1.2, letterSpacing: '-0.01em'}}>
                <Marked text={it} back={back} />
              </span>
            </div>
          ))}
        </div>
      )}
      {slide.kind === 'end' && (
        <div style={centred}>
          <Caps lines={slide.lines} size={84} color={text} />
        </div>
      )}
      {'source' in slide && <Source text={slide.source} color={text} />}
      {index === 1 && <Swipe />}
      {slide.kind === 'end' && <Mark />}
    </AbsoluteFill>
  );
};

export const Carousel: React.FC<{slug: string}> = () => {
  const i = Math.min(SLIDES.length - 1, Math.max(0, Math.round(useCurrentFrame())));
  const slide = SLIDES[i];
  if (slide.kind === 'cover') {
    return (
      <AbsoluteFill style={{background: T.canvas, color: T.ink}}>
        <div style={{position: 'absolute', left: MARGIN, right: MARGIN, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <Caps lines={slide.lines} size={150} color={T.ink} />
        </div>
        <Mark />
      </AbsoluteFill>
    );
  }
  return <Body slide={slide} index={i} />;
};

