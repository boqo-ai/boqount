# Sound: the standards, the library, the checks

What every film's sound is held to, where each number comes from, and how the account's sound library is made. The
rules a film is built by are `motion.md` → Sound follows the picture; the sheet, the mix and the check are `film.md` →
Sound.

**Nobody hears anything in this pipeline.** Every check below is a measurement or a model's reading. The person's listen at full speed is
the only judgement of how a film sounds, and every report says so.

## The standards, and where each comes from

No platform publishes its loudness numbers. Where sources disagree, it is said. Re-read a source before leaning on a
number it gives: these change.

| What | The number | Source |
|---|---|---|
| Master loudness | -14 LUFS integrated, at most -1 dBTP | YouTube's reference, turn-down only: a quieter upload is not raised (meterplugs.com/blog/2019/09/18/youtube-changes-loudness-reference-to-14-lufs.html, productionadvice.co.uk/youtube-loudness). Instagram levels on the device from metadata and states no target (engineering.fb.com/2023/04/11/video-engineering/high-quality-audio-xhe-aac-codec-meta). TikTok: third parties say -14 or -16; no controlled test found |
| Music under the voice | 15 to 20 dB | creator guides (shortzly.com/blog/short-form-video-sound-design, pixflow.net/blog/audio-mixing-premiere-pro); a mixers' forum rejects any fixed number (creativecow.net/?p=2139815): a start, not a law |
| Effects under the voice | 12 to 18 dB; an effect clearly heard beside the voice is 5 to 8 dB too loud | the same two guides |
| A phone's speaker | plays almost nothing under 200 Hz; a phone held upright is one speaker | blog.landr.com/make-bass-audible-phone-speakers, waves.com/tips-for-great-mixes-on-small-speakers (which puts the roll-off higher still) |
| Low sounds on a phone | give them harmonics at 250 to 700 Hz and a transient at 700 Hz to 2 kHz; the ear puts the low note back | the same two |
| Speech is understood at | 1 to 4 kHz | the same two |
| Sync | a sound heard more than 45 ms early or 125 ms late reads as out of sync: never more than one frame early at 30 fps; the transient on the frame, not the file's start | ITU-R BT.1359 as reported by tvtechnology.com/opinions/av-synchronization-how-bad-is-bad; morphic.com/resources/how-to/how-to-sync-sound-effects-to-video |
| Repeats | the same take twice in a row is the "machine-gun effect": several takes of each sound, rotated, the pitch moved a little | musicradar.com/tuition/tech/how-to-avoid-the-machine-gun-effect-using-round-robin-sampling-632302 |
| How much | one sound for one event, two at most; loud effects with no pauses ("retention editing") are what viewers tired of | shortzly (above); gigazine.net/gsc_news/en/20240403-retention-editing-beastification-may-be-end |
| Frequent sounds | the more often a thing happens, the shorter, quieter and less melodic its sound; silence is part of the design; progress can be a cadence, IV to V to I | Google's Material sound guidance (design.google/library/ux-sound-haptic-material-design) |
| Fit | a thing sounds the way it looks: a small object, a small sound | Apple, WWDC 2019 session 810 (developer.apple.com/videos/play/wwdc2019/810) |
| Pitch | risers and pitched marks are tuned to the music's key | soundbridge.io/en/design-your-own-fx-transitions |
| Sound off | no platform publishes a share; one US survey (Verizon Media and Publicis, 2019) had 92 % watching mobile video muted | nexttv.com/news/mobile-videos-often-watched-without-audio-study-finds |

Not found in any source that could be checked, so not rules here: an effect every so many seconds, hits on the beat,
any named channel's style.

## The library

The account's own sounds, in `films/sounds/`: `spec.json` is what is asked for (it starts as the skill's list of 56
sounds; the account adds its own), `library.json` lists what was kept, `library/<group>/<name>-<n>.flac` are the
files. A film names a sound by its id (`ui/click`) and the mixer rotates its takes.

| Group | What is in it | Use |
|---|---|---|
| `ui/` | click, tap, key, typing, switch, pop, pop-low, tick, counter, send, notify, error, success, slide, progress, shutter, scrub, chat-flurry | what a pointer, a finger or a keyboard does |
| `move/` | whoosh-air, whoosh-low, suck, riser-short, riser, downlifter, reverse-cymbal, shimmer, glitch, tape-stop, whizz-slow, liftoff, deflate, fizzle | air a moving thing or the camera pushes; a build; energy leaving |
| `hit/` | thud, boom, punch, slam, stamp, clank | weight landing |
| `foley/` | lock-shut, lock-open, lock-rattle, paper, cards, scissors, laptop-close, marker, swipe, rustle, coin, cash, heartbeat, sauce-pour, page-flip, cup-down, wrench | the thing itself |
| `crowd/` | cheer, gasp | people, never a named one |
| `amb/` | city-dusk, room, office-keys, night, morning, crowd-murmur, screen, laser-hum | the air of a world: long, quiet |
| `tone/` (per film) | pluck-1 to -6, blip-1 to -3, bell-1, bell-5, confirm, resolve, deny, riser-1, riser-2, fall, shimmer, sub, pad | pitched marks in the key of the film's music (`film.md` → Sound) |
| `kit/` | the sixteen synthesized sounds (`motion.md` → Sound follows the picture) | what carries a film without a library |

Each entry's `use` says what the sound is for: **pick by `use`, by what the thing on screen is, never by habit.** An
entry's `note` says what to know first: some carry a pitch of their own (so under music the tonal set goes instead);
two backgrounds can read as speech (so never under a line that must be understood).

**How a take gets in:**
1. **`gen`** asks ElevenLabs for `candidates` takes of each entry, one paid call a take, kept or not, with the person's
   own key. Without `--yes` it only says how many takes and seconds it would ask for: price that from `production.md`
   → Prices, reserve it in the budget, and run it with `--yes` on the person's word. A take that comes back silent is
   asked again of the older model. A tiny one-shot (a tick, a click, a key) is asked as several seconds of the same
   thing (`"slice": true`) and cut into single events.
2. **`build`** trims each take to its onset (a hit starts 3 ms before its first sample 20 dB under its peak), fades its
   tail, levels it (a background to -30 LKFS, the rest to a -3 dBFS peak), gives a take that lives under 150 Hz
   harmonics at 200 to 1200 Hz (`body`) so a phone plays it, and keeps up to `keep` takes within the entry's limits
   (`min` and `max` length, `minCentroid` brightness). It measures each one (length, `sync`: where it peaks, `loud` and
   `phone`: its loudest 400 ms, whole and with nothing under 200 Hz, its peak, its share of low and of speech band).
3. **Two models listen** (`tools/listen.mjs`), when `@huggingface/transformers` is installed (`doctor.mjs` says
   whether it is; `npm install @huggingface/transformers` in `films/project`; the models download once, about 930
   MB). CLAP sets the take against the description (`is`) of every sound in the library: its own must be among the
   five nearest (`maxrank`), or the one it hears first must be an entry the spec `accept`s. AST names it with
   AudioSet's labels ("Shuffling cards", "Camera"): one of the entry's `tags` must be among its five, at 0.05 or more.
   A take passes on either; one AST hears first as music or speech (0.3 or more) is out unless the entry
   is `musical`, and so is one with a `reject` label at 0.1 or more, or one that breaks the entry's limits. Kept takes
   go best agreement first. **Fewer takes of a sound beat a wrong one.** The manifest keeps, per take, what each model
   heard (`fit`, `rank`, `heard`, `tags`); read the build's lines: what the tagger names a take is the nearest thing to
   hearing it. Without the package (or with `--no-listen`) takes are kept by the limits alone, and the build's first
   line says "not listened".
4. **The person listens.** `audition` writes `films/sounds/audition.html`, every take with a player and what the
   models named it; the person says which go, and `drop <id> <n>` takes each one out. A model's reading is a
   machine's: until a person has listened, the library is unheard, and the report says so. **A take goes into a film
   only if its `heard` names what its `is` says** (or one of its `tags` does): a take the model heard as another
   sound is the wrong sound, whatever its measurements.

**The library stays where it was made.** ElevenLabs' terms let the account use what it generated inside its films,
and forbid passing the sound effects on as isolated files or as a sound library: `films/sounds/` is git-ignored
except `spec.json`, and nothing in it is published, sent or shared. Another machine makes its own with
`gen` and `build`.

**Without a key** there is no library: the kit and the tonal set carry every film, and the sheet names `kit/<name>`
and `tone/<name>` sounds. The rules are the same; the variety rule (no file more than 8 % of the hits) is harder to
meet with sixteen sounds, so such a film uses fewer hits.

## The checks

`soundcheck.mjs` (`film.md` → Sound) measures the mix against the tiers and the rules above, one line a rule: the
master's loudness and peak; how hard the limiter works (under 5 % of 10 ms blocks over the ceiling before it, none by
6 dB; more means the voice needs levelling first); the mono fold-down (at most 1 dB lost); music 15 to 22 dB under the
voice while it speaks; the effects' loudest 400 ms at least 5 dB under the voice and, under speech, at least 11 dB
under nine tenths of the time; the backgrounds at least 12 dB under; no file more than 8 % of the hits (twice in a
film of fewer than 25); no file twice within a second unless its entry says `"repeat": true` (a counter, a run of
ticks); at most seven hits in a second; at most six hero hits a minute; every hero hit present on a phone. A film with
no voice has nothing to read the levels against, and the check says so instead of passing them.

Then the lists a director reads: the long sounds with their starts and ends (does each end when its thing leaves the
frame?) and the planned silences.

## What is still open

- The levels are set by rule, from creator guides. A person's ear may want the texture tier lower or the heroes
  higher: change the tier for the whole film, not single hits.
- The platforms' own copies are not measured: after a post, download the platform's file and read its loudness
  before trusting any number above for that platform.
