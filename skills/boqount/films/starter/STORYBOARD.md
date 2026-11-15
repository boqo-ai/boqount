# Starter — storyboard (9:16)

Quillfern, a plant-care app that reminds you when to water (the boqount example: the brand, its survey and its
numbers are invented). Script: `script.txt` (19 lines, 175 words). Voice-free as it ships: the captions carry every
word, timed at speaking pace in `audio/cues.json` (69.24 s), so the film reads on mute and takes a voice later (the
cues move with it). Composition `Starter`, 1080×1920 on a 60-unit time base, sampled at 120 a second; `DURATION`
4,156 frames = 69.27 s (2,078 frames at 30 fps). Scenes: `project/src/films/starter/` (`timeline.ts` holds the cues,
where each world starts and the captions' phrases; `WorldsA.tsx`, `WorldsB.tsx`, `WorldsC.tsx` the ten worlds;
`draw.tsx` the drawn things).

Layer: **product**, in the story format of `film.md`: hook, proof, catch, who is left, where you
come in, what most do, turn, the product at work, payoff, call. The product is named once, in part 8. One call, the
last line: "Comment FERN, and I'll send you the link." (`brand/quillfern/accounts.md` → DM automation: the person
answers each comment by hand).

The film's one idea: nearly every summer trip outlasts a plant's patience; whoever is left keeps a dozen schedules
in their head and waters everything at once; Quillfern keeps one schedule for each plant, so nobody has to.

## The story-format points

1. **Frame 0 is the number, already moving.** A large counter is rolling up to "9 in 10" on the first frame, over
   ten bars of summer trips growing past a dashed "1 week" line; the source line ("Source: Quillfern travel survey,
   example data, Nov 2026") rises under it by 0.07 s; the caption "NINE IN TEN" is whole. No title card, no product.
2. **One world for each part, the change on a spoken word.** Ten worlds, a change every 4 to 12 s (most 6 to 9),
   ending four frames before its line's first word: a pan of 0.27 s (`push`: the old world travels out to the left
   as the new one comes in from the right; `pull`: the same the other way), or a hard cut (`kit/WorldChange.tsx`).
   In a pan the two worlds are side by side and opaque, never one over the other, and nothing fades, so no two
   worlds' words are seen at once and no change flashes; a still taken mid-pan shows the 60 fps blend's smear. Inside a world, one camera (`kit/Camera.tsx`)
   pushes in on what the line names.
3. **The captions carry it on mute.** Two or three words at a time, each word on its own cue, heavy capitals (118 px
   design size, shrunk to fit 800 px), white with the key word in the accent, one fixed place for the whole film
   (baseline y 1114, 58 % down; the plate y 960–1210), never two blocks, nothing else in the band
   (`kit/Captions.tsx`).
4. **One picture per sentence.** A counter and bars, a shelf that counts, a leaf that droops, a wall of notes, a
   cloud of water days, a calendar, two pots, an app, the call. Each shows its sentence as it is said.
5. **Each world its own two colours**, from the style tokens (below). The product's world is the brand's own look.
6. **It does not loop.** No seam, no hook drawn twice, `"loop": false`; the last world is the call, shown (FERN
   typed and sent, the reply arriving), held 1.2 s after the last word. No logo card, no link on screen.

Every word a viewer must read is inside the safe zone (y 270–1248, x 65–1015); the picture has y 270–960, the
caption band below it. Text other than the captions is 36 px or more.

## The worlds

| # | Time | Lines | Colours | Camera | Demonstration | Into it |
|---|---|---|---|---|---|---|
| 1 | 0.00–5.43 | 1–2 "Nine in ten summer trips…" / "Your plants aren't coming." | accent2, accent | holds, then pushes in on the sill (1 → 1.08) | The counter rolls to 9 as "ten" is read; ten bars grow, nine past the "1 week" line, one short. On "Your" the trips leave to the right one after another and the line goes; on "plants" five pots stand up on the sill, staying. | frame 0 |
| 2 | 5.43–11.23 | 3 "The same survey counted twelve plants…" | accent2, accent | slow push (1 → 1.05) | Twelve plants pop onto three shelves as "counted twelve plants" is read, the count beside "plants" rolling 0 → 12; on "six" a coloured dot drops onto each plant, six colours, and "6 schedules" rolls in. | push |
| 3 | 11.23–20.16 | 4–6 "But here's the catch." / "A plant can't tell you it's thirsty." / "By the time a leaf droops…" | accent2, danger | holds, then pushes in on the soil (1 → 1.32) | One plant in a low beam of sun. On "can't" an empty speech bubble rises from the leaves, its three dots lighting, and closes unsaid; on "droops" the leaves hang and brown, the soil cracks; "days since water" (top right, the style's device) rolls 0 → 4 on "dry for days". | push |
| 4 | 20.16–26.52 | 7–8 "So whoever waters them while you're away keeps track by memory." / "Plenty of them just guess." | muted, accent2 | drifts out (1.03 → 1) | The first note is on the wall as the world arrives; five more are pinned one by one ("Fern — Tuesday?", "Cactus — ages ago", "Monstera — Sat?"…); on "guess" every question mark flares red and the snake plant's note falls off the wall. | pull |
| 5 | 26.52–33.88 | 9–10 "If your windowsill is full, that's you." / "Twelve plants means twelve water days…" | accent, ink | pulls out from the pots to the whole window (1.5 → 1) | A full windowsill, twelve pots. On "twelve water days" a drop lifts from each pot into a cloud above the sill, one after another, each landing on its own day (Mon, Tue, Wed…). | pull |
| 6 | 33.88–39.40 | 11–12 "But most people do the same thing." / "They water everything the morning they leave." | accent2, muted | a small push and back (1 → 1.04 → 1) | A big "Sat" cell and a week of small ones beside it (Sun … Sat, "no water"). Twelve drops fall into Saturday on "water everything"; on "leave" "you leave" appears and the week's "no water" lights day by day. | push |
| 7 | 39.40–48.43 | 13–14 "A week later, the fern is dry, and the cactus is sitting in water." / "So stop watering on a schedule that isn't theirs." | danger, accent | holds on both, a small push on the turn (1 → 1.05) | A fern and a cactus, each under a "Saturday" tag. On "dry" the fern browns and hangs; on "water" the cactus's saucer fills. On "stop" a line strikes through both tags; on "theirs" each gets its own: "every 4 days", "every 3 weeks". | hard cut |
| 8 | 48.43–60.84 | 15–17 "Quillfern keeps one schedule for each plant." / "It sends one reminder…" / "Tap Done, and its count starts again." | accent, accent2 | holds, then pushes in a little on Done (1 → 1.07) | The name, large, on its word; it docks into the app's header as the plant list slides in, each with its schedule. On "reminder" one card arrives: "Fern · water day", "4 days since water"; on "none" the other rows turn to "not today". On "Done" the disc is pressed, its check draws, the count rolls back to 0. | push |
| 9 | 60.84–65.18 | 18 "Twelve plants, and not one water day left in your head." | accent, accent2 | eases out (1.08 → 1) | The windowsill again, every plant upright; on "not one" the twelve water days drop out of the cloud back into their pots, and the cloud goes on "head". | pull |
| 10 | 65.18–69.27 | 19 "Comment FERN, and I'll send you the link." | accent, canvas | a slow push under the hold (1 → 1.03) | A comment field rises; FERN is typed letter by letter on "FERN", sent on "and", and goes up to the top; on "link" the reply "Here's your link" arrives under it from the brand's mark, and holds 1.2 s. | hard cut |

## Sound

No voice and no music as it ships: the kit's sixteen synthesized sounds only ($0), on a version-2 sheet
(`audio/sfx-cues.json`, `"loop": false`, 47 hits, each one's `"_"` naming what it is the sound of). Six hero hits
(8 dB under the voice or closer): the counter landing on 9 (with a sparkle layered on it), the leaves drooping, the
question marks flaring, the week away locking in, the strike through Saturday (with its error layer), the one
reminder arriving. Every world change has its move (`whoosh`, `whoosh_big`, or a `rise` placed by its peak); the
call has its typing, its send and its reply. Checked with the sound check: no file more than three times, none twice
within a second, at most three hits in any second, six hero hits, each present on a phone. Nobody has listened to it
at speed.
