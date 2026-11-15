# Production: what the day makes

Step 8 of the day (`SKILL.md` → The day). **A day with no post planned makes one.** "Nothing is `ready`" is the
reason to produce, not a reason to post nothing. Production never posts: what it makes enters at the check (step 9)
through the record written first, then the gate (step 10), like any other file.

The working folder is `films/` in the account's folder: the film project and one folder per film. A clip's or a
slideshow's files go to `marketing/media/<slug>/`.

## What the day makes

| Kind | What | Needs | Price |
|---|---|---|---|
| `film` | A film made from scratch in the account's film project, by `film.md` | the film project (`film.md` → The project) | the hours, plus any paid voice, sound or music take; $0 voice-free with the kit's sounds |
| `clips` | A clip cut by boqo from the brand's own long video | a boqo channel, and the video in `brand/<slug>/assets.md` → Material with rights | boqo credits, within `credits_day` |
| `file` | A finished video the person supplies, or one from the brand's own library (`brand/<slug>/assets.md`) | the file | $0 |
| `slideshow` | Stills already on disk, made into a vertical video with ffmpeg and the sound kit | the stills | $0 |

- The record's field is `Kind`. The ledger's `tier` column holds the kind, and so does the queue's `tier` column; a
  queue row's layer goes in its `layer` column, never in `note`. The queue's columns, in order: `slug | stage | type |
  rubric | tier | for | file | note | layer` (`templates/queue.md`).
- **A post is a video file.** A carousel goes out only as a `slideshow`.
- A trend is an idea for a `film`: it carries the trend's mechanism, never its original subject or its sound.
- **Every post has a layer**, whatever its kind (`niche`, `product` or `offer`, in the record's Layer field). A
  `file`, a clip or a slideshow takes the layer its content is: one that names or shows the product anywhere is not
  `niche`.
- **Material for $0** is only what is already on disk: the kit's sounds (`films/sfx/`), the account's sound library
  once it is made (`films/sounds/`), a film's tonal set, stills, the brand's media, and music only from a file the
  person saved, with its licence, to `marketing/media/sound/`. With none saved, a post has no music. Every proposal
  names the existing path of its material.
- **A film's mix** is -14 LUFS integrated, at most -1 dBTP (`film.md` → Sound); its sound check's output goes into
  the film's checks.
- No `films/project` (the person wants no films made here, or it is not set up yet): a day that needs a film asks
  once whether to set it up (`onboarding.md` step 9, run alone on a yes), makes another kind meanwhile, and the report
  names the film project under Not built.

## The voice and the AI label

A film is **voice-free** unless both hold: the brand has a voice (`brand/<slug>/style.md` → Sound and voice says
voiced, with its voice id) and an ElevenLabs key is present (`film.md` → The voice says where; check the file with
`test -s`, never print it). A voiced film needs the platform's AI-content label (`posting.md` → The AI label), and its
record carries `- AI label: yes (synthetic voice)`.

With a voice and a key, the branch for a film that goes to Instagram through boqo is keyed on `state.md` → Today:

| `Instagram AI label` | `AI label test post` | The voice |
|---|---|---|
| `absent` (`unread` reads as `absent`) | any | **Voice-free.** A labelled file never goes out there |
| `present` | `none` | **Voice-free.** The Plan line says the voice waits for a test post, and `AI label test: name the test post` goes into `state.md` → Open questions. Only the human names it |
| `present` | `<slug>, <date> (the human)` | A voice **only on the film that line names**. Every other film stays voice-free until the human confirms the label shows |
| `present` | `<slug>, confirmed <date>` | A voice is allowed, always with the label |

A film with no Instagram channel through boqo may be voiced: on its channels the label is set by the person
(`posting.md` → The AI label).

This is not a question for the human: the branch decides, and the report's Plan names the branch in one line. The
human's own recorded voice is not synthetic, and is used only when the human offers it.

**The on-screen seam:** a voice-free `niche` film's last on-screen line is left unfinished, and frame 0's title
finishes it as the film restarts (`film.md` → Sound). A voice-free opportunity story has no seam: its captions are its
words, and its last on-screen line is the call (`story.md`).

## The strategy line

The one read of `strategy.md` in a day run, at step 7, once per post (`d` is the post's `for` date, `w` its rubric and its
proposed type, or whichever you have): the week's calendar row, the matching rows of Rubrics and the Hook bank, and the Mix.

```bash
awk -v d=<MM-DD> -v w="<rubric>|<type>" '/^## /{s=substr($0,4);next} s=="Calendar"&&/^\|/{x=$0;gsub(/20[0-9][0-9]-/,"",x);if(match(x,/[0-9][0-9]-[0-9][0-9]/)){a=substr(x,RSTART,5);x=substr(x,RSTART+5);if(match(x,/[0-9][0-9]-[0-9][0-9]/)){b=substr(x,RSTART,5);if(a<=b?(a<=d&&d<=b):(d>=a||d<=b)){print;c=1}}}} (s=="Rubrics"||s=="Hook bank")&&/^\|/&&!/^\|-/&&tolower($0)~tolower(w){print;r=1} s=="Mix"&&NF{print;m=1} END{if(!c)print "no calendar row";if(!r)print "no rubric row";if(!m)print "no mix"}' marketing/strategy.md
```

Never `cat`, `grep` or `sed` the file itself. A `no … row` line means the research has not written that part yet: plan from
the queue row and `config.md`'s mix. A `niche` post takes its series, the series' fixed opening line and its next
episode number from its Rubrics row (`marketing/strategy.md` → Rubrics); the ledger's `rubric` is the series' slug.
A `product` or `offer` post takes its rubric's code word from Rubrics → Code words (printed with the rubric's rows),
and that code's link from `brand/<slug>/accounts.md` → DM automation.
`research.md` is never read in a day run: a norm's source is what `account-state norms` prints.

## Choosing what to make

Choose **before any work**. **The record comes first:** write the post's record
(`marketing/publications/<date>-<slug>.md`, from `templates/publication.md`, status `planned`) with its Kind, its
Layer and its Cost estimate before any file under `films/`, the script included.

1. **What:** first the queue. When the next 2–3 days have no `ready` row, the oldest `idea` or `script` row with no
   record yet (`ls marketing/publications/*-<slug>.md`; a `bet:` row before any other of its type, `kpi.md` → The
   bets) becomes the day's post: step 7 writes its record and ledger rows, status `planned`, kind and layer from the
   row, and in the same save sets the row's `stage` to `script` and its `for` date; production makes it. A row at
   `script` with its record is one a run left between steps 7 and 8: go on from that record. With no queue row, the
   strategy line's calendar row and Hook bank.
2. **The layer** comes from the strategy line: the calendar row, then the mix. Most posts are `niche`; a `product`
   post carries `awareness` or `trust`, an `offer` post `sale`.
3. **Read the budget:** `node <skill>/tools/account-state.mjs budget`. The dollar limit is
   `min(day.leftUsd, month.leftUsd)`; the credit limit is `credits.left`.
4. **Pick the kind:**
   - a `file` or `clips` when the person brought one for today, or the bet or the calendar row names one;
   - otherwise a `film`, when the dollar limit covers its estimate;
   - **with nothing left** (the dollar limit is 0), only what costs nothing: a voice-free `film` with the kit's
     sounds, a `file`, a `slideshow`; `clips` only while `credits.left` covers it.
5. **Estimate before the work.** Price the work in dollars and credits (Prices, below), and give the hours. An
   estimate over the limits means a cheaper kind, never a paid call past the budget.
6. **Reserve before each paid call.** Re-run `budget`, then write a `marketing/budget.csv` row
   (`date,slug,service,usd,credits,note`) at the call's estimate, note `reserved` with the price read and its date.
   A call that would go past its estimate, or past what is left, stops. After the call, rewrite that row to the
   actual cost. This holds for every retake too (a re-voiced line, a new sound or music take, a second clips card).
   A call with no reply leaves its row `reserved`, with the note `estimate, not called`.
7. **After the work, record the actual cost:** one `marketing/budget.csv` row per service, never one row for two
   services, and the record's Cost line: `estimate $<x> / <n> credits, <h> h; actual $<x> / <n> credits, <h> h`.

## Prices

A price is read at its source at estimate time and written with the date it was read. A price that cannot be read
is `unverified`, with no number: a call priced `unverified` has no estimate to reserve, so it is not made (the film
goes voice-free with the kit's sounds). A generated sound or music take is billed per generation: estimate every take,
kept or not.

| Service | What | Price | Source | Read |
|---|---|---|---|---|
| ElevenLabs | text to speech (`eleven.mjs tts`, `tts-lines`) | <read at estimate time> | https://elevenlabs.io/pricing/api | <date> |
| ElevenLabs | sound effects: the library's takes (`soundlib.mjs gen`, through `eleven.mjs sfx`) | <read at estimate time> | https://elevenlabs.io/pricing/api | <date> |
| ElevenLabs | music (`eleven.mjs music`) | <read at estimate time> | https://elevenlabs.io/pricing/api | <date> |
| boqo | `create_clips` (a boqo channel only) | credits: the balance and what is left of this connection's daily cap, read with `get_account`; the card's cost is the difference after it | boqo's `get_account` | <date> |

The kit's sounds and a film's tonal set are made on this machine and cost $0. The library costs once, when its takes
are generated (`soundlib.mjs gen` says how many seconds it would ask for before it asks anything), and $0 a film after
that. Without an ElevenLabs key, every film's sound is the kit and the tonal set, at $0.

## A film from scratch

A `film` is the day's post when the film project exists and the budget covers its estimate (a voice-free film with
the kit's sounds always fits). Follow `film.md` from its first step (`film.md` → Steps) to the feed file
`films/<slug>/out/<slug>-feed.mp4`; the project, the sound, the voice, the stills and the gates are written there
(`film.md` → The project, → Sound, → The voice, → Stills, → The gates), never here. The voice follows the branch
above.

Then update the record written first; never rewrite it: the file (the feed file), the actual Cost and hours, the
`AI label` line, and the Layer, which the script's `Structure:` line says too. The film enters at the check through
that record, like any other file.

## Clips from a long video

- **Needs a boqo channel** (`posting.md` → Start loaded boqo's tools). Without one the day makes another kind. boqo
  is named to the person only when they asked for clips.
- **Only the brand's own video**, listed in `brand/<slug>/assets.md` → Material with rights. A video not in that list
  is not used.
- Reserve the credits (Choosing, step 6), then `create_clips` on the video's link; poll `get_project` until it is
  finished; `list_clips` and `get_clip` give the clips and their download links (valid for an hour). Download the
  chosen clip to `marketing/media/<slug>/`: that is the record's file, and the record's Source names the clip's id.
- The clip goes to the check like any file. Anything in boqo that gets in the way becomes a problem report
  (`posting.md` → Failures).

## A ready file

A finished video the person supplies (`/boqount post <file>`) or one from the brand's own library: its record is
written with Kind `file`, and it enters at the check. Nothing is re-cut: a fix is a new file. Its words are read as
**The file's words** says; its pictures with `<skill>/tools/stills.sh <file> marketing/media/<slug>` (`film.md` →
Stills).

**The file's words**, for any video file or a film's mix:

```bash
mkdir -p marketing/media/<slug>
ffmpeg -nostdin -y -v error -i <file> -ar 16000 -ac 1 marketing/media/<slug>/words.wav
whisper-cli -m <a whisper.cpp model file> -l auto -f marketing/media/<slug>/words.wav -oj -of marketing/media/<slug>/words >/dev/null 2>&1
node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log((r.transcription??[]).map(x=>x.text).join(""))' < marketing/media/<slug>/words.json
```

- `whisper-cli` is used when it is installed (`command -v whisper-cli`). Without it, ask the person to confirm the
  file's words, and write their answer as the words.
- A bracketed sound tag (`(whooshing)`, `[Music]`) is not a word.
- **A voice-free film has no words:** run it on `films/<slug>/audio/mix.wav`, and expect none. A word found is a voice
  in the mix: fix it before the check.

## A slideshow

Stills already on disk (a carousel's slides, the brand's media), made into a vertical video:

1. Copy the stills in order, all of one type, to `marketing/media/<slug>/slideshow/` as `01.png`, `02.png`, …; about
   3 s a still.
2. The sound, in `marketing/media/<slug>/audio/`: `cues.json` as `{"duration": <stills × seconds>, "lines": []}`,
   and `sfx-cues.json` with `"loop": true` and a hit from the kit at each still's change (`at` in seconds). Then
   `node <skill>/tools/mix.mjs marketing/media/<slug>/audio --sfx films/sfx`. With no film project, make the kit
   first: `node <skill>/tools/sfx-kit.mjs --out films/sfx`.
3. The file (`<canvas>` is the `canvas` token of `brand/<slug>/style.md`):

   ```bash
   ffmpeg -nostdin -y -v error -framerate 1/<seconds> -i marketing/media/<slug>/slideshow/%02d.png -i marketing/media/<slug>/audio/mix.wav -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=<canvas>,fps=60,format=yuv420p" -c:v libx264 -profile:v high -bf 0 -crf 18 -c:a aac -b:a 192k -shortest -movflags +faststart marketing/media/<slug>/<slug>-slideshow.mp4
   ```

4. The record's file is that video, Kind `slideshow`, and it enters at the check.

## An idea from the human (`post <idea>`)

The idea gets the same rules as the day's post, and the answer is three short parts, in this order. Parts 1 and 2
are **one sentence each**, in these shapes (no list of other posts, no argument):
- `<the idea's part> — declined (<rule>); instead: <the true alternative>.`
- `No voice: <the branch, in one clause>, so <none | only <the test post>> carries one; and today's budget is spent.`
  (the last clause only when it is spent)
1. **What Never forbids is declined in one line** with the true alternative, and gets no queue row (`held` with the
   rule at most). The decline writes a `Ruling:` line in `log.md`.
2. **A voice asked for is answered in one line by the branch in force** (The voice and the AI label), plus the
   budget when today's is spent. A spent budget never makes a voice "wait until tomorrow": the branch decides the
   voice, and the idea's row is voice-free unless the branch allows it.
3. **A proposal, not a question:** the best post the budget allows today, by name, with its kind, its layer, its
   price, the window it aims at and the existing path of its material. With nothing left today, it costs nothing.
   The proposal becomes a queue row: stage `idea`, `for` today, its `type`, for a `niche` idea its series' slug in
   `rubric`, its kind in `tier`, `note` as `hook: <hook>; hypothesis: <hypothesis>` (a bet's note keeps `bet: <kpi>`
   first), and its layer in `layer` (`niche, episode <n>`, `product` or `offer`).

## Never

- **A paid call past the budget**, the day's or the month's, a retake included. With nothing left, propose the best
  zero-cost post for the day's remaining window, by name and with its material's path.
- **A post from production.** What it makes goes to the check and the gate.
- **A call in a `niche` post:** no line, still or caption asks for a comment, a follow, a click or a visit, and the
  last second is never a logo or a link. Only a `niche` post the person marked `Ad: yes` carries the brand book's call
  line (`brand/<slug>/brand-book.md` → CTA). A `product` or `offer` film carries its one comment call and nothing
  else (`story.md`).
- **Material that is not the brand's without the person's word** for that source (`film.md` → Outside material).
  Another person's face, name, stream or voice without their written permission, and leaked or pre-release material,
  never, whatever is said: decline in one line and name the true alternative (the brand's own material, or a source
  that gave written permission). No queue row is written for it, except `held` with the rule; a `Ruling:` line is.
- **An edit to the skill's own files** (`<skill>/`, its tools and its `films/`) **or the starter film.** The starter is
  read, never posted. What the account learns about films goes into `marketing/playbook.md`.

## Red flags

| Thought | Reality |
|---|---|
| "Nothing is ready, so no post today" | An empty day is the reason to produce: a film, or a kind that costs nothing |
| "Budget's gone, so nothing today" | Propose the best zero-cost post for the remaining window |
| "The day has money left, so the month doesn't matter" | The limit is the smaller of the two |
| "One more take, it's only a few cents" | Re-run `budget`, reserve the take, and stop past the estimate |
| "I know what that service costs" | Read the price at its source now, with the date; unread is `unverified`, and not called |
| "I'll note the kind and the estimate in the report" | The record holds them, written before any file under `films/` |
| "I'll let the human choose: voice, own voice, or none" | The branch decides. No voice in the style, no key or no label means voice-free, with the on-screen seam |
| "Without the voice we lose the loop" | The seam moves on screen: an unfinished last line that frame 0 finishes. An opportunity story has no loop to lose |
| "The product film is shorter as a 30 s loop" | A `product` or `offer` film is the opportunity story, 60 to 85 s, ending on its call (`story.md`) |
| "Reusing an approved voice take costs $0" | A take is still a synthetic voice. The branch decides, not the price |
| "The budget is spent, so the voiced film waits until tomorrow" | The branch decides the voice, not the budget |
| "I'll explain the branch, the other posts and why the budget isn't the reason" | One sentence in the shape above |
| "It's trending: a quick meme with the trend's sound" | A trend is an idea for a `film`, with its mechanism and the film's own sound |
| "Music from the kit, it's free" | The kit is sounds. Music only from a track the person saved; otherwise none |
| "The starter film is finished: post it on a slow day" | It is a worked example. Never posted |
| "Queue it at `idea`, and let the check hold it" | Someone else's face or stream is declined in one line, with no queue row |
| "I'll ask the other person's side for permission" | Decline, and name the brand's own or a permitted source. Permission is the human's to bring |
| "Shall I queue another version?" | Propose it by name, with its kind, price and window. The approval message asks later |
| "No boqo here, so I'll say clips need it" | Only when the person asked for clips. A run without boqo is a normal run |
