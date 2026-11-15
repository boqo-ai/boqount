# Integrated VFX on real footage

## Overview

An advanced generated look (`gen.md`): a change made inside real footage of a person (they turn into what they
describe, an object in their hand transforms, words fly out from behind them into the room), with everything else in
the frame left as the real pixels. The bar: integrated into the video, not a replacement; realistic; dynamic.

**Only with the subject's written permission** to change their image, saved with the footage and named in its
`SOURCES.md` row (`film.md` → Outside material). The record's `AI label: yes (generated realistic picture)`.

## The pipeline

Each step fixes a failure a viewer saw.

| Step | How | What it fixes |
|---|---|---|
| 1. Track the face | A video segmentation model with the prompt "face" (not "head": long hair widens it), returning a clean mask video | A mask that takes the hair makes the tile full width |
| 2. A head tile | A smoothed square crop around the face (about 2× its size), upscaled 2× | "Low resolution": the model draws the face at twice the pixels |
| 3. A key frame | An image edit of the tile's first frame, written by the realism rules below | "Looks AI": the look is fixed on one photoreal frame before any video |
| 4. The video edit | A video-to-video edit model on the tile, the key frame as its reference | Identity, mouth and motion survive; a weaker edit model drifted the face to another person |
| 5. Retime | The edit returns at a lower rate and a few percent long: interpolate it, then match each source frame to its phase by dynamic time warping over edge maps | A 3 % stretch at 24 fps reads as slow motion |
| 6. Register | Face landmarks on the tile and on the edit (eyes, brows, mouth, chin; never the nose), a robust similarity fit per frame, smoothed over 7 frames, warps the edit onto the face | "The mask slides off the face" |
| 7. Mask | The subject's inner face oval (away from ears and hairline) plus the changed part from the edit, feathered, minus the subject's hands (their own mask) | A mask cut from the edit's face outline brings the edit's ear and hair; without the hand matte the change draws over the fingers |
| 8. Plate match | Colour statistics matched to the tile outside the mask; regrained to the plate's own noise | The patch is smoother and graded differently from a phone sensor |
| 9. Composite | The feathered mask over the original plate; burned-in captions kept from the plate | Room, hair, clothes, hands and captions stay real |
| 10. Arrival | An optical-flow morph from the subject's own frame into the edit, with an overshoot, under a spring punch-in, a shake and one frame of motion blur | "Dynamic": the change grows out of the real thing instead of appearing |

Compositing tricks past this (only the edit's features over real skin, Poisson placement, painted contact shadows)
made it worse: the next gain is in the generation, not in more compositing.

## One beat per word

Each thing the subject names changes on its own word, as its own pass over the previous pass's output, with a region
per beat (the whole face, the eyes only, a recolour of the iris in a perceptual colour space with lightness untouched,
so the pupil and the catch-light survive). The later pass's key frame carries every earlier change.

- **Edit models lose face changes on long runs:** run face changes on sub-clips of at most 5 s; objects away from the
  face hold longer.
- **Build every key frame on a close-up frame of the tile**, with "keep the exact framing, this is the same video
  frame": a second reference image otherwise imposes its own framing.
- **An object grows** from its mask's base with an overshoot; it is never flow-morphed out of pixels that were never
  there.
- **A segmentation model returns an empty mask without an error** for some nouns: check every mask's area before
  compositing, and try a broader noun.
- **A shot shorter than the edit model's minimum** is slowed before the edit and retimed back.
- **Disk:** interpolated frames as PNG run to gigabytes; with little free space a tool may write empty frames
  silently. Use JPEG for intermediates and delete them as you go.

## Words in the room

Captions that fly out from behind the subject, land on planes in the room, ride the camera and take the room's light:

1. **A clean plate first:** remove the burned-in captions from the original plate (text found by on-device OCR boxes,
   not by colour: white text over a white shirt merges into one blob), the mask the union over the clip, the masked
   pixels filled grey in the input so the inpainting model does not redraw the letters. Before any pass that moves the
   frame.
2. **The subject's matte**, on the final pass, so the change is inside it.
3. **A camera track:** corners outside the matte, a homography per step, chained.
4. **Each word** with its font, size, colour, landing spot, rotation, in and out: it flies out from behind the body
   (drawn under the matte), lands on its plane, rides the track with the plate's light, softness and grain, motion-
   blurred on the move, and flies back when its phrase ends. On a whip pan the track breaks: keep those words on the
   glass. Every word is fitted inside a 40 px margin; after the render, no text pixel in the outer 30 px of any frame.

## Replacing a whole head without a video model

One generated key frame moved rigidly by the head's measured motion, so a print on it cannot drift: the head's outline
drawn by hand on the key, the head, the near background and the far background each tracked on its own, a clean plate
from every frame of the take, the matte from the key's own luminance with motion blur matched to a real edge in the same
frame. Look at a full-size crop before softening any join: a join is usually several defects, not one. A real
practical cover (filming someone in a plain balaclava and tracking the print on) beats it whenever the shot can be
filmed.

## The realism rules

1. **Direct the shot:** name the real camera ("phone front camera, about 24 mm, arm's length, eye level, flat
   overhead store light").
2. **Realism, not perfection:** slight motion blur, sensor noise and compression, real skin with pores, fine hairs,
   uneven tone, shine. A transformation is a practical prosthetic (silicone, the subject's skin tone, the same light
   falling on it), never "VFX", "glowing" or "electric".
3. **Say what you do not want**, in the prompt when the model has no negative field: CGI, cartoon, glow, neon, plastic
   skin, airbrushed, beauty filter, symmetrical, oversaturated, HDR, slow motion, any change to the background, the hair
   or the clothes.

## Traps

- Full-frame editors have no mask: they regenerate the background, recolour the hair and turn burned-in captions into
  gibberish. Always composite back.
- Edit models ignore timelines in the prompt: the change is on from frame 0. Timing lives in the compositor.
- The edit's hands sit a few pixels off: take the face and neck only.
- A masked merge on chroma-subsampled frames mixes chroma by the mask: merge in planar RGB.
- Read the words: "eyes like whoa, really blue" means blue eyes, not blue skin.
