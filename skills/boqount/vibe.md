# Vibe: a product's world, not an advert

## Overview

A generated look (`gen.md`) for a physical product, a drop or a collection that sells by making people want into its
world. No film made this way has been measured: replace these rules with what the first test shows. The pipeline is
`gen.md` → The pipeline, scaled down.

**One film per piece.** Each film sells one piece and links straight to that piece's page, with the link's tracking
fields naming the film and its cut, so a sale can be traced to it. Make one film at a time, the strongest piece first,
and let the previous film's orders reorder the list. Judge by orders, not by views or the platform's reports.

## What changes from the locked format

Said in the storyboard; everything not named here still binds.

- **No voice, no captions, no voice seam.** Picture and physical sound carry it.
- **12–15 s.** A judgement, not a measurement: half the viewers leave by about 4 s.
- **The 120-sample blend and any vibrance boost do not apply** to generated footage (`live-action.md`).
- **No cuts and a picture loop stay:** one object carried and transformed from frame 0 to the last frame, which grows
  into the first; the sound is circular too.

## The rules of the film

1. **The piece is in frame 0**, recognisable and already moving, the brand's colour already on screen. No dark opening,
   no logo; the mark is readable within 4 s.
2. **One physical idea:** a single material process that passes the mark between pieces (pressing, knitting, casting).
   It makes sense with the sound off.
3. **No price, no "buy", no "shop now", no features named.** The film makes the question; the caption, the button and
   the page sell.
4. **Fewest people possible:** hands and skin only unless the brief needs more.
5. **Exact product fidelity.** Every piece matches its reference: shape, proportions, the mark's strokes. A key frame
   where the mark drifts is rejected, never repaired with an overlay. A piece that will not be made is never shown.
6. **Materials are the luxury:** macro, one hard raking light, real fibres, pores and machining marks, near-black
   surroundings, the brand's colour only on the material. No glow, particles, lens flares or fast edits.
7. **Sound is what the object does** (wax, metal, thread, skin): foley per visible action, no music bed by default;
   compare with a low sparse pulse before choosing.

## Quality gates

A film that fails one is not finished.

1. **The product never changes on screen.** Its pattern, mark and stitches stay identical through any camera move.
   Never join separately generated close and wide frames with a video model: it morphs between two objects. Build the
   move on one very high-resolution image, so identity holds by construction; check frames at different zooms,
   aligned and compared.
2. **Pull-back only:** the film opens in macro and only moves away.
3. **Quality and realism first:** real skin, fibres and light falloff, sharp at the first and last zoom; anything
   plastic, waxy or smeared is regenerated. Video-model motion runs only where the camera holds still, and only for
   life: a breath, a blink.
4. **The outro is the fewest words in the most style:** what to type or where to go, and that the run is limited.
5. **Three openings for the ad test:** only the first 2 s change, so one film buys a creative test.

## Lettering

Two layers, both drawn from the brand's mark: heavy words in shapes taken from it, small words in one hairline weight.
One colour accent, on the word to act on; everything else in the neutral. **No shape that reads as a cross or a
dagger**, checked on every ornament. **Letters arrive whole:** a stroke-by-stroke reveal looks like a render error on
any paused frame.

## Technical traps

- **Colour tags:** ffmpeg drops the colour primaries and transfer when frames arrive untagged. Write them with
  `-bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0`
  and confirm with `ffprobe`.
- **A composited shot takes the film's grade exactly**, in the same colour space the grade runs in (ffmpeg's `eq` and
  `hue` work on limited-range planes: the same numbers on RGB lift the shadows), with no grain the other shots lack.
- **Never re-encode finished shots through an image library** (it shifts chroma): trim and join in YUV, and compare the
  untouched shots with their source after any assembly.
- **Hidden cuts inside a shot:** after every cut, list the per-frame steps above three times the shot's typical step
  and look at each one.

## Lines it must not cross

Also in `check.md` item 4. A vibe film:

- never strips the files' AI provenance metadata; a law on synthetic performers may require a visible disclosure in an
  ad, so the caption's wording is read by someone with legal training before any paid use;
- shows no blood, cuts, branding on skin, knives or harm, and no group of masked people entering a dark space as its
  opening (it reads as a threat);
- promises no powers: no protection, luck or any effect;
- shows adults only;
- has its mark checked against hate-symbol databases before any paid use.

## After the film

Post it organically first, then run the same post as an ad after 48 h. The caption: a mood line, then the facts of the
offer (made to order, the delivery time, where it ships) and that the images are AI concepts. Gate 1 reads the
storyboard as what is seen and heard: pass means two viewers from the real audience can say what they saw and want to
know what it is. Gate 2 adds a person checking each piece against its reference; Gate 3 is the person's watch at speed.
