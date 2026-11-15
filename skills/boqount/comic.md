# The animated comic

## Overview

A look for drawn-style films: a painted comic in motion, usually carried by a recurring character (`characters.md`).
The render is generated (`gen.md`): key frames in the character's style, video between them, lip-sync where a face
talks. The lettering and the cut grammar are rules of the film itself and cost nothing: they are drawn in code and
hold for any drawn film.

**This look overrides the no-cuts rule:** the cut is the style. What stays from `film.md` → The locked format: the hook
on frame 0, the voice seam, the picture loop (the last shot rhymes with the first), the whole-frame length, the feed
file.

## The look

- The character's look and style paragraphs (its bible) on every key frame, with `ref/sheet.png` and `ref/look.png` as
  references (`characters.md`).
- **A camera per shot, never repeated by a neighbour:** extreme close-up, low hero angle, bird's-eye, over the
  shoulder, a tilted horizon, a point of view through a screen, a wide establishing shot, an insert on a hand or a prop.

## The cut grammar

- **Cut on the music**, never between beats: shots of 0.4–2.6 s, a median near 1.3–1.5 s; one long establishing shot
  (4–9 s) at most, usually at the open; the brand card last.
- **A rotation of shot kinds**, never two neighbours of the same kind: the face (emotion), the wide, an **insert** (a
  hand on a control, a key turning, a needle moving, rings on a hand), a point of view, an overhead, a profile, a
  mirror shot, a low close-up, the city wide.
- **Action and reaction in pairs**, and **match cuts on action** (a hand pushes the lever, the machine launches).
- **Every shot moves inside itself:** a push-in, a drift, smoke rolling, a head turning. Nothing is a still.
- **Colour:** one warm base against one signature accent.

## Lettering

Every spoken line is lettered as comic art inside the picture, not as subtitles on the glass:

- a **speech balloon** with a tail to the speaker (white fill, black ink outline, hand-lettered capitals, a slight
  wobble); **caption boxes** for narration; **sound-effect lettering** (big, outlined, bent into the scene's
  perspective) where a sound is;
- a balloon pops in on its line's first word (scale 0.6 → 1.05 → 1 over about 8 frames), its words appear as they are
  spoken, it rides the speaker's head, and it squashes out after the line;
- sound-effect letters land on their sound's frame with a 2–3 frame shake and hold at most 0.6 s;
- **one thing to read at a time:** sound-effect letters only while no balloon is up; a balloon, an effect word and a
  drawn prop together read as overloaded, and the balloons alone usually read smoother;
- fonts: a comic lettering face for balloons and a heavy display face for effects, both open-licensed, in the film
  project's fonts.

## The story

- **No explanation arcs.** A beat that stops to explain how the magic works breaks the flow: leave the how unsaid.
- **Sound direction leads:** the voice up front, the music under it and ducked, dropping out where the story needs
  silence; every on-screen action has its sound on its frame, written beside its line in the script, and the
  effect's lettering and its sound land on the same frame.

## The render

1. **Render painterly, keep the design.** The model sheet fixes who; the look comes from the style references:
   "render it exactly in the art style of the reference frames, not in the flat style of the model sheet: painterly
   film still, soft painted shading, volumetric haze, bloom, shallow depth of field, film grain". One reference pair per
   shot kind.
2. **Name a strong camera move per shot kind** in the video prompt (a fast push-in, a macro orbit, a dive, a lateral
   track, a rush), and put "static camera, slow motion, still image" in its negative prompt. Flat cel with gentle
   motion measured less than half the motion of the reference it was trying to match.
3. **A camera-and-film pass** after the video: a push-in through every shot, a zoom punch with shake and directional
   blur on every cut and effect hit, restrained bloom (a high threshold: stronger blew the frames out), a slight edge
   colour offset, grain, a vignette.
4. **Lip-sync wherever a face talks to camera:** video models animate mouths from the prompt, not the voice. Run every
   face shot through a lip-sync model against the voice-only track (a pad of about 0.3 s each side, conformed back to
   the shot's frames) before the grade and the lettering.
5. Key frames: "fills the entire canvas edge to edge, no white border".

Spend: key frames per shot (two takes), a video segment per shot, a lip-sync pass per talking shot. Quote them all
before the look test (`gen.md` → Spend).
