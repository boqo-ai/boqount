# Recurring characters

## Overview

A recurring character is the brand's own figure who comes back film after film and remembers what happened: a mascot,
a host, a drawn persona. A character exists only on the person's word: creating one, changing its look or voice, and
ending one are theirs to say. Each lives in `brand/<slug>/characters/<name>/`:

| File | What it holds | Rule |
|---|---|---|
| `bible.md` | Who they are, the look paragraph, the style paragraph, the voice, their world and props, the canon table (`templates/character/bible.md`) | Read it whole before writing a word. The look and style paragraphs are pasted verbatim into every generation prompt |
| `ref/` | The locked references: `sheet.png` (the model sheet: front, side, back, the marks that tell them apart), `look.png` (key art), the props; old versions in `ref/v<N>/` | Every generated key frame gets `sheet.png` and `look.png` as its references |
| `memory.md` | The running story: what each film established, in order (facts, relationships, running jokes, promises made to viewers) (`templates/character/memory.md`) | Appended after every approved film. A later film may call back to it and never contradicts it |
| `gen/` | The prompts and generations that made the references, with their cost lines | Kept; nothing generated is kept outside it |

A character drawn in code (a component in the film project, in the brand's tokens) costs $0 and its look is the
component itself: the bible names it (`films/project/src/films/<slug>/<Name>.tsx`, or a shared kit file). A generated
look costs a paid generation per key frame on the person's own key, priced and approved like any paid take
(`production.md` → Prices).

## Working with a character

1. **Read the bible and `memory.md` before the hook.** The story continues; it does not restart.
2. **The look and the voice are locked.** A change to either is the person's explicit call, and becomes a new version
   (`ref/v<N>/`, and a note at the top of the bible saying what changed and on whose word). Never drift silently:
   every key frame is checked against `ref/sheet.png` (the marks that tell the character apart: sides, colours,
   numbers, props) before it is animated, and a frame that fails is made again, never shipped.
3. **The film follows its own format** (`film.md`, and `story.md` for a `product` or `offer` film). The character is
   who carries it.
4. **After the person approves a film:** its row in the bible's canon table, its facts in `memory.md`.

## A character's series

A character's films share one premise, written in the bible in one line, in three beats: the ask (someone wants
something, and the want grows), the turn (the character's line, or the ask turned back on the viewer), the delivery
(the character in their world gives it, and the giving is what the product does, shown). Each film changes the
situation, never the premise.

- **The character never explains.** No feature list from their mouth: the delivery shows it. A narrator line may name
  the function once.
- **They stay in character:** the bible's temperament holds in every line (never hurried, never shouting, if that is who
  they are), and they never fail at the thing they are for.
- **One signature moment a film:** the bible names it (a look, a gesture, a light), and it lands once, on the delivery.
- **A carried object** that never cuts: it moves from one scene into the next, or one thing turns into it.
- **One function of the product a film,** never two.
- **The asker is the star of the ask; the character is the star of the delivery.** In the ask the character is at
  most a voice or a hand.
