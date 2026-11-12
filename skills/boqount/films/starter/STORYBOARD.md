# Starter — storyboard (9:16)

Quillfern, a plant-care app that reminds you when to water. Script: `script.txt` (five lines, voice-free: the words
are on screen at reading speed). Cues: `audio/cues.json` (12.0 s). Composition `Starter`, 1080×1920 on a 60-unit time
base, sampled at 120 a second; `DURATION` 720 frames = 12.0 s (360 frames at 30 fps). Scenes:
`project/src/films/starter/` (`timeline.ts` holds every anchor, each pinned to a cue word, and the camera's keys;
`layout.ts` the world's geometry).

Layer: **product** (the viewer's problem, with the product in the middle): warm-up 1, stake 2, bridge 3 (the product
first named), payoff 4, seam 5; no urgency line and no call to action.

The film's one idea: a plant cannot say it is thirsty, so it wilts and loses a leaf; Quillfern remembers the day for
you; you water on time and it lifts; a week later it is thirsty again, which is where the film began.

## The locked-format points

1. **A hook a stranger understands.** "Your plant is thirsty." Everyone owns a plant or has killed one; the hook names
   the loss in the second person and does not name the product. The stake comes in line 2 ("It can't tell you."),
   the product in the bridge (line 3), never earlier.
2. **Frame 0 finished and moving.** The two-tone title "Your plant / is thirsty." (132 px, "thirsty." on the accent highlighter, its one highlighted word) is
   whole on frame 0, over the plant already wilting on its sill, the camera mid-push onto its dry soil, the phone
   beside it rolling its "Days since water" count from 6 to 7.
3. **One world, one travelling camera, no cuts.** Everything is one drawn windowsill (the plant in its pot, a phone
   propped beside it, a small cactus, a window with the low sun, a beam of light with dust in it), seen through one
   camera (`kit/Camera.tsx`) that pushes in on what each line names and pulls out to the whole. The through-line
   object is the plant; the phone is where the app keeps the count and shows the reminder. The window, the beam and
   the dust sit at their own depths, so every move has parallax. Each row below names what it inherits (←), what it
   hands on (→), its camera and its demonstration.
4. **The seam, on screen.** Line 5, "A week later…", is left unfinished; as the film loops, frame 0's title finishes
   it: "A week later… your plant is thirsty." The story is a cycle, so the loop is the story: the last seconds dry the
   plant back into frame 0's pose.
5. **The picture loops by construction.** The world is drawn from story time alone (`timeline.ts` `story()`), which
   wraps at the seam onto the same moment (the plant just watered, standing), so the picture has no join. The
   camera's keys loop on the film's frames (`loop={DURATION}`): its push onto the soil runs straight through frame 0.
   `Hook.tsx` (the words) is drawn twice: at the head on film frames, and over the tail shifted by −DURATION.
6. **A length the feeds can loop.** 12.0 s = 360 frames at 30 fps exactly.

No call to action: no comment line, no link, no sign-up, in picture or words. **Three full-frame hits:** the leaf
lets go (danger, with a shake), the water lands (accent, a ring from the soil), the new leaf opens (accent2, the
film's one burst). Every headline is drawn over the camera, inside the safe zone (y 270–1248, x 65–1015: clear of
the top 14 %, the bottom 35 % and 6 % of each side), 120–132 px, on a soft shade so it reads over any part of the
world; the world itself fills the frame to its edges. The phone's words are world px read at the camera's push
(2.75–3.1×: 36–50 px on screen), framed so the card and the count below it sit between the headline and the bottom
band.

## The chain

| # | Time | Line | Camera | Demonstration | ← inherits | → hands on |
|---|---|---|---|---|---|---|
| S1 | 0.0–2.0 | 1 "Your plant is thirsty." | push in on the dry soil and the drooping leaf (a move that began on the tail), then hold, creeping closer | On "thirsty." the dry soil cracks open, crack by crack across its grains; the leaves hang, their tips browning; the phone's count rolls 6 → 7 → 8, the window dimming for each night; dust drifts in the beam. The title leaves upward through its masks at 1.78 s. | the tail's push and the drying plant (the loop) | the close-up on the soil and the leaf |
| S2 | 2.0–3.7 | 2 "It can't tell you." | hold on the leaf, then tilt down after it as it falls past the sill | On "tell" the outermost leaf shivers; on "you." it lets go (**hit 1**: shake, red vignette), turns and falls past the sill's edge and out of frame as the count reaches 9. | the close-up, the drooping leaf | the empty stem, the phone at the frame's edge |
| S3 | 3.7–5.4 | 3 "Quillfern remembers." | push in on the phone's reminder as it arrives, then hold, creeping closer | The phone's screen wakes and its light spills onto the sill; the reminder ("Quillfern · now", "Water your plant", "Today, 9:00") slides down onto the lock screen; the phone buzzes twice and the reminder's drop icon rings; on "remembers." its Done disc pulses. The count beneath it reads 9. | the phone, lit | the reminder and its Done disc |
| S4 | 5.4–9.1 | 4 "You water it on time." | push in on Done; follow the drop across to the pot; pull out to the whole plant standing | A fingertip comes down on Done on "it": it presses, ripples, the check draws, and the count rolls back 9 → 0. The card's drop lifts off its icon and arcs from the phone into the pot, the camera following it, and lands on "time." (**hit 2**): a splash, ripples, the wet patch spreading through the soil and washing the cracks away. The leaves lift one by one with beads of water on them, the camera pulling out; a new leaf unfurls where the old one fell (**hit 3**: the burst). A bead drips off a leaf onto the sill; the reminder is gone and the phone's screen goes back to sleep. | the reminder, the drooping plant | the watered plant standing, the count at 0 |
| S5 | 9.1–12.0 | 5 "A week later…" | push in on the count beside the plant, then set off toward the soil (the push that runs through frame 0) | The days roll by on the phone, 0 → 6, the room dimming for each night and the beam swinging with the sun; the wet patch dries, the leaves start to hang and yellow. The line leaves, and the title rises so that it is whole on frame 0. | the watered plant | frame 0 (the loop) |

## Sound

Voice-free, no music: the soundtrack is the synthesized kit only (`audio/sfx-cues.json`, 68 hits, `"loop": true`),
mixed by `tools/mix.mjs` over the film's length. Every visible action has its sound: a `tap` as each word rises, a
`tick` for each day the count rolls through (a fast ratchet as it rolls back to 0) and for each crack of the soil,
`whoosh` on every exit and on each move of the camera, `blip` as the leaf shivers and as the phone wakes, `drop` +
`error` as the leaf lets go (hit 1), `whoosh_big` as the reminder slides in, `lock` for each buzz, `ding` as its icon
rings, `pop` as Done pulses, `tap` + `toggle` on Done, `drop` + `rise` as the water lands and spreads (hit 2),
`pop`/`pop_hi` as each leaf lifts and as the new one starts, `sparkle` as it opens (hit 3), a quiet `toggle` as the
screen sleeps and a quiet `drop` for the drip, and `whoosh` + `pop` as the title rises into frame 0.
