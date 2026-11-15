# <brand> style

<draft <YYYY-MM-DD>, awaiting approval | approved <YYYY-MM-DD> by the human>: direction <n> of
`marketing/research/<YYYY-MM-DD>/notes-style.md`, as the human chose and shaped it ("<their words>", <YYYY-MM-DD>).

Every item names its source: an observation in a note (a link, what the frame shows or a quote, the date read), or
the human's words and their date. An item with no source is not written. The rules above Observations change only
on an approved refresh (`/boqount-research`).

## Tokens

Read by `node <skill>/tools/film.mjs theme` into the film project. One `key: value` per line; a line that starts
with `#` is a comment, and nothing may follow a value on its line. Colours are opaque hex (`#rrggbb`). A font other
than Inter needs its files in `brand/<slug>/fonts/` (`brand/<slug>/assets.md` → Fonts).

```tokens
# canvas: the film's background. Source: <…>
canvas: <#rrggbb>
# panel: cards and panels on the canvas. Source: <…>
panel: <#rrggbb>
# ink: the main text. Source: <…>
ink: <#rrggbb>
# muted: secondary text and quiet lines. Source: <…>
muted: <#rrggbb>
# accent: the one colour that marks what matters. Source: <…>
accent: <#rrggbb>
# accent2: a second accent, for a contrast or a second series. Source: <…>
accent2: <#rrggbb>
# danger: a loss, an error, a warning. Source: <…>
danger: <#rrggbb>
# font_display: titles and headlines, a font family name. Source: <…>
font_display: <family>
# font_text: running text on screen, a font family name. Source: <…>
font_text: <family>
# radius: the corner radius of cards and panels, in px. Source: <…>
radius: <number>
# motion: how things move: snappy, smooth or bouncy. Source: <…>
motion: <snappy | smooth | bouncy>
```

## Look

- **What the picture is made of:** <drawn shapes, the product's screens, photographs, stills and short shots of real
  things, a character, …>. Source: <…>
- **Generated look:** <none | one of `<skill>/gen.md`'s looks (lucid, live-action, comic, vibe, integrated VFX,
  explainer props), only with a fal key, and what a film in it costs as an order of size>. Source: <…>
- **Illustrative first, here:** the picture shows the thing the line names. <The things this brand's lines talk
  about, and how each is shown: a place, a screen, an object in a hand.> Source: <…>
- **Pace:** <how long a beat holds; how the camera moves>. Source: <…>
- **Text on screen:** <size, place in the frame, words at once>. Source: <…>
- **One meaning per hue:** <each accent token and the one thing it means in every film: "this one, now", live, a
  link, failed>; no gradients in the interface's chrome. Source: <…>

## Language

- **Address:** <one form of address, and the viewer's things by their own words>. Source: <…>
- **Tone:** <one line>. Source: <…>
- **Series:** <name> — "<fixed opening line>" — <how episodes are numbered>. One line per series, the same as
  `marketing/strategy.md` → Rubrics; a change goes into both. Source: <…>
- **The end:** the payoff or the first picture again; never a call, a logo or a link. <This brand's way of it.>
  Source: <…>
- **Caption grammar:** <line 1, what follows, hashtags (how many), the credit line for outside material last>.
  Source: <…>
- **Callbacks:** <one a week to an earlier episode, so a returning viewer is rewarded: how this brand does it>.
  Source: <…>
- **Replies:** the comments are part of the voice, answered by hand, never by automation (a code word's DM rule is
  not a reply); <the brand's pinned comment, if any, and what it may say>. Source: <…>

## Devices

Two or more things that repeat in every post, so the account is recognisable with its logo covered.

- <the device: what it is, where it shows, how often>. Source: <…>
- <the device>. Source: <…>

## Sound and voice

- **Voice:** <voice-free: text on screen and the on-screen seam | voiced: the voice id <id>, and every voiced film
  carries the platform's AI label (`<skill>/posting.md` → The AI label)>. Source: <…>
- **Music:** <none | a bed: where it comes from and its licence (`brand/<slug>/assets.md` → Sounds)>. A source's song
  is never the bed. Source: <…>
- **Sound effects:** <a hit on every visible action | fewer, and where>. Source: <…>

## Not this

- <what the style does not do, and why: a worn-out habit the note found, a look the human ruled out>. Source: <…>

## Observations

Dated lines the day runs add: the human's edits at the gate, and what the numbers show. They change no rule above;
the next refresh reads them.

- <YYYY-MM-DD> <the human's edit at the gate, in their words, and the post | what the numbers show: the posts, the
  measure, the read> — bears on <the section and item above>
