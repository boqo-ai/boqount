# Carousels: a story told in stills

## Overview

A carousel is one topic told one or two sentences a slide, rendered as 1080×1440 stills (3:4) from the account's
film project. Its look is fixed by the project's carousel template (`films/project/src/films/_carousel/`), drawn in
the brand's tokens and faces (`brand/<slug>/style.md`): copy it, change the words, keep the design. The script's rules
(`script.md` → The rules) hold for every slide, and so does the Line: no invented count, no claim the product does not
make today.

## The look

- **Grounds:** the slides alternate the canvas and its inverse (the ink as the ground, the canvas as the words), each
  with a fine grid at a few percent; the cover is plain.
- **The one word a slide leans on** (`*word*` in `slides.ts`) is in the accent where the accent reads on that ground
  (3:1), else on a highlighter of the accent behind it. Never accent words that do not read.
- **The cover:** the hook in four short lines, in capitals in the display face, each kept to one line (the block's size
  comes down until the widest fits), its key word on a solid accent block, ending on "…" so the thumb swipes.
- **The body:** a headline and one supporting line, left-aligned on the margin, centred top to bottom.
- **The swipe cue:** a sticker of the accent with an arrow, bottom right of the second slide.
- **The mark:** the brand's logo file at the bottom left of the cover and the last slide. Nothing else signs a
  carousel: never another creator's name, handle or signature, even when their carousel gave the shape.
- **Small print:** a slide whose claim comes from outside shows its source at the foot (`source` in `slides.ts`).

## Slide kinds

| Kind | What | Fields |
|---|---|---|
| `cover` | The hook, four lines in capitals | `lines` |
| `text` | A headline and a supporting line | `head`, `sub`, `source` |
| `one` | A single line, large: the turn, a punch | `line`, `source` |
| `rows` | Named rows: a comparison, a cost, rules by place | `head`, `rows` (`name`, `text`, `note`), `source` |
| `list` | A headline and short items, each with a mark, never a number | `head`, `items` |
| `end` | The last slide, in capitals | `lines` |

Add a kind only when none of these fits, and in the same visual language (`Carousel.tsx` in the carousel's folder).

## The arc

Hook cover → the problem → its cost → the turn → what the product does, in plain words → the payoff, as the reader's
gain → the end. About twelve slides; a short one (six) folds the turn into the list's head. One topic, one function of
the product. Each slide follows from the one before: a slide that can be deleted without breaking the chain is fluff.

A carousel takes a layer like any post (`production.md` → What the day makes). A `niche` carousel has no product in it:
its turn is an insight, and its last slide asks for nothing. A `product` or `offer` carousel's last slide carries the
film's call only where a film's would (`story.md` → The script: ten parts, 60 to 85 s, and the check's holds), in the
caption's wording.

## Steps

1. **A reference carousel, when the person gives one:** study its structure, never its words, colours or signature.
   With a browser tool, open the post, step through its slides and save each image to a fresh scratch folder; read them
   there.
2. **Research every outside claim** (platform rules, dates, numbers): primary sources, the exact quote, its date, in
   `films/<slug>/sources.md`. A number with no credible source is dropped; an illustrative number reads as an example.
   A date is read from its source that day, never from memory.
3. **Check every product claim** against the brand's own pages and the brand book: only what ships today, only what
   was measured. A claim that cannot be checked is rewritten as what the feature does.
4. **Build:** `node <skill>/tools/film.mjs new <slug> --carousel`, then write only
   `films/project/src/films/<slug>/slides.ts`.
5. **Render**, below, and **read every slide** at full size and the contact sheet. A word left alone on its last line
   is held to its neighbour with a no-break space, written as the escape ` ` in `slides.ts` ("3 hours"),
   never fixed by shrinking the type.
6. **The caption,** in `films/<slug>/caption.txt`: the hook line → a `→` list of the facts → the turn → what the
   product does → the payoff in one line → the call where the rules allow one → a `Sources:` line → the strategy's
   hashtags.
7. **The post:** the record's Kind is `slideshow`, its file the slideshow video made from the slides
   (`production.md` → A slideshow): the posting tool takes video. The stills (`films/<slug>/out/slide-NN.jpg`) are
   ready for the person to post by hand as a carousel where a network takes one; that post goes by hand like any other
   (`posting.md` → By hand), and the record says which was posted.

## Render

From `films/project`:

- `npm run slides -- <Id>`: every slide to `films/<slug>/out/slide-NN.png` (2160×2880, the master) and
  `slide-NN.jpg` (1080×1440, the file to post), then `films/<slug>/out/sheet.jpg`, every slide four to a row.
- `npm run slides -- <Id> 3,7`: only those slides, after a fix; the sheet stays as it was.

## Common mistakes

| Mistake | Fix |
|---|---|
| The reference's colours, fonts or signature | The reference gives the structure only; the brand's look wins |
| Negative tracking on a condensed display face | Letters collide; keep the cover's tracking at 0 or more |
| The accent as words where it does not read | The template puts it on a highlighter there; never force it |
| A platform rule or date from memory | Read it at its source that day, quote it in `sources.md` |
| "Adding captions makes it original" | The platforms say captions, borders or speed changes alone do not count; say what the edit really is |
| Re-rendering the whole deck for one fix | `npm run slides -- <Id> <n>` |
| A numbered list on a slide | Items carry a mark; the steps read the way a person tells them |
