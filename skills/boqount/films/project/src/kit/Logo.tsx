import React from 'react';
import {getStaticFiles, Img, staticFile} from 'remotion';

// The brand's logo, when the account has one: scripts/sync-assets.mjs copies brand/<slug>/logo.svg (or logo.png)
// to public/brand/. With no logo file this draws nothing, so a film never shows a stand-in mark.
const logoFile = () => getStaticFiles().find((s) => s.name === 'brand/logo.svg' || s.name === 'brand/logo.png')?.name;

/** True when the account has a logo to draw. */
export const hasLogo = () => logoFile() !== undefined;

/** The logo at a height; its width follows the file's own proportions. */
export const Logo: React.FC<{height: number; style?: React.CSSProperties}> = ({height, style}) => {
  const name = logoFile();
  if (!name) return null;
  return <Img src={staticFile(name)} style={{height, width: 'auto', display: 'block', ...style}} />;
};
