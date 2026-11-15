# Motion: what every film is built and checked against

Read before the storyboard and before building a scene. The director at Gate 2 (`film.md` → The gates) reports each
bold rule below as `<rule> ✓` or `<rule> ✗ (<time>)`.

The look is the brand's: `brand/<slug>/style.md` → Look and Devices say what the picture is made of and what repeats
from film to film; `node <skill>/tools/film.mjs theme` puts its Tokens into the project. The starter film
(`films/starter/STORYBOARD.md`, its scenes in `films/project/src/films/starter/`) is the worked example of every rule
here.

## Film-level structure

These six are a `niche` film's. A `product` or `offer` film is the opportunity story: about ten worlds that change on
spoken words, captions that carry it on mute, and no loop (`story.md` → The picture). Inside each of its worlds, items
4 and 5 hold, and the rest of this file holds whole.

1. **One carried object** across the whole film, transformed by the story (the starter: one plant with its count and
   its moisture gauge). The hook frame shows it; the payoff shows it fixed; the last scene's last frames rebuild
   frame 0.
2. **Three full-frame hits, no more** (`Hit`), each on the strongest beat: the loss lands (with `shake`, in
   `danger`), the turn, the payoff (the film's one `Burst`, aimed clear of any number). Everything else moves only its
   own element.
3. **Two worlds.** The problem in a tense bed or a muted palette; the music drops out on the turning line, and the
   groove lands on the first line of the answer.
4. **No cuts.** One continuous piece: every storyboard row inherits an object from the row before and hands one to
   the row after. A cell grows into a phone; a bar opens into a card; one card's rectangle is carried into the next
   (`mixR`); many things fold into a point and the next object grows out of it. No hard cut, no whip-cut, no push-out
   and push-in, no panel slid away for the next. Text changes through word masks only (`Headline`); a whole picture
   never fades or slides into another. The loop back to frame 0 is a transformation too.
5. **Handoffs.** Never two scenes above about 30 % opacity at once, unless an element is carried across in the same
   position, size and pose on both sides.
6. **The loop, by construction.** The film's template draws its hook layer (`Hook.tsx`) twice (`Scenes.tsx`): at the
   head, and over the tail from `SEAM0` with `shift={-DURATION}`, where it reads negative frames. The last frame is
   then the hook's frame −1. Write the hook's negative half as the last scene's object turning into frame 0's
   objects, with the title rising so it is whole on frame 0. Draw the carried object from story time alone (a pure
   function defined over the whole loop, in `timeline.ts`), so the stage and the hook layer draw the same picture
   where they hand over. **Check:** the step from the last frame to frame 0 is no bigger than an ordinary step
   between two neighbouring frames: take the last two frames and the first two as stills
   (`npm run still -- <Id> --frame=<n>`) and compare them, on the feed file too, because that is the file the
   platforms loop.

**Reviewing a no-cuts film.** A critic who sees sheets of stills reports carried transitions as swaps, and judges text
drawn at sheet size as smaller than it is. Its brief says both, and a "cut" it reports is checked at the exact frames
(stills 0.05 s apart: `--frame=<n>`, `<n+6>`, `<n+12>`…, since `n` counts 120ths of a second) before acting on it.

## Scene recipe

Each storyboard row answers: **what object appears, what it does on which word, and how it leaves**, plus the thing
its line names (Illustrative first), its camera and its demonstration (Rich motion), and what it inherits and hands on.
One distinct idea per row: two rows that share an idea are merged, or one is reinvented.

- **Text is never the only thing moving.** A row that is words on a background is not finished.
- **Every anchor is a cue** (`cueAt(<line>, <word>)` in the film's `timeline.ts`), never a bare frame number, so a
  re-timed line moves everything with it. Reveals land on their words, never all in a scene's first quarter.
- **Rest.** What matters (a number, a verdict, the payoff) rests about 1 s after it lands, or as long as the line
  allows. Exits start late.
- **Acceleration, not speed.** No uniform linear motion. A batch entrance gets faster element by element, then holds.
- **Human speed.** Typing, tapping and toggling run at a person's speed; the `Cursor` crosses the frame in about half
  a second, on a `curve`, never in a straight line.
- **Hold, never drift.** Nothing idles in a slow wander.
- **Deterministic.** Every value is a pure function of the frame (`useF`, `p`, `lerp`, seeded `rnd`): no CSS
  transition or keyframe, no `Math.random`. Easing comes from the style's preset (`M.in`, `M.out`, `M.move`); a
  landing is a `slam`.
- **Overshoot, settled:** a thing that lands (a word, a card, a number falling into its slot) lands with `slam`, with
  no overshoot; an entrance eases out with none. An **assembly or a morph** (parts coming together into one shape, one
  shape becoming another) takes at least about 1.5 s, eased in and out, and settles with one small overshoot (a few
  per cent of its travel, once); never a linear snap between poses, which reads as jerky.

## The kit

In `films/project/src/kit/`, drawn only from the style's tokens. Sizes are pixels of the 1080×1920 frame; times are
frames of the 60-unit base (`lib/cues.ts`). A piece the film needs and the kit lacks is drawn in the film's own scene
folder, from the tokens.

| Piece | File | Use for |
|---|---|---|
| `Headline`, `words`, `headlineExit` | `Kit.tsx` | Every headline: each word rises out of its own mask on its cue and is set plain, tinted (`tone`) or highlighted (`hl`: the one word or number that carries the line, on a fill of the accent that wipes in with the word, the word in the canvas colour; once a line at most), `out` for the exit upward word by word (the scene lasts `headlineExit(<words>)` past `out`). Shrinks to fit the safe width |
| `SeriesMark` | `Kit.tsx` | An episode of a series: `<Series> · <NN>` in a small line above the headline, at the top of the safe zone, from frame 0 to the last frame; the headlines move to `L.headTopMarked` under it |
| `SourceLine` | `Kit.tsx` | The source of an outside fact on screen, `Source: <who>, <date read>`, in a small line under the thing it belongs to, inside the safe zone and never smaller than a label |
| `Label` | `Kit.tsx` | A capsule label; `tone` fills it |
| `Card` | `Kit.tsx` | A panel at a rectangle |
| `Stat` | `Kit.tsx` | A number with its unit, rolling |
| `Progress` | `Kit.tsx` | A bar filled 0 to 1 |
| `Done` | `Kit.tsx` | A disc whose check draws on |
| `Row` | `Kit.tsx` | A list row: icon, title, quieter line, something on the right |
| `Device` | `Kit.tsx` | A phone holding the brand's screenshot or screen recording (muted), or drawn children |
| `Still`, `Shot` | `Media.tsx` | A picture, or a few seconds of footage, of the real thing, cropped into a frame, with a slow camera `move` and a caption. Files from `films/<slug>/media/`, or `brand` for `brand/<slug>/media/` (`film.md` → Outside material) |
| `Odo` | `Fx.tsx` | Every number on screen: a carry-chain odometer, never a plain interpolated number |
| `Draw`, `CHECK` | `Fx.tsx` | Strokes drawn on: checks, underlines, arrows, a circle round a word |
| `slam` | `Fx.tsx` | A fall into place with no overshoot and a two-frame squash |
| `DirBlur`, `speed` | `Fx.tsx` | Blur along the axis of motion, from the real velocity |
| `Burst` | `Fx.tsx` | The film's one seeded burst |
| `Hit` | `Fx.tsx` | A full-frame hit; three per film at most |
| `Cursor`, `curve` | `Cursor.tsx` | A pointer that taps real controls, on a hand's curved path |
| `Logo`, `hasLogo` | `Logo.tsx` | The brand's own logo file, or nothing: never a stand-in mark |
| the kit's `Camera` | `kit/` | The one travelling camera of Rich motion |

The theme (`lib/theme.ts`): `T` the tokens, `F` the font stacks, `L` the frame, the safe area and the headline slot,
`M` the motion preset, `D` the derived shades, `HL` the highlighter's fill and ink, and `alpha`, `mixColor`,
`onTone`. **No colour literal** in a scene: a
shade that is not a token is derived from one. The clock (`lib/cues.ts`, `lib/scene.tsx`): `Scene` (`from`, `to`,
`shift`), `useF`, `DURATION`. Motion helpers (`lib/anim.ts`): `p`, `lerp`, `mix`, `rnd`, `shake`, `bump`, `mixR`,
`box`.

## Illustrative first

The picture shows **the thing the line names**: a place, a screen, an object in a hand. An abstract tile, a bare
number or a label standing in for the thing is the shape to drop. The thing is drawn with the kit, or shown with
`Still`, `Shot` and `Device`, inside the no-cuts chain. In the storyboard every row names the thing its line talks
about and what on screen shows it. How this applies to the brand is in `brand/<slug>/style.md` → Look; material that
is not the brand's follows `film.md` → Outside material.

## Rich motion

Every film, in every layer:

- **One camera, one world.** The film is one continuous move of one travelling camera (the kit's `Camera`) through one
  world. It pushes in on the thing a line names until its detail fills the frame, and pulls out to show the whole
  again. A push or a pull is a move of that camera, never a cut.
- **Demonstrations, not labels.** What a line says happens is shown happening, step by step, each step a small exact
  animation the eye can follow (the reminder arriving, the tap that marks it done, the gauge filling as the water
  lands).
- **Detail that rewards a second look:** small live things wherever they are true (a counter rolling as an odometer, a
  dot pulsing, light from a picture spilling onto its frame, parallax between layers during a move). Nothing
  invented: no made-up number, name or comment.
- **Something new for the eye about every second**, on the word being said or shown, and never so busy that the line
  cannot be read. The three full-frame hits stay the loudest moments.
- **Hypnotic, unusual camera:** each world seen from an angle a phone feed rarely gives: straight down, from the floor
  up, a lens-close macro, an orbit; jumps of scale (one pixel to the whole account, one post to a year of them);
  perspective that bends (a grid tipping into a floor to the horizon, a dolly zoom, a tunnel, an endless spiral).
  Motion that repeats in rhythm (a ring turning, a spiral climbing) is the hypnosis: it locks to the music's beat.
- **Show the system as one object** when a film explains a process: a machine or a ring with a station per step,
  that someone who never heard the trade's words reads in a second; each step seen happening at its station.
- **Retention devices**, each once and where it is true: a macro close-up that fills the frame; a high-speed-camera
  slow motion with a small millisecond timer, and a snap back to real speed; a kaleidoscopic transition into the next
  beat, made as a move of the camera through the picture, never a flash (Nothing flashes).
- **A counter stops when its bar stops:** it rolls while the bar grows and lands on its value with it; no reel spins
  at rest.
- **The hero stays steady.** When many things fail and one survives, they fail in one clean wave; the survivor is the
  most prominent object, never flickers or changes identity, and the camera goes through it into the next scene.
  Nothing flies off at random.
- **No glitchy 3D:** no plane clipping through an object, no floating fragment, no seam showing between parts.
- **Not finished:** a film whose camera never moves, or whose rows are labels changing in place.
- **Nothing flashes.** Rich motion is movement, never blinking: no place where a large part of the frame (the whole
  frame, or any ninth of it on a 3 × 3 grid) goes between dark and bright more than three times in any one second, the
  usual limit for flashing content. A run of moments passes by sliding or by the camera pushing through it, each on
  screen 0.4 s or more; never as a run of full-frame swaps or flash effects. The three full-frame hits are single
  washes, seconds apart, and an opportunity story's world changes are moves or cuts, never flashes.

## Layout

- **Frame 0** is a finished picture: a readable hook and one subject, already moving within 0.2 s.
- **No dead space.** The picture fills the whole 9:16 frame in every scene, down through and below the caption band
  (a floor, a reflection, a crowd, falling tiles). The bottom third may sit under the platform's interface, but is
  never empty black.
- **One subject in the opening**, with one complete move.
- **Safe area.** The platforms draw their own interface over the top 14 % of the frame, the bottom 35 % and 6 % of
  each side, so what a viewer must read (text, numbers, labels) stays inside `L`: on 1080×1920, below y 270, above
  y 1248 (the bottom 672 px are covered) and 65 px from each side (x 65 to 1015). The picture itself may run to the
  frame's edges; nothing that must be read does. Check a still with `npm run still -- <Id> --frame=<n> --safe`.
- **Readable on a phone.** Headlines at least 100 px, other text at least 32 px, labels and chips at least 44 px. Text
  that cannot reach that is texture, or it is cut: nothing is meant to be read and can't be.
- **Land in a slot.** Anything that flies in lands in a real place in the layout: a slot, a list row.
- **Numbers agree** with the words, every frame. A state that contradicts them is greyed or struck until it updates.
- **One meaning per hue.** Each accent of the style means one thing across every film (for example: "this one, now";
  live or time running; a link; late or failed), and a colour never changes meaning between scenes. No gradients in
  the interface's chrome: pictures and footage carry the colour.
- **Effects once.** No glint or sweep on every card; one burst per film at most, never over a number to read.
- **Real labels.** The product's interface uses its real labels and controls, read again at the product's page or app
  before a film shows a panel of it: what the screen says today, not what a kit, an older film or memory says. The
  brand kit keeps each label set with where and when it was read (`brand/<slug>/assets.md` → Interface labels); a
  film that shows a set the product no longer has is held (`check.md` item 1). Other apps and sites appear as plain
  windows with text titles, never with their logos.
- **Flashes:** no more than three in any second (Rich motion → Nothing flashes).

## Sound follows the picture

The sheet's fields, the mix and the checks are `film.md` → Sound; the standards behind these numbers, with their
sources, and the library are `sound.md`.

- **Start from the picture's events, not from a list of sounds.** For each storyboard row, list what moves, lands,
  opens, shuts, is pressed or changes state. One event, one sound; two layers at most (the thing, and its weight or
  its pitch); three only on the film's full-frame hits.
- **Every visible action has its sound**, pinned to the cue word it lands on in `audio/sfx-cues.json`
  (`"at": "<line id>.<word index>"`, plus `offset`), with what it is the sound of in `"_"`. **Nothing for its own
  sake:** no sound whose `"_"` names no event, no stretch of whooshes, no money sound in a film that shows no money.
- **No object, no sound.** A sound starts with its thing and ends when the thing leaves the frame (`until`): a cue says
  only when a sound starts, so a long one cued on a word plays on after its thing is gone.
- **A sound is the sound of the thing:** a tap sounds like a tap, a padlock like a padlock, a date is stamped on, a
  capture is a shutter. Pick each by what it is the sound of (the library's `use` line), never by habit; a small thing
  makes a small sound. **A meaning keeps its sound** through the film: every date the stamp, every landing tag the same
  pluck. A sound the library lacks goes into the library (`film.md` → Sound), not into the film.
- **Levels are set against the voice** (`under`, in dB under its typical level):

  | Tier | Under the voice | What |
  |---|---|---|
  | hero | 6 to 9 dB | the film's full-frame hits; six a minute at most |
  | support | 11 to 16 dB | transitions, the actions a line names |
  | texture | 18 to 23 dB | what happens often: ticks, letters, small landings; shorter, quieter, one note or none |
  | background | 18 to 24 dB | the air of a world (`beds`) |
  | music | 15 to 20 dB | the bed under the voice |

  **A long sound stays under the voice:** anything over about a second sits at least 12 dB under its typical level, set
  against the voice and not the music; a sustained sound at the voice's level masks it without ever going over. A
  short hit may reach the voice on an accent word.
- **A world may have air.** A scene whose place has a sound (a city, a room of people at keyboards, night) takes one
  background, from the frame the world arrives to the frame it leaves. A clean product scene takes none: silence there
  is the design.
- **Pitch comes from the tonal set,** made in the key of the film's music. Things that are good, open, done or in the
  brand's colour take plucks and bells; a run of things takes the scale going up; a set completing takes `resolve`; a
  refusal takes `deny`; sameness is the same note again. A library sound that carries a pitch of its own (its `note`
  says so) does not go under music: the tonal set does.
- **A build ends on its point.** A riser, a suck-in or a growing bar is placed by its peak (`"align": "sync"`), so it
  ends on the frame of the reveal. A push through to a new world: the whoosh peaks as the old world passes the frame.
- **A sound signature per station.** When the film shows a system of steps, each station has its own sound, from the
  library by what it is the sound of; a repeating cycle has a rhythmic motif in the music's key (the tonal set) that
  speeds up as the cycle spins up; the three full-frame hits get the film's three biggest sounds.
- **Two planned silences at most.** Before a full-frame hit the music dips for 0.2 to 0.3 s (`music.dips`) so the hit
  stands alone. No accidental ones.
- **Every hero hit is there on a phone,** whose speaker plays almost nothing under 200 Hz: a low hit has harmonics a
  phone plays (the library's build adds them), or a second, higher layer on the same frame.
- **No machine-gun:** no file more than 8 % of a film's hits, none twice within a second (the mixer rotates a sound's
  takes and moves a returning take's pitch); at most seven hits in any second.
- **Re-pin after any re-time:** when the cues move, every hit, background, dip and the music's placement are checked
  again.
- **The kit's sixteen** (`films/sfx/`, `kit/<name>`, synthesized, $0: what carries a film without a library): `tap` a
  word rising or a touch, `tick` one step of a count, `typing`, `toggle` a switch, `pop` and `pop_hi` a thing
  appearing, `lock` a thing seating, `ding` a notification, `blip` a small state change, `stamp`, `drop` a fall, `error`
  a loss, `whoosh` and `whoosh_big` a carry or an exit, `rise` the riser into the seam, `sparkle` the burst.
