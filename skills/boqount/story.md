# The opportunity story: the format of `product` and `offer` films

Read before the hooks, the script and the storyboard of a film of layer `product` or `offer`. For those films this
format replaces the locked format's items 3 to 6 (`film.md` → The locked format: no cuts, the seam loop, the picture
loop, a loopable length) and the five parts and the seam (`hooks.md` → The arc). Everything else still binds: the hook
rules it keeps below, the feed file, the three gates, real labels, outside material, nothing flashes, the safe area
and the sound. A `niche` film stays as `hooks.md` has it.

**Where it comes from, and what is known.** One reference film, posted by a new account, reached many times more
viewers than that account's other posts. Read frame by frame, what set it apart was: its first line was a number about
something everyone knew, with a counter on frame 0; its story was an opening the viewer could step into; the product
was named only near the end. Its length and its call did not explain the reach: a sibling post with the same call
reached a fraction of it. **One reference is one case.** Until two of the account's own films in this format have
their verdicts (`measure.md` → Learning), every record in it says, in its Hypothesis, `the format is being tested`,
and the weekly report reads those films as a test of the format, not as proof of it.

## The script: ten parts, 60 to 85 s

160 to 230 words (seconds ≈ words ÷ 2.7, `script.md` rule 9). The script's `Structure:` line says
`Layer: product` (or `offer`) and names each part by its line numbers.

| # | Part | What it is | Example (Quillfern) |
|---|---|---|---|
| 1 | **Hook: the number, then the twist** | A number about an event everyone knows, from a source anyone can open, said the way the source says it. Then one line that turns it | "Nine in ten summer trips last a week or longer. / Your plants aren't coming." (its source on screen) |
| 2 | **Proof** | One more sourced fact about the event's size | "<one more sourced number about the summer's trips, with its source on screen>" |
| 3 | **Catch** | The true gap in the event: who is left out, what is missing | "But a fern lasts about a week without water. Not two." |
| 4 | **Who is left** | The many people the gap makes, and what they will do instead | "So plenty of plants get a neighbour with a key. / And a note on the fridge." |
| 5 | **Where you come in** | The second person, for the first time: the opening is the viewer's | "If you're leaving plants behind, this part is yours." |
| 6 | **What most do** | The usual way, and why it loses | "Most people water everything the night before. / Then hope. / By day ten, the fern has had enough." |
| 7 | **Turn** | One line that says not to | "So don't water and hope." |
| 8 | **The product at work** | The product, named here for the first time, doing the thing in its real labels, in two to four lines | "Quillfern knows what each plant drinks. / It sends one reminder on the day a plant needs water. / Share the plants, and the reminder goes to your neighbour." |
| 9 | **Payoff** | The result, as the viewer's gain, in the brand book's payoff words when it has them | "You come home to every plant you left." |
| 10 | **Call** | The film's last line, and its only ask | "Comment FERN, and I'll send you the link." |

- **The hook asks for nothing and names no product.** Its number is real, has its source on screen by 0.5 s (the kit's
  `SourceLine`), and is called what it is: an estimate is "estimate" on screen, with the date it was reported. It need
  not say "you": the second person arrives in part 5, and no later.
- **The catch is true:** a gap that exists and that the viewer can check. No made-up scarcity, no "nobody is talking
  about this".
- **Softened where nobody can know.** "Plenty of people will", "many", "can already be": a line about what others do or
  will do is never stated as a count nobody holds.
- **The product is named once before the payoff, in part 8, never earlier,** and does only what its page says it
  does (`motion.md` → Real labels). What it costs goes in the caption, in the brand book's own words
  (`brand/<slug>/brand-book.md` → Facts).
- **Money:** a payoff about money states no amount and promises no earnings (`brand/<slug>/brand-book.md` → Claims);
  a disclaimer the brand book's Legal asks for goes in the caption.
- **The call** is `Comment <code>, and I'll send you the link.`, with the code word of the film's rubric
  (`brand/<slug>/brand-book.md` → CTA; its row in `brand/<slug>/accounts.md` → DM automation). One call, in two places:
  the voice's last line (in a voice-free film, the last on-screen line), and the caption's last sentence of its own
  words, before any source line, the credit line and the hashtags (`check.md` → The checks, in order: item 3). Nothing else in
  the film or under it asks for a follow, a click or a visit.
- **A dated number is read again on the posting day.** The record's Posting carries `- Re-read before it posts:` with
  each fact that can move (an estimate, a release date, a "no date yet") and where it is read (`posting.md` → The
  buffer). A fact that turned false stops the post.
- Gate 1 runs as for every film (`film.md` → The gates): two viewers from the audience, and a fact-checker on every
  outside fact.

## The picture

1. **Frame 0 is the number, already moving:** a very large counter (`Odo`) running on the first frame, the thing it
   counts behind it, its source line under it by 0.5 s. No title card, no product and no product interface before
   part 8.
2. **Scenes change.** One world per part, about ten, a change every 6 to 8 s, each on a spoken (or shown) word: a
   designed move of at most 0.4 s (a push through, a wipe by an object, a pull-out into the next world) or a hard cut
   on the word (the kit's `WorldChange`). Inside a world the usual rules hold: one camera, things carried and
   transformed, no jump (`motion.md` → Rich motion). No full-frame flash at a change (`motion.md` → Nothing flashes).
3. **Captions carry the film on mute** (the kit's `Captions`, from `cues.json`): two or three words at a time, each on
   its own cue, heavy capitals of about 96 to 130 px in the style's own type, white (the style's ink) with the
   phrase's key word in the world's accent, in one fixed place for the whole film (centred, baseline about 58 % down,
   above the platforms' bottom 35 %), on a soft dark plate. Never two blocks at once, and no other text in that band.
   In a voice-free film the captions are the film's words.
4. **One picture per sentence, readable in a second:** a counter, three cards, a crowd, a bar, a screen. It shows the
   sentence as it is said (the lock shuts on the word). The picture has the upper part of the frame; the caption band
   has the words.
5. **Each world has its own two colours,** derived from the style's tokens (`motion.md` → The kit: no colour
   literal). The product's scenes are the product's own look (`brand/<slug>/style.md` → Look).
6. **The product arrives late and plainly:** its name large, then the thing working, in its real labels.
7. **It does not loop.** No seam line, no hook layer drawn twice, `"loop": false` in `sfx-cues.json`. The last scene is
   the call, shown (a comment typed and sent, a reply arriving), held about 1 s after the last word, the music ending
   with it. No logo card and no link on screen; the reply may carry the brand's small mark as its sender's picture.
   The length is still a whole number of 30 fps frames (`film.md` → The locked format, item 6's rounding).

A film modelled on a reference follows `film.md` → A reference.

## Build and checks

- **The template:** the film's scenes start from `films/project/src/films/_story/` (`film.md` → The project), which
  has the captions, the world changes and no loop machinery. The starter film (`films/starter/`) is a worked example of
  this format.
- **Sound:** `film.md` → Sound, with `"loop": false`.
- **The locked format's checks all run except the loop check** (the last frame against frame 0): drop it and say so in
  the film's own checks. `boqo-upload.mjs probe` still reads `passthrough` and `loopSafe` (that flag is about B-frames
  and the edit list, not the picture).
- **The file's words** (`production.md` → The file's words) on `mix.wav` of a voiced film give the script back; a film
  over 60 s is transcribed in parts.
- **Gate 1's viewer brief** leaves out "The video loops, so the last line runs straight into the first."
- **Gate 2's director** reads the stills every 1.5 s as always; in the brief, "It has no cuts and one travelling
  camera" reads "Its worlds change on spoken words, about every 6 to 8 s; inside a world it has one travelling
  camera", and "The loop" is left out of item 1.
