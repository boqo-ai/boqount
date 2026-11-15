# Writing a film's script

Read before writing or editing a film's lines, spoken or on screen, together with `brand/<slug>/style.md` → Language.
The script is `films/<slug>/script.txt`.

## The rules

1. **One topic per film.** One function of the product, one problem, one promise: one product story per film. A line
   about anything else (another feature, a side benefit) is cut and parked for its own film.
2. **Every line leads into the next.** Read the script aloud as a chain: each line answers or follows from the one
   before. If a line can be deleted and the next still follows, it was filler. A line that needs a picture to make
   sense is broken: a picture cannot rescue a sentence whose noun is missing.
3. **Simple words only:** words a 12-year-old uses. No trade jargon, and no abbreviation the voice has to spell out.
4. **Every number has a visible unit and a reason.** "Three days", not "three"; "since you last watered", so the
   viewer knows what the days are. The arithmetic shown on screen adds up.
5. **Every sentence has a subject the viewer already knows.** "It", "this", "that" only when the noun was said in
   the line before. No process without an actor ("Watering? Another chore." Whose?).
6. **The order is its layer's parts** (`hooks.md` → The arc), and the script's `Structure:` line names them. A `niche`
   film's last line of content is the payoff and the seam follows it; no line asks the viewer for anything (an ad cut
   carries only the brand book's call line, where The arc puts it). A `product` or `offer` film is the ten parts of
   `story.md`, its last line the one call, with no seam.
7. **Short lines.** Most under 8 words, none over 15. One idea per line: split a line rather than lengthen it.
8. **Claims are true of the product today** (`brand/<slug>/brand-book.md` → Facts). A number framed as an example may
   be illustrative; a capability may not.
9. **Length from the words, never a guess:** seconds ≈ words ÷ 2.7, spoken or read on screen. A 27–30 s `niche` film
   is about 75 words, ten or eleven lines; a 60–85 s opportunity story is 160 to 230 words. Too long: cut lines, never
   speed the voice past tempo 1.15.
10. **Softened where nobody can know.** A line about what other people do or will do says "plenty", "many" or "can",
    never a count nobody holds; a line about an outside fact says no more than its source ("announced", not
    "launched").
11. **Spoken like a creator talks to camera, not written like prose.** Casual openers ("okay, so", "here's the
    thing"), contractions, a question answered right away ("Week three? Maybe one post."), plain verbs. No literary
    devices: no triplets of parallel fragments ("Same idea. Same talent. Same budget."), no aphorisms, no rhythm for its
    own sake, no line that reads like a poster. Read it aloud: if it sounds like a voice-over for an advert or a poem,
    rewrite it as a text to a friend.
12. **No numbered lists, in the voice or on screen.** "One:, Two:, Three:" and numbered chips sound and look robotic.
    Steps flow the way a person tells them: "It reads… Then it… You say yes or no… And it checks…". One exception: a
    how-to whose steps the viewer will repeat may number them on screen when its rubric is that format; its voice
    still tells them as a person would.

## Checklist before voicing

- [ ] Every line is about the film's one topic.
- [ ] Read aloud, it sounds like a person talking to camera: no triplets, aphorisms or poster lines.
- [ ] No "One:, Two:" in the voice, no numbered chips on screen (a numbered how-to rubric excepted).
- [ ] Read aloud, each line follows from the one before; none can be removed without breaking the chain.
- [ ] No word someone outside the trade wouldn't use.
- [ ] Every number has a unit and says what it is for; the arithmetic on screen is right.
- [ ] Every "it", "this", "that" points to a noun in the line before.
- [ ] The parts are the layer's, in order, and the `Structure:` line names them; a `niche` script names the product
  nowhere.
- [ ] The payoff names what the viewer gains.
- [ ] `niche`: no line asks for anything (an ad cut: only its call line), and the last line of content is the payoff,
  then the seam. `product` or `offer`: the product is first named in part 8, and the one call is the last line.
- [ ] The words fit the length: words ÷ 2.7 ≤ 30 s for `niche` (or the 45 s a chain explainer asks for); 60 to 85 s
  for the opportunity story.
- [ ] The script passed Gate 1 (`film.md` → The gates) before any voice or scene work: every scene built on a line
  that later changes is rework.

## Mechanics

- **`script.txt`'s shape** (the starter's is the example): a header with the film's name and one line on what it is,
  the frame 0 text, for `niche` the series and the episode number on one line, then the one structure line,
  `Structure: Layer: <niche | product | offer> — <part> <lines>, …`; then the numbered lines (a `niche` film's seam
  last, marked as finished by line 1; an opportunity story's call last); then the word count and the length estimate.
- **Numbers are words in the voice and digits on screen:** `"text": "three days"` in `vo-plan.json`, `"display":
  "3 days"` for the screen.
- **A name the voice may misread** is written in `text` the way it should sound (a name in capitals may be spelled
  out letter by letter); its on-screen form goes in `display`.
- **A homophone beside a number** misleads the voice and the viewer alike. After voicing, transcribe the assembled
  `vo.wav` (`production.md` → The file's words) and compare it with the script word by word.
- **Voice-free:** `cues.json` is written from the on-screen text at the reading speed of rule 9, each line held until
  it has been read (`film.md` → Sound).
