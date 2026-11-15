# Live-action: photoreal footage

## Overview

A generated look (`gen.md`) for a film that must pass as real footage: a car in a city, a point of view, hands at
work, anything with a physical world. It is the hardest look to get right: a film that passed every frame check and
measurement was called comical on its first watch. Read this whole file before quoting one.

**How far to trust this.** No rule here has been tested in a controlled comparison. Tags: **[film]** real film
production or physics, **[guide]** an official guide or a first-hand maker, **[weak]** a vendor, a snippet or an
opinion, **[test]** an inference to test before relying on it.

## What changes from the locked format

A live-action film overrides these items of `film.md` → The locked format, and its storyboard says so. An explicit
brief from the person wins over the defaults here, including over a recommendation to cut: say what the research
suggests once, then do what they asked.

- **No cuts becomes 8–12 shots of 2–5 s from fixed mounts** [guide, indirect]. The only no-cut form with a precedent
  is a bumper camera with no cabin in frame, segments chained by last frame, joins hidden by a passing object [test].
- **No voice, no voice loop, no picture loop** unless the brief asks for them.
- **The 120-sample blend and any vibrance boost do not apply** to generated footage [test, weak]. Compare 24 and
  60 fps on the feed file before choosing. Interpolate only to fix a rate mismatch, never for smoothness [guide].
- **Timing comes from picture events**, not from a voice.

## Before any film

1. **A control test first** [test]: one 5 s exterior shot, one 5 s interior shot, and the old concept as a control,
   shown blind to someone new. Change one variable at a time.
2. **Pick the model by test, not by habit** [test]: run the same four beats through the two or three current video
   models and score what the film needs (lane holding, perspective, traffic or crowds morphing, reflections, camera
   behaviour).
3. **Budget honestly** [guide]: makers report 20–50 generations per kept shot. One take per shot is not a real
   attempt. Quote the spend and get a yes before each paid series (`gen.md` → Spend).
4. **Check the route** [weak]: `ffprobe` every first result for its real frame rate and size; a service may serve an
   older model under a newer name.

## Camera

- **Bolted to the vehicle or a tripod** [film]: write "the camera does not move, it is bolted to the car". Never
  head-cam, helmet cam, a camera strapped to the head or handheld: they add a walking sway [test].
- **One camera behaviour per shot** [guide]; shot size and movement before light.
- **Alternate at least three positions** [film] (exterior low, the eye line, a side insert), and keep the point of
  interest in the same place on screen across cuts.
- **Wide rectilinear, "no fisheye distortion"** [film]: racing teams film inside the car at 10–15 mm.
- **Low camera, deep focus on wide shots, no high angles, almost no speed-up** [film for speed, weak for the rest]:
  shallow focus on a wide scene is the miniature look.

## Speed and danger

- **Claim believable speeds** [film]: 60–90 km/h in a city, not hypercar speed. Near objects (parked cars, poles,
  kerbs, lines) passing the lens do the work.
- **One incident per shot, with the traffic written out** [guide, test]: "taxi 15 m ahead, brake lights on, stays in its
  lane". Traffic is ordinary and does not know it is in a film.
- **Rhythm** [test]: slow, signal, lunge, near miss, braking. Contrast reads as speed; constant speed does not.
- **Describe force and result, never "realistic physics"** [guide]: nose dive under braking, roll into a turn, squat on
  acceleration. Split a contact into approach, contact, transfer, recovery.
- **No multi-subject collision in one generation** [guide]: cut on the impact.

## Shake

Never add a sine or random wobble: crop-jitter of 12–20 px was rejected as far too much. A rigid mount gives near-zero
baseline, fine texture that grows with speed, short hits from a visible cause, slow pitch under braking and roll in
turns [test]. Take the amplitudes from real footage (track a far point on real clips), then add each hit on a
stabilised plate at its visible cause [test].

## The brand in the frame

- **The brand is never the subject of the frame** [test]: no brand-coloured steering wheel, no logo on a hub. Bright
  flat material reads as a toy; let it take the scene's light and dirt.
- **Dark interiors, controls plain and partly out of frame, instruments unreadable** [weak]; end the prompt with "no
  text, logos, or watermarks".
- **Hands low in frame, lit only by passing light, in short inserts** [test].
- **The same object across shots:** one reference plus "this exact <object>" [weak].
- **An exact logo goes on in post** [weak]: a clean surface, a planar track, its real physical size, matched light,
  blur and grain; if the track fails on the footage's texture jitter, it moves to an end card.

## Prompt and references

- **Order** [guide]: format, subject, action with a start and an end, environment, camera, look, beat timing, sound,
  short concrete bans. With several shots, exact counts first: "EXACTLY THREE SHOTS, ONLY TWO CUTS".
- **About three beats per generation** [weak]: asking for many in one long take gave one event every 9 s and a calm end.
- **One written role per reference** [guide]: "appearance only", "camera motion only", and what not to inherit.
- **Lock more than the subject** [guide]: the same location still for all shots, a written palette, camera grammar,
  light direction.
- **Check every key frame before video**, and fix by looking what the prompt asked and the model ignored.

## Process and finish

Script and sign-off, shot list, locked stills, motion, an early rough assembly, edit, sound; most of the work is
selecting and fixing, not generating [guide]. Cut with the rough assembly before spending on finals.

Upscale, a per-clip fix, grade, **grain last** [guide for grain last]; low sharpening (high values give waxy halos).
Set the palette at generation; a LUT at 50–70 %; regenerate rather than rescue with a grade [weak]. Judge grain by eye
on a phone. No chromatic aberration, distortion or halation by default. Night: practical lights only, real low
exposure, a little noise.

## Sound

- **Built, not generated** [film]: one consistent engine or room tone, the main perspective from inside the scene;
  passing things get pan and doppler.
- **Sound follows the visible motion and lands on its cause** [film]: read what you can from per-frame optical flow,
  then check each event on the frames (flow alone invents events); say which sounds are inferred.
- **Take the sound away before the near miss**, then bring it back [film].
- **One music mode per scene** [guide]: music leads and effects are tuned to it, or it sits under and rises at the
  turn. Always compare with a version without music. A limiter pushing hard means the balance is wrong.

## Acceptance

Stills and measurements cannot judge this look. A first viewer at full speed and display size gives a reaction; a
second hunts anomalies frame by frame; a blind comparison against real clips; with and without sound [test]. The
record's `AI label: yes (generated realistic picture)` (`gen.md` → The AI label).
