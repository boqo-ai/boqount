# A reference, a trend or a meme: studying it, and carrying it in

Read by `film.md` → Steps 0 and → A reference. A film modelled on another video copies its **skeleton, devices and
graphics' grammar**, never its topic, words, pictures, colours or product. The account's own format still holds:
where the reference does something else, the reference is adapted, not the format.

## Ask first, on every film

Before any hook, one question, even when the idea looks complete: **a meme to weave in, a trend (a sound, a
catchphrase, a shape), a video to model the film on, or none**, each with its link. One multi-choice question when the
person is in the conversation; in a run with nobody there, the plan's line for the film asks it and the film goes on
with none, its record saying `Reference: none (not asked: <why>)`. A meme found after the script costs a rewrite.
Whatever comes back is studied below before a hook is written.

## Study it: every word, every frame

`node <skill>/tools/reference.mjs study <file-or-link> --out films/<slug>/reference/` (`films/.gitignore` keeps
every film's `reference/` out of git: it is someone else's video; its `beats.md` is copied into the record). A link is downloaded with yt-dlp when it
is installed, only when the person gave it for this film, only to study it: nothing from it is posted, re-cut or
redrawn. Without yt-dlp the person saves the file. An image post has no video: a screenshot of it, read the same way.

| What | What the tool writes | Read it for |
|---|---|---|
| Every word | `words.json` (whisper-cli, when installed), words a second | Where its sentences break, how fast it talks, the exact wording of its hook |
| Every frame | `sheet-NN.jpg`, 2 frames a second, 6 × 4 (`sheets.md` gives each sheet's seconds); a full-size still after every cut | What each line shows, what is new on screen and when |
| Cuts | `study.json` → `cuts`, `cutTimes` (scdet, threshold 8) | How much is real cutting and how much is carried motion |
| How it loops | `first-last.jpg` (the last frame beside the first) | Whether its loop is in the picture, in the words, or only in the meaning |
| Sound | integrated loudness and true peak; `spectrum.png` | Dark bands between the lines are a voice with no bed under it; a full band is music throughout |

Then write **the beat map** in `beats.md`: the tool gives one row per sentence with its time, its words and its
nearest still; fill each row's Picture (what it shows) and Device (question hook, reveal, "including this one",
parts, proof number, payoff, loop, meme). Show it to the person beside the script, so they can see which beat became
which line. It goes into the record under Source with the reference's link.

## When the look is the point, study the creator's other videos too

A video that talks about other videos (its own hits, a series), or a person who says "the graphics, like this", points
at a look. Take the links the person offers, or read the creator's profile page for the most watched ones (a logged-out
page, its view counts); study the top few and any the reference shows:
`node <skill>/tools/reference.mjs sheet <file> --every 3` (6 × 5, one frame every 3 s), plus full-size stills of the
richest frames. **Name what makes the look before designing anything:** the kind of props and how they are lit, the
overlays drawn over them, the labels and small notes, the camera (macro, receding planes), the caption style. That
list is grammar the film may use in the brand's own look (`brand/<slug>/style.md`), never the creator's pictures.

## Carry the skeleton over

- **Map every beat to one line of the film's script,** keeping the device and changing the subject: the reference's
  question becomes a question to this film's viewer; its "even this one" reveal becomes a reveal about this product.
- **Keep its signature devices:** parts with a spine on screen (shown as a flow, never numbered: `script.md`), the proof
  number (replaced by a number of the film's own, from its own source), a payoff that turns the answer onto the
  viewer.
- **Where it breaks the account's format, the format wins:** a loop only in the meaning becomes the format's seam; its
  cuts become carried objects and one camera (`film.md` → The locked format); no music becomes the format's mix. For
  an opportunity story, the story's ten parts (`story.md`) hold and the reference lends devices inside them.
- `script.md` still binds: one topic, plain words, every number with a unit and a reason.

## Weave a meme in natively

1. **Name its signature, its mechanism and its phrase.** Signature: what people recognise in half a second (a shape,
   a layout, a pose). Mechanism: what it says (for example "many go to a few, while the rest get nothing"). Phrase: any
   words it carries.
2. **Carry the mechanism into the film's one topic.** The meme's original subject appears at most as a single nod in
   the words.
3. **Keep the signature literal enough to be recognised,** drawn in the film's own look. Then let the product **flip
   the shape** (what was crowded spreads evenly, what was tangled straightens): that flip is one of the film's
   full-frame hits (`motion.md`).
4. **Place it where the story needs its strongest picture,** usually the problem made visible near the middle.
5. It is an ordinary scene of the no-cuts chain: it inherits an object from the scene before and hands one on.
6. **Never explain the meme, never show its original image.** Anyone who knows it gets the nod; anyone who does not
   still gets a clear picture of the problem.

## Red flags

| Thought | Reality |
|---|---|
| "The brief is complete, no need to ask about a reference" | Step 0 on every film: one question, before the hooks |
| "The reference was about X, so ours is about X too" | Its skeleton, devices and grammar; never its topic |
| "Their loop is only in the meaning, ours can be too" | The account's format wins where the reference breaks it |
| "I'll paste the meme's picture in, everyone knows it" | Its mechanism in the film's topic, its signature redrawn in the brand's look, the product flips it |
| "A line explaining the meme, for those who don't know it" | Never explain it: the picture of the problem carries those viewers |
| "I'll just download a few of their videos to cut from" | Downloads are for studying only; nothing from them is posted or redrawn |
