# The calibration gate

While `config.md` says `autopost: calibration` or `paused` (`auto.md` → The stops), a post goes out only after the human answers its approval message
with Publish. Nothing else counts as approval: not silence, not an earlier "post them all", not your own judgement.

## The message

One message per post at `checked`, with every slot filled, or one message for several (A batch, below). A slot you
cannot fill says why. Every record at `checked` whose Posting section has no `Gate:` line gets its message: in the day
at step 10, and at the end of `post <file>` when its check passes. That covers a record a crash left between the check
and the message.

A record a stop recalled gets its message too, and so does any record that is `held` or `uploaded`, has `approval:
auto` and a `canceled:` note, while `autopost` is not `auto` (an auto stop's recall, or a red funnel's cancel, held or
returned to `uploaded` once the funnel is green again):
its newest `Gate:` line reads `auto` (`auto.md` → The stops), so only a human Publish sends it. Its slot is the next
free one (`posting.md` → The slot). A `canceled` record the human asks for again gets one too (`posting.md` → A canceled
post).

When the message goes out, write `- Gate: message sent <ISO>` under the record's Posting, and commit it locally
(SKILL.md → Save, locally). A message sent again after a change writes a new `Gate:` line.

```
<slug> — <for: date, slot on the account's clock>
Type? 1. <your pick> — <why, one line>
      2. <type> — <why>
      3. <type> — <why>
      4. <type> — <why>
File: <path> · Frame 0: <path> · Contact sheet: <path>   (or: "not on this machine")
Script: <path>   (only one the check wrote: "written from the file: frames and Whisper")
Hook: <all four | chain explainer: its three, by its format | file or clips, lacks <second person | a real number>: your Publish accepts it>
Layer: <niche: <series>, episode <n> · the film and the caption ask for nothing | niche, Ad: the call line, on your word of <date> | product or offer, the opportunity story (the format is being tested) · the film and the caption ask for a comment: <CODE> → <the DM row's link>, replies by <the automation | you, by hand>>
Length: <n> s   (only a chain explainer whose chain cannot fit 30 s: "May this one run <n> s, up to 45? Otherwise it stays the 30 s cut.")
Re-read before it posts: <each fact that can move, and where it is read again on the posting day>   (only when the record has the line)
Outside material: <each still by its file; each shot as <file> <from>–<to> s, with "its own sound" or "picture only"; the caption's credit line | none>; with its own sound: "the platform may mute or block the post"
Gates: <what Gate 1 and Gate 2 left open, in a line each | nothing left open>   (a film made here)
For each channel the post goes to:
  <channel>: <scheduled through boqo | handed over to you to publish>
  Caption, as it will appear:
    <the exact text: by hand and on the field branch the channel's block; on the file-name branch the name's words +
     "the account's Defaults tags"; YouTube: the title, then the description>
  Caption source: <"written by boqount" | "the file name's words + the Defaults tags, because <why>">   (through boqo)
  Name carries: full caption or hook line?   (only on the file-name path while `caption_via_filename: ask`)
Expect: <metric> <low>–<high> against <norm, n, source>
Cost: $<usd> / <credits> credits; left today $<left>
Check: <GO | GO with edits: each edit>   (and any still that departs from the style's Look, check.md item 2)
AI label: <yes, why | no>
Nobody watched this film at speed or heard it: what was looked at is frame 0 and the contact sheet.
Publish / Edit / Skip
```

- **The pictures**, from the record's file, into `marketing/media/<slug>/` (`mkdir -p` first): frame 0 with
  `ffmpeg -nostdin -y -v error -i <file> -frames:v 1 marketing/media/<slug>/frame0.png`, and the contact sheets with
  `<skill>/tools/stills.sh <file> marketing/media/<slug>` (`film.md` → Stills).
- The four types are `reach`, `awareness`, `trust`, `sale`; your pick comes first. The layer suggests it (`niche` →
  `reach`; `product` → `awareness` or `trust`; `offer` → `sale`), and the choice stays the human's.
- **The code word and its DM rule** are on the Layer line of a `product` or `offer` post, with who replies: a reply
  by hand is the person's promise to answer every comment that asks, and the message says so in those words. A `niche`
  post has neither: it asks for nothing (`check.md` item 3), its Link is the profile link, kept for the measured path,
  and the message does not show it. A `niche` ad post whose call line carries a code word adds one line: `Code word:
  <CODE> · DM rule confirmed <date> by the human`.
- **An ad post** goes out only on a human Publish, whatever the mode; marking it `Ad: yes` changes nothing by itself
  (`check.md` item 3).
- **The length question** is answered with the Publish: a yes is a `Ruling:`, the film is rebuilt at that length and
  comes back through the check and this gate; without one the 30 s cut is the film.
- **Nobody watched it.** No step of the pipeline watches a film at speed or hears it (`film.md` → The gates); the
  message always says so.
- **Expect** names its norm: the type's row in `state.md` → Norms (value, n, source). With no value there, write
  `against no own norm yet (n=<n>); <the basis you used>` and mark the range `provisional`.
- Use AskUserQuestion when it is available (the type as its options, then Publish / Edit / Skip).
- Each time a question is asked, on macOS, notify:
  `osascript -e 'display notification "<n> post(s) wait for approval" with title "boqount"'`. A failed
  notification is fine. On another system no notification is sent.

## A batch

Several posts at `checked` may go to the person in one message and be approved in one answer.
- Each post is its own numbered block with every line above; the `Nobody watched` line is said once, at the top, for
  all the films; one `Publish / Edit / Skip` closes the message.
- The answer is for all ("Publish all") or by number ("Publish 1 and 3, skip 2"). A post the answer does not name is
  not approved: it waits, and is asked again.
- Each record gets its own `Gate: message sent <ISO>` line, and each Publish is written as its own.
- A post that changed after the message went out (After the answer) is left out of the batch's Publish: show the
  change and ask again for that post alone.
- A batch changes no limit: each post takes its own slot, at most 2 a day on a channel, only in the windows
  (`posting.md` → The buffer).

## After the answer

- **Publish:** write `approved`, the type, `type_source: human`, `approval: human` (`posting.md` → The status
  machine), then publish: each boqo channel goes on at `posting.md` → The upload, each by-hand channel at `posting.md`
  → By hand. A Publish on a row that has a `boqo_project_id` (a recalled or canceled post) writes `uploaded` in place
  of `approved`, with `card_id` and `boqo_post_id` cleared, and resumes at `posting.md` → The post: it never starts a
  new upload.
  - A Publish counts only when the record holds a `Gate: message sent <ISO>` line and the Publish came after that
    time. With no such line, send the message first and wait for the answer; a Publish given before it (such as
    "post them all now") starts the gate, it is not the answer.
  - When the film, a channel's caption, the layer, the outside material or the cost changed after the message went
    out, show the change and ask again first.
  - A Publish on a record with a `Hook ruling:` line also logs `Ruling: <slug> posted without <what it lacks> — the
    human's Publish — <cost if wrong>`.
- **Edit:** each edit becomes a `Ruling: <what> — <why> — <cost if wrong>` line. What it teaches about the look or the
  language is added to `brand/<slug>/style.md` → Observations, with its date; the sections above it change only on a
  research refresh the person approves. A brand-kit fact the person corrects (a price, a claim) is corrected in the kit,
  and a rule about making posts in `marketing/playbook.md`, each shown as a diff in the report. The post goes back to
  the check.
- **Skip:** status `skipped`, with the human's reason in `note`.

After each post the human approved goes out on a channel (`scheduled` through boqo, or `posted` on the person's link
by hand), run `node <skill>/tools/account-state.mjs mode` and report `Calibration: <approved>/<needed>`. Then:
- `switchDue` true and `<skill>/auto.md` exists: `auto.md` → The switch decides (it waits while the readings
  are stale);
- `switchDue` true and no `auto.md`: stay in calibration, and report "calibration complete; auto mode not built yet".
