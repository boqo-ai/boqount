# Generated looks

## Overview

A generated look is a film whose picture comes partly or wholly from image and video models instead of from code:
dream images, photoreal footage, a painted comic, a product's macro world, a change made inside real footage, or
3D props on a black stage. It is a style the brand can own, never the default: research proposes one as a style
direction (`<research>/directions.md`, direction 7) only when the person has a key, and the person picks it like any
other style. Each look has its own file, read whole before its film is planned:

| Look | File | What it is | Paid |
|---|---|---|---|
| Lucid | `lucid.md` | One dream flight: each product mechanism is one impossible image, the value held back to the end | key frames + video segments |
| Live-action | `live-action.md` | Photoreal footage of a physical world: cars, places, hands, things moving | video generations, many per kept shot |
| Animated comic | `comic.md` | A painted comic in motion, cut on the music, lettering drawn into the frame | key frames + video + lip-sync |
| Vibe | `vibe.md` | A physical product's world: no voice, materials in macro, one physical idea, 12–15 s | key frames + video |
| Integrated VFX | `vfx.md` | A change made inside real footage of a person, the rest of the frame left real | tracking, key frame, video edit |
| Explainer props | this file → Explainer props | 3D illustration props on black, with live interface on their screens | one image per prop |

Everything not named in a look's file still holds: `film.md` (the locked format, the gates, the feed file), `motion.md`,
`script.md`, `hooks.md`, and for a `product` or `offer` film `story.md`. A look's file says which locked rules it
overrides, and the film's storyboard says so too.

The calls go through `node <skill>/tools/gen.mjs` (fal's queue: one key reaches the image, video, cut-out, tracking and
lip-sync models). Prices and model names move: read them at their source at estimate time, never from memory.

## No key

The key is read from `FAL_KEY`, the file `FAL_KEY_FILE` names, or `~/.config/boqount/fal.key` (mode 600); check it with
`test -s`, never print it. **With no key, no generated look is offered**: research does not propose one, the plan
does not name one, and a film already planned in one is re-planned in a look drawn in code. What stays free is still
used in any film: the delayed-value timeline (`lucid.md` → Delayed value), comic lettering and cut grammar drawn in
code (`comic.md` → Lettering), the camera rules of live footage the person films themselves (`live-action.md` →
Camera), and explainer props the person already has as images.

## Spend

1. **Quote the whole series before the first call.** The look test, then the chain, each with its count of
   generations and its price read now (`gen.mjs price <endpoint> …`), in dollars, beside the storyboard. Every take is
   billed, kept or not: count the takes the look's file says a kept shot needs.
2. **The person's yes covers one series.** `gen.mjs run … --slug <film>` without `--yes` prints the plan and asks
   nothing; `--yes` is given only on the person's word for that estimate. A new series (a second look test, a re-run
   chain) is a new quote.
3. **The budget holds.** `gen.mjs` reserves each call in `marketing/budget.csv` at its estimate before it asks, and
   refuses one past what is left (`production.md` → Choosing what to make). A price it cannot read is `unverified`:
   nothing is called.
4. **A request outlives a run** (a long video edit can take more than 20 minutes): `gen.mjs status <out-dir> <id>`
   fetches it, with no new charge. Never submit it again.
5. **The film's spend** is `gen.mjs spent films/<slug>/gen/<step>` for each step, written into the record's Cost line.
6. Everything generated lives in `films/<slug>/gen/`: the prompts (one JSON file per request), the takes, the
   `ledger.jsonl`. Nothing generated is kept outside it, and nothing in it is committed without the person's word on
   its size.

## The pipeline

Every look builds on these steps; its own file adds or changes what it says.

1. **The look bible.** `films/<slug>/gen/look.md`: one STYLE sentence, and a word-for-word descriptor for every thing
   that recurs (the hero object, the place, the people, the product). Both are pasted verbatim into every prompt, so
   the world stays one world. A recurring character's look and style paragraphs come from its bible
   (`characters.md` → A generated look).
2. **A look test first:** four key frames, two takes each, the hardest one first, before any video money. The person
   picks and says yes before the chain.
3. **Key frames.** Each key frame is an edit of the one before (an image-edit model, the previous key as its
   reference), so the world carries over; two takes, then pick.
   - **The story lives here.** A state the voice describes (29 grey, 1 gold; the survivor lit) must already be in the
     key frame: no overlay can recolour a generated object later.
   - **No generated text.** Words, numbers, interface and the brand's mark are drawn in code over the picture. End
     every prompt with "no text, logos or watermarks".
   - "Fills the entire canvas edge to edge, no white border", or an image model draws a paper panel.
   - Check every key frame before it becomes video: a reference's own background leaks in (crop the reference to the
     subject), and what the prompt asked for and the model ignored is fixed by looking, not hoped for.
4. **Segments.** Image-to-video with start = key *i* and end = key *i+1*, 3–15 s, no audio, and a negative prompt
   against cuts, flicker, flakes, debris and morphing. A big jump between two keys gets an in-between key frame.
   Check every take: `ffmpeg -i <take> -vf scdet=threshold=8 -f null -` finds no hard cut, and a 6-frame strip of
   the take is looked at.
5. **The plate.** Each take scaled to 1080×1920, then:
   - its tail morphed onto the next take's first frame, and **that frame appended to the take** (without it every join
     and the loop jump visibly);
   - brought to 120 fps (`node <skill>/tools/footage-120.mjs`, which uses RIFE where it is installed);
   - laid onto its window in the film by **anchors read from the take's own per-frame brightness and edge detail** (a
     screen lighting, a thing landing, a cloud passing), never by proportion. A near-static stretch is never squeezed
     to hit a cue: move the window instead.
   - After every rebuild, measure the step at each join and at the loop: a step over three times the take's typical
     frame-to-frame step is a jump, and is fixed before anyone watches.
6. **Layers in code over the plate** (`kit/Media.tsx`): the hook, captions, the product's real interface (pushed in so
   its labels read), one glow sweep at most. Text over a generated plate takes a wider dark halo than over a flat
   background, because generated skies go white; a second tone is checked for contrast on the brightest frame.
7. **Sound is built, not generated:** foley per visible action from the library or the kit (`sound.md`), never the
   video model's own audio. The look's file says what leads.
8. **Acceptance.** Stills and measurements cannot judge generated motion: a film that passes every frame check can
   look wrong at speed. The approval message says nobody watched it at speed, and a generated film is not called
   final before the person's watch (`film.md` → The gates, Gate 3).

## The AI label

A generated realistic picture (a photoreal person, place, product shot or footage) needs the platform's AI-content
label, like a synthetic voice: the record's `AI label: yes (generated realistic picture)` (`check.md` item 4, `posting.md`
→ The AI label). A drawn or painted look that no one could take for a photograph needs none unless the platform's own
rules say otherwise. Never strip a generated file's provenance metadata.

## Explainer props

Objects on a black stage, each made by an image model, cut out, and moved in 2.5D with live interface on their
screens: the explainer look of illustrated tech reels.

1. **One style sentence shared by every prop prompt** ("premium 3D illustration, soft side light, pure black
   background, no text"), 2K, one image each; the prompts live in `films/<slug>/gen/props/`.
2. **Cut it out** with a background-removal model (`@upload:` the PNG in the request), then
   `node <skill>/tools/prop-prep.mjs <cutout.png> films/<slug>/media/props --name <name>` trims it and writes its size.
3. **A device** (a phone, a laptop) is asked for with its screen as flat `#00FF00`; `prop-prep.mjs … --screen` keys
   the screen into a hole and records its rectangle, so `<PropDevice>` (`kit/Prop.tsx`) draws the product's real
   interface under the glass.
4. **Place** with `<Prop>`: by its centre, with a tilt, a depth blur, a glow in a token's colour, and `cold` to grey it
   out. A dot field drawn in code (hundreds of glowing dots, each a function of its index and time) is the
   through-line between props.
5. **The brand's mark is never a generated prop:** it is `kit/Logo3D.tsx`, extruded from the real path.

Traps: a cut-out keeps only the outline of clear glass, so a glass prop is drawn from the uncut render with
`<Prop glass>` (a screen blend, a radial mask, no shadow, since a shadow outlines the render's black square); a layer
that takes over a rectangle covers what the old layer still draws, so carried objects stay above the new layer until
their move ends; frame 0 is the question boxed, one big centred subject and a glowing object behind it for depth, never
a tilted-phone mockup.

## Red flags

| Thought | Reality |
|---|---|
| "It's a few cents a frame, I'll just try it" | Quote the series, reserve it, and run `--yes` only on the person's word (Spend) |
| "One take per shot should do" | Count the takes the look's file says a kept shot needs, and quote them |
| "I'll recolour the generated object in post" | A state the story needs is in the key frame; an overlay cannot recolour it |
| "The model can write the headline" | No generated text: words, numbers and the mark are drawn in code |
| "The request timed out, I'll send it again" | It is still running and already billed: `gen.mjs status` |
| "Every frame checks out, so it's final" | Generated motion is judged at speed by a person, never on stills |
| "No key, but I can describe a lucid film anyway" | No key, no generated look offered (No key) |
