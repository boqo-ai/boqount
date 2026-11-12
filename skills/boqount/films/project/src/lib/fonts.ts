import {useEffect, useRef, useState} from 'react';
import {loadFont} from '@remotion/fonts';
import {continueRender, delayRender, getStaticFiles, staticFile} from 'remotion';

// loadFont() holds the render (delayRender) until a face is in, so frame 0 is drawn in its faces, never a fallback.
// Inter ships (OFL: shared/fonts/OFL-Inter.txt). A brand's own faces come from brand/<slug>/fonts/ (.ttf, .otf or
// .woff2): scripts/sync-assets.mjs copies them to public/fonts/, and each loads here under the family name its file
// name gives ("Space Grotesk.ttf" → "Space Grotesk"), so `font_display` and `font_text` in tokens.json take effect
// when the brand supplies the file. One file covers every weight (a variable face draws each; a static one draws its
// own). A family named in the tokens with no file falls back to Inter, and the sync says so.
const FONT_FILE = /^fonts\/([^/]+)\.(ttf|otf|woff2)$/i;

const brandFaces = getStaticFiles()
  .map((f) => ({name: f.name, family: FONT_FILE.exec(f.name)?.[1]}))
  .filter((f): f is {name: string; family: string} => f.family !== undefined && f.family !== 'Inter');

let loaded = false;
export const fontsReady = Promise.all([
  loadFont({family: 'Inter', url: staticFile('fonts/Inter.ttf'), weight: '100 900'}),
  ...brandFaces.map((f) => loadFont({family: f.family, url: staticFile(f.name), weight: '100 900'})),
]).then(() => {
  loaded = true;
});

/** True once every face is in. A component that measures text uses it: it renders again when the faces arrive, and
 * the frame is not taken before that. */
export const useFontsLoaded = () => {
  const [ok, setOk] = useState(loaded);
  const [handle] = useState(() => (loaded ? null : delayRender('Waiting for the fonts to measure text')));
  useEffect(() => {
    if (handle === null) return;
    let live = true;
    fontsReady.then(() => {
      if (live) setOk(true);
    });
    return () => {
      live = false;
    };
  }, [handle]);
  // Released once the render with the faces is committed, or when the component leaves first: once either way.
  const released = useRef(handle === null);
  useEffect(() => {
    if (ok && handle !== null && !released.current) {
      released.current = true;
      continueRender(handle);
    }
  }, [ok, handle]);
  useEffect(
    () => () => {
      if (handle !== null && !released.current) {
        released.current = true;
        continueRender(handle);
      }
    },
    [handle],
  );
  return ok;
};
