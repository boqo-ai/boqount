# Posting: through boqo, or by hand

A post goes out on each of its channels one of two ways. Through boqo: `create_upload` (`kind:"post"`) → PUT →
`complete_upload` → `post_video`. By hand: the person gets the file, the caption and the time, publishes, and sends
the link back. One post on one channel never goes out both ways.

## How a post goes out

Decided for each channel, at every run, in Start:

| The channel | `publish_via` | Its posts go |
|---|---|---|
| has an `account_id` | `auto`, `boqo-only` | through boqo. When boqo can't take them (Failures → boqo down) they wait as files, with an alarm. Under `auto` the person may ask for a waiting post to be handed over instead (A canceled post → Handed over instead); under `boqo-only` never |
| has no `account_id` | `auto` | by hand |
| any | `manual` | by hand |
| has no `account_id` | `boqo-only` | nowhere: Setup is owed, and the report says so |

The first channel's id is `account_id`; another channel's is `account_id@<channel>`. Write the decision in
`state.md` → Today, one line per channel: `<channel>: boqo | by hand (<why>)`.

A ledger row that has a `boqo_project_id` stays on the boqo path, and a `handed` row stays by hand, whatever today's
decision is. Moving a row from one path to the other goes by A canceled post first, then the other path.

**A channel that goes by hand is a normal channel.** No alarm, no reminder of what boqo would do. boqo is named to the
person only when they ask for something only it does: publishing or scheduling without them, reading the numbers
without them, clips cut from a long video.

**Per platform** (other files point here):

| | Instagram | TikTok | YouTube |
|---|---|---|---|
| Caption | at most 2,000 characters | at most 2,200 | a title of at most 100 characters, a description of at most 5,000 |
| A link | No organic post shows one: it is on the profile. An ad post's (`Ad: yes`): not clickable in a caption, so the profile link, or the reply of the brand's DM automation (`check.md` item 3) | No organic post shows one. An ad post's: not clickable in a caption, so the profile link | No organic post shows one. An ad post's: clickable in the description |
| AI-content label | through boqo `instagramAiLabel`; by hand the person switches it on | the person switches it on, either way | the person sets "altered content", either way |

Through boqo, a YouTube post's title is the upload name's words and its `caption` is the description.

## Setup (the first run)

Reached from onboarding (`onboarding.md`, steps 5–6), where step 4's stop ends Setup and onboarding goes on; or when
SKILL.md sends a run here because `timezone` or `windows` in `config.md` is empty: `budget`, `slot` and `queue` exit 1
on an empty zone, so nothing else runs.

1. When boqo's tools can be loaded (Start, step 1), read `list_accounts` and `get_posting` with no `accountId`: each
   row's id, platform, handle, status, `timezone`, slots, `dayCap` and `autoPost.enabled`. A handle can have rows under
   two boqo users: show what this login sees, and ask the human to check the other too.
2. Ask, in one message: which channels the account posts on (`channels`); for each, which boqo row it is
   (`account_id`, `account_id@<channel>`) or that it is published by hand; the zone; two windows (around boqo's slots
   where a channel has them); for each boqo channel, whether "Captions written by the agent" goes on (on a yes,
   `set_posting {accountId, agentCaptions: true}`, the one call this step makes) and, while it stays off,
   `caption_via_filename`: whether a file name may carry the full approved caption or only the hook line. Each answer
   is a `config set` or a state line. With the account ids, record `boqo_server`: the server whose tools answered in
   step 1 (`config set boqo_server <name>`).
3. With no boqo tool loaded, ask the same without the boqo rows. Reached without onboarding (which has said it,
   `onboarding.md` step 5), say once, in one sentence, how the by-hand channels work: you prepare each post and hand
   over the file, the caption and the time; the person publishes and sends the link. Under `publish_via: boqo-only`
   the human's step is `/mcp` instead.
4. Stop: no plan, no post, no outward call. What is unanswered stays in `state.md` → Open questions.

## Start (every run, before any other outward call)

Steps 1–7 run for every channel that goes through boqo today (How a post goes out), and for any channel with a row
in flight in boqo (a `boqo_project_id` at `uploading`, `uploaded`, `post_requested` or `scheduled`), whatever
`publish_via` says: those rows are reconciled and measured to the end. In steps 1–7 each such channel is "a boqo
channel". With none, go to step 8.

1. **The login.** boqo's tools are those of the server `config.md`'s `boqo_server:` names, and no other. MCP tools are
   usually deferred, so a tool that is not listed yet is not a down MCP: load the schemas with ToolSearch before you
   read anything into their absence. With `boqo_server` empty and exactly one server offering boqo's tools, use it and
   record it (`config set boqo_server <name>`); with several, ask which, and make no boqo call until the answer.
   `list_accounts` must hold the `account_id` of every boqo channel. If it lacks one, this session is signed in as
   another boqo user, where `list_schedule` is silently empty, `get_project` answers `not_found` and `post_video`
   refuses. For that channel Start stops here: no other boqo call, no record changes
   (nothing becomes `failed`), and its day goes on as under boqo down (Failures), with the alarm
   `boqo login does not hold <account_id>`.
2. **The schema lines.** Read `post_video`'s input schema (loaded in step 1) and rewrite the dated lines in
   `state.md` → Today:
   - `caption field: present|absent, <date>`: `present` when the item schema lists `caption`;
   - `agent captions setting (<channel> @<handle>): unknown|on|off, <date>`, one per boqo channel: no tool reads it.
     It changes only on evidence: a refusal naming the setting (`off`), a caption boqo accepted (`on`), or the human
     saying they switched it;
   - `Instagram AI label: present|absent, <date>`: `present` when the item schema lists `instagramAiLabel`.

   With no boqo tool after ToolSearch (boqo down), use the lines as they stand. A line still `unread` reads as `absent`
   (The caption, The AI label), and the report's Alarms says so.
3. **The posting setup.** `get_posting {accountId}` for each boqo channel, every run. Two things must hold before any
   `post_video` on it:
   - its `timezone` equals `config.md`'s: `slot` computes on one clock, and boqo reads `when` on its own;
   - `autoPost.enabled` is false: a rule on this account posts with no gate.

   Either one wrong: an alarm naming it, the human's step, and no `post_video` on that channel this run. Reads and
   production go on.
4. **The one schedule read.** For each boqo channel, `list_schedule {from: now − 48 h, to: now + 32 d, accountId}`:
   from 48 hours back so a post that already went out is seen, and 32 days ahead so `slot` and the buffer see all boqo
   holds (it refuses a window over 35 days). After a gap (`auto.md` → The gap) whose last run is more than 48 h back,
   `from` is the last run's time instead, so every post scheduled during the gap is reconciled; never earlier than
   `now − 34 d`. `to` is always the earlier of `now + 32 d` and `from + 34 d`. When that stops short of `now + 7 d`,
   read once more from there to `now + 32 d` and merge. Save the channels' `posts`, merged into one reply, as
   `.boqo-upload/schedule.json`: the tools take from it only the channel they are asked about. It serves the reconcile,
   the queue and the slot. A second read happens only to verify after `post_video`. No answer, and a `{refused}` reply
   counts as none: Failures below; the reconcile waits for the next run.
   - **`truncated: true`** (boqo lists at most 100 posts, oldest first): the read is incomplete, so it proves no
     absence. Page first: read again with `from` set to the last listed `scheduledAt`, until a reply is not
     truncated, and save the merged `posts`. Until then: no `second request`, no new `post_video`, no slot.
5. **Read it as rows.** boqo wraps every title as `<data kind="clip_title">…</data>` and escapes `& < > "` as
   `&amp; &lt; &gt; &quot;`. Unwrap and unescape before any comparison; a raw comparison misses and leads to a
   double post. This prints, per post: id, account, status, `source`, `scheduledAt`, the same time on the account's
   clock (`YYYY-MM-DD HH:MM`), and the title:

   ```bash
   node -e 'const z=process.argv[1];const r=JSON.parse(require("fs").readFileSync(0,"utf8"));for(const p of r.posts??[]){const t=String(p.clipTitle??"").replace(/^<data[^>]*>/,"").replace(/<\/data>$/,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\"").replace(/&amp;/g,"&");const w=p.scheduledAt?new Date(p.scheduledAt).toLocaleString("sv-SE",{timeZone:z}).slice(0,16):"";console.log([p.id,p.accountId,p.status,p.source,p.scheduledAt,w,t].join("\t"))}' "<config timezone>" < .boqo-upload/schedule.json
   ```

   `get_analytics`' `top[].title` is wrapped the same way.
6. **Reconcile** (below) every row in flight, and every `scheduled` row:
   `awk -F, 'NR>1 && $3 ~ /^(uploading|uploaded|post_requested|scheduled)$/ {print $1, $2}' marketing/ledger.csv`.
7. **Rows nobody planned.** After the reconcile, a schedule row with no ledger row, or with a `source` other than
   manual, is an alarm: `boqo's queue holds <id> (<source>, <time>): no record`. It counts in `--taken`. You do not
   cancel it: the human says what it is.
8. **The handed posts.** `awk -F, 'NR>1 && $3=="handed" {print $1, $2}' marketing/ledger.csv`. A row whose link the
   person has sent since the last run: By hand → The confirmation. Every other one goes into the report (By hand →
   Not confirmed).

## Records

- One ledger row per post and channel. The record's status line for a channel and that row's `status` always say the
  same thing. Update a row by column name (`head -1 marketing/ledger.csv | tr ',' '\n' | grep -n .` numbers the
  columns); never append a second row for the same slug and channel. Quote a value that holds a comma.
- After every ledger edit, run `node <skill>/tools/account-state.mjs mode`. An error naming a ledger line means the row is
  wrong: fix it before the next step.
- The queue row's `stage` follows: `ready` until every channel's row is `scheduled`, `handed` or `posted`; `held` with
  the rule in `note`.

## Preconditions

All must hold before `create_upload` and again before `post_video` (through boqo), and before the hand-over (by
hand):
- through boqo: `list_accounts` shows the channel's account `active`, and Start's posting setup holds (the same zone,
  the rule off);
- `node <skill>/tools/account-state.mjs budget` leaves at least this post's cost (`day.leftUsd`, `month.leftUsd`,
  `credits.left`), so it is not `over` after it;
- the record's check is `GO`, or `GO with edits` with the edits made (`check.md`); in auto, `GO with edits` needs a
  human Publish too (`auto.md`);
- the gate is passed: a human `Publish` in calibration or paused (`gate.md`). While `autopost` is not `auto`, a row
  with `approval: auto` and a `canceled:` note needs a human Publish after its cancel; in auto,
  `node <skill>/tools/account-state.mjs stops --channel <channel> --funnel <colour> --restricted <yes|no>` run right
  before this post says `stop: false` (`auto.md`);
- for a `sale` post, the funnel is green;
- **budget out:** when `budget` is `over`, or leaves less than the post's cost, only zero-cost posts run (a finished
  file, a slideshow of stills already on disk: $0 and 0 credits). A paid post waits at its status with `note: budget`.
  Never overspent.

## The status machine

Through boqo: `planned → checked → approved → uploading → uploaded → post_requested → scheduled → posted`.
By hand: `planned → checked → approved → handed → posted`. Side exits: `held`, `skipped`, `failed`, `canceled`,
`abandoned`.

Each row below, in this order, is written into the record and the ledger row, then saved (SKILL.md → Save,
locally), and only then does the next call or message go out:

| When | Write | Save message |
|---|---|---|
| the human's Publish | `approved`, type, `type_source`, `approval: human` | `marketing: <slug> approved` |
| before `create_upload` | `uploading`, `upload_name` | `marketing: <slug> <channel> uploading` |
| after `create_upload`, before the PUT | `boqo_project_id` | `marketing: <slug> <channel> project <id>` |
| after `complete_upload` | `uploaded` | `marketing: <slug> <channel> uploaded` |
| before `post_video` | `post_requested`; the record's Card line reads `requested <ISO>, for <date> <time>` (the slot, on the account's clock) | `marketing: <slug> <channel> post requested` |
| after `post_video`, before the verify read | `card_id`; `chargedCredits` into the ledger's `cost_credits` and a `budget.csv` row (`<date>,<slug>,boqo,0,<credits>,post_video`) | `marketing: <slug> <channel> card <id>` |
| after the verify read finds the post | `scheduled`, `boqo_post_id`, `scheduled_at`, "Scheduled for" | `marketing: <slug> <channel> scheduled` |
| before the hand-over message | `handed`, `scheduled_at` (the slot's `at`) | `marketing: <slug> <channel> handed` |
| the person's link for a handed post | `posted`, `permalink`, `posted_at` | `marketing: <slug> <channel> posted` |

## By hand

For a channel that goes by hand. Never under `publish_via: boqo-only`.

1. **The slot.** `node <skill>/tools/account-state.mjs slot --channel <channel>` (a post planned for a later day adds
   `--day <for>`), plus `--taken .boqo-upload/schedule.json` when Start read the channel's schedule this run (it has
   rows in flight in boqo): those posts hold their times. The tool itself counts the channel's `handed` posts and the
   ones already published by hand.
   It answers `{date, time, at, zone}`.
2. Preconditions hold.
3. Write `handed` with `scheduled_at: <at>`, and save.
4. **The hand-over message,** one per post, with a part for each by-hand channel:
   - the file: its full path;
   - the caption for that platform, in a code block, byte-identical to the record's "As it will appear" for the
     channel (YouTube: the title and the description as two blocks);
   - when: `<date> <time>` on the account's clock, with the zone;
   - what to set on the platform: its AI-content label when the record's `AI label` line says the post needs one;
     for an ad post only, where its link goes (How a post goes out → Per platform);
   - one line: "Send me the post's link once it is out."
5. **The confirmation.** The person's link for the post: open it logged out. It opens and is this account's post:
   write `posted`, `permalink` and `posted_at` (the time they give; with none, `scheduled_at`), then After it posts.
   It answers with a login wall or cannot be read: the person's link and word stand, the same write, with
   `link not verified` in `note`. Only a page that opens and is plainly another account's post is refused: say so and
   ask again. Nothing is written.
6. **Not confirmed.** A `handed` row stays `handed`. Every report names it under the human's steps: slug, channel, the
   time it was for. Once its time is 24 hours past, ask once whether it went out (the link), moves (a new slot, the
   same approved caption, a new hand-over message) or is dropped (`skipped`, note `not published`). Never assume it
   went out.
7. **Its numbers** come from the person: `measure.md` → Screens.

## The upload

Through boqo, once for each boqo channel of the post: every channel's row has its own upload and its own
`boqo_project_id`.

A row with a `boqo_project_id` never calls `create_upload` again: its file is already in boqo, so it goes on from
`uploaded` (A canceled post, below). The exceptions first move its project to `abandoned:` in `note`: an expired
upload (Reconcile), and a post that became an ad (A canceled post).

1. `node <skill>/tools/boqo-upload.mjs probe <file>`: `contentType`, `sizeBytes`, `passthrough`, `loopSafe`.
2. `node <skill>/tools/boqo-upload.mjs name "<caption line>"` gives `{filename}`: that is `upload_name`. Write `uploading`
   with it. The caption line is the one The caption names below; never a slug, a date or a file name.
3. `create_upload {filename: <upload_name>, contentType, sizeBytes, kind:"post"}`.
4. Write the reply, verbatim, to `.boqo-upload/<slug>-<channel>.json`, and its `projectId` into the record and the
   ledger row. The reply carries signed URLs: they never go into `marketing/`, the log or a message.
5. `node <skill>/tools/boqo-upload.mjs put <file> --reply .boqo-upload/<slug>-<channel>.json`.
6. `complete_upload {projectId}`.
7. Write `uploaded`, then delete the reply file.

## The caption

Through boqo. Keyed on the two lines in `state.md`. `unknown` reads as `off`; `unread` reads as `absent`, and is
reported.

- **`caption field: present` and the setting `on`:** pass the approved caption as `caption`. It is
  **byte-identical** to the "As it will appear" block of the record the human approved for that channel (in auto: as
  the check passed it, `auto.md`). Any change, however small (a word, a tag, a capital), is shown to the human and
  approved again before `post_video`. It stays inside the platform's limit (How a post goes out → Per platform); it
  carries its own hashtags (at most 5), and no Defaults tags are appended. The upload name is caption line 1. Tell the
  user: the caption is posted as written in the record and can be edited in boqo's Schedule until it posts. The first
  such post on a channel is confirmed once by the human: the caption on the platform matches the record (`state.md` →
  Open questions holds it until they say so).
- **`caption field: present` and the setting `off`:** do not pass `caption`. The words are the file-name path's.
  Tell the user why: "Captions written by the agent" is off for the account, so the caption is the file name's
  words plus the account's Defaults tags; turning it on (boqo → Accounts → the account → Defaults, or on the human's
  yes `set_posting {accountId, agentCaptions: true}`) lets the caption be written here. Before the slot, the user may
  edit the words in boqo.
- **`caption field: absent`:** the file-name path, and the same message without the setting.
- **The file-name path:** the caption is the upload name's words plus the account's Defaults tags (none are added
  when the name holds a `#tag`). What the name carries is `caption_via_filename` in `config.md`:
  - `ask`: Setup asks this. If it is still `ask`, the gate message of the first post on this path asks the user, once,
    whether the name may carry the full approved caption (one line, at most 200 characters) or only the hook line. The
    post waits for the answer. Record it with `config set caption_via_filename yes|hook` and a `Ruling:`, and re-check
    any post held for it (`check.md`);
  - `yes`: the full approved caption on one line;
  - `hook`: caption line 1 only.
- **A refusal naming the setting** (agent captions off): status `held`, note `agent-captions off`, never
  `failed`. Set the setting line to `off` with the date, and tell the user. Nothing was posted. The post goes
  again once the human switches the setting on or rules for the file-name path.

By hand, the caption is the hand-over message's block (By hand, step 4), under the same byte-identical rule.

## The AI label

Keyed on the record's `AI label` line (`check.md` item 4): whether the post needs the platform's AI-content label (a
synthetic voice, a realistic AI picture).

- **By hand, any platform:** the hand-over message tells the person to switch the label on.
- **Instagram through boqo:** keyed on `Instagram AI label` in `state.md`.
  - `present`: the post goes out with `instagramAiLabel: true`, once a test has shown the platform displays the
    label. Where the test stands is the line `state.md` → Today → `AI label test post:`:
    - `none`: the first labelled post is `held`, note `AI label test owed`, and opens `AI label test: name the test
      post` in `state.md` → Open questions. Only the human names the test post;
    - `<slug>, <date> (the human)`: the named post goes out; every other labelled post is `held`, note `AI label test
      owed`, until the human says the platform shows its AI label on it. On their word, rewrite the line to the
      next form;
    - `<slug>, confirmed <date>`: the test is done and the question closed. Labelled posts go out, and none is held
      for it again.
  - `absent` (`unread` reads as `absent`, and is reported): such a file never goes out through boqo. Its status is
    `held`, note `ai-label`.
- **TikTok or YouTube through boqo:** boqo sets no label there. A post that needs one is `held` on that channel, note
  `ai-label by hand`, until the human says how it goes: they set the label on the platform themselves after it is
  scheduled (then it goes on), or, under `auto` only, the post is handed over for that channel (A canceled post →
  Handed over instead, then By hand).

The check holds a post for this before the gate (`check.md` item 4); this is the same rule at post time.

## The slot

Through boqo.

1. **No new slot while a post is unlisted.** While any row of the channel is at `post_requested` and the schedule
   does not list its post yet, take no slot and send no `post_video` on that channel: its slot is not in `--taken`, so
   a new post could land on it or make a third that day. The next post waits for it to be listed, for the next run,
   or for the human's word on Reconcile's hand-off alarm.
2. Take the start read, `.boqo-upload/schedule.json` (refreshed by each verify read; complete, not `truncated`).
3. `node <skill>/tools/account-state.mjs slot --channel <channel> --taken .boqo-upload/schedule.json`. A post planned
   for a later day (its queue `for` is after today) adds `--day <for>`: the tool returns the earliest slot on or after
   that day, on the account's clock. Never write a UTC offset or an instant by hand.
4. Pass its `date` and `time` as `when: {date, time}`. Never `"queue"`, never a preset.

## A canceled post

A post leaves boqo's queue one of two ways, and both keep `boqo_project_id`, so neither ever uploads again (except
a post that becomes an ad, below):
- **This skill cancels it** (`cancel_post`: a sale post under a red funnel, `measure.md`; an auto post at a stop,
  `auto.md`): write `held`, with `canceled: <postId> (<why> <date>)` in `note`, `card_id` and `boqo_post_id` cleared;
  save; then `cancel_post {postId}`. When it may go again (a green funnel; a human Publish after a stop, `gate.md`)
  it returns to `uploaded` and goes on at The post with a new slot.
  - **A post that becomes an ad** (`check.md` item 3) is canceled the same way, with `canceled: <postId> (ad <date>)`,
    and starts over: every channel's row returns to `planned` with `approval: none`, never to `approved` or
    `uploaded`. Its file changes, so its `boqo_project_id` moves to `note` as `abandoned: <projectId>`, and after the
    check and a human Publish the new cut starts at The upload. A handed one: the person is told not to publish it, as
    at a stop.
- **The human canceled it in boqo** (Reconcile found it gone, and no `cancel_post` was sent): on their word, write
  `canceled`, with `canceled: <postId> (the human <date>)` in `note`, `card_id` and `boqo_post_id` cleared. It may go
  again only when the human asks: its approval message goes out (`gate.md`), and their Publish returns it to `uploaded`,
  to go on at The post with a new slot.

A post whose id the `note` lists as `canceled:` is never its match.

**Handed over instead.** A boqo row moves to By hand only under `auto`, only on the person's word, and only once
nothing of it can still go out through boqo. Read which case the row is before writing anything:

| The row | What happens, in this order |
|---|---|
| `approved`, `uploading` or `uploaded`, with no `card_id` and no `boqo_post_id` | Nothing is scheduled in boqo, so boqo may be up or down. Move `boqo_project_id` to `note` as `abandoned: <projectId>`, then By hand |
| `post_requested`, or any row with a `card_id` or a `boqo_post_id` | boqo holds the post, or may. 1. boqo must be reachable: while it is not (Failures → boqo down) the row waits, and the report says why. 2. With a `boqo_post_id`: `cancel_post {postId}`. With none yet: wait for Reconcile to find the post or to end the request as `failed`; never guess. 3. A fresh `list_schedule` read (as The post's verify read) no longer lists the post. 4. Only then write `canceled: <postId> (handed over <date>)` and `abandoned: <projectId>` in `note`, clear `card_id`, `boqo_post_id` and `boqo_project_id`, and go on at By hand |

A cancel that fails, or a read that still lists the post, changes nothing in the row: an alarm (`<slug> <channel>:
still in boqo: <error>`), no hand-over, and the next run reads again. A row without a `boqo_project_id` is by hand
for good: held later (a red funnel, a stop), it goes again by a new hand-over message, never back to the boqo path.

## The buffer

The queue stays 2–3 days ahead on every channel (`account-state queue --channel <channel>` → `daysAhead`), so a boqo
channel lives without a session and a by-hand channel's person knows what is coming. Each post takes its day's slot as
soon as it passes the gate: `slot --day <for>`, then `when: {date, time}` or the hand-over. In auto, the run posts
them ahead; in calibration, their approval messages go out ahead. An empty buffer is rebuilt over 2–3 days, never in
a batch (`auto.md` → The gap).

## The post

Through boqo, one `post_video` per row: one post on one channel.

1. Write `post_requested`, with `requested <ISO>, for <date> <time>` in the record's Card line for the channel.
2. `post_video {items:[{source: <projectId>, accountIds:[<the channel's account_id>], when:{date, time}}]}`, plus
   `caption` only on the field branch, plus `instagramAiLabel: true` only on a labelled Instagram post. No `uniqueize`.
3. Write `card_id` from the reply (`cardId`). Write its `chargedCredits` into the ledger's `cost_credits` and the
   record's Cost (actual), and append `<date>,<slug>,boqo,0,<chargedCredits>,post_video` to `marketing/budget.csv`
   (the date on the account's clock).
4. Verify: `list_schedule {from: now − 48 h, to: now + 32 d, accountId}`, merged over `.boqo-upload/schedule.json`.
   The post matches by Reconcile's rule below. Write `scheduled`, `boqo_post_id`, `scheduled_at` and "Scheduled for"
   on the account's clock.
   - boqo creates the post only once the original is ready. Not listed yet: poll `get_project {projectId}` every
     2 minutes for up to 20 minutes, until its `status` is `ready`, then read again. `failed`: stop, the row
     becomes `failed` with the project's error in `note`.
   - Still not listed: leave `post_requested` with its `card_id`. The next run's reconcile picks it up.
5. Run `node <skill>/tools/account-state.mjs mode` and report the calibration count (`gate.md` → After the answer).

## Reconcile (every start, before any call)

Through boqo. Each row at `uploading`, `uploaded`, `post_requested` or `scheduled`:
`get_project {projectId}` (not for `scheduled`), then its match in the start read (from 48 hours back, complete).

`get_project`'s `status` is one of `queued | processing | ready | failed`: `queued` is still waiting for the file;
`processing` and `ready` are past upload (`ready`: the original is finished); `failed` is failed: the row becomes
`failed` with the project's error in `note`.

**The match:** the channel's `accountId`, and the unwrapped, unescaped `clipTitle` equal to `upload_name` without
`.mp4`. When the row knows its slot (the Card line's `for <date> <time>`, or "Scheduled for"), the schedule row's
account-clock time must equal it too: compare the printed column, never convert a time by hand. A post whose id the
row's `note` lists as `canceled:` is never its match. Two posts still matching: change nothing, and ask the human.

Then:
- **First, the recall.** While `autopost` is `paused` by a stop since its request (`paused_by` names a stop reason,
  dated after the record's Card line `requested <ISO>`), a `post_requested` row with `approval: auto` and a
  `card_id` whose post the read now lists is recalled: cancel it by A canceled post, above, and stop there. A human
  `config pause` (`paused_by: human <date>`) recalls nothing. Check this before the match below: it takes precedence
  over "a matching post → `scheduled`".
- **A matching post:** take its id and status. `posted` → `posted`, and After it posts runs; `failed`, `held`,
  `canceled` → the same, with its `errorMessage` in `note`; any other status → `scheduled`.
- **`scheduled`, slot passed, listed but not as `posted` yet:** stays `scheduled`; the next run reads it again.
- **`scheduled`, inside the read's window, and its post not listed at all:** `list_schedule` never lists a canceled
  post, so it was probably canceled in boqo. An alarm, `<slug> <channel>: <boqo_post_id> is gone from boqo's schedule`,
  and the human's step: say whether it was canceled. On their word: A canceled post, above, the second way. Until then
  it stays `scheduled`.
- **`post_requested` with a `card_id`:** never call `post_video` again. Wait for the post.
  - **`get_project` says `ready`, 30 minutes have passed since the request, and no post is listed:** boqo's hand-off
    skipped this account (the time passed, a reconnect, a file over the cap, captions off). It cleared the approval and
    rang only boqo's own bell, so no post will come. An alarm, `<slug> <channel>: boqo took card <card_id> but made no
    post; see boqo's bell`. On the human's word, write `failed` with their reason, which frees The slot's rule 1;
    Failures says how it can go again.
- **`post_requested` without a `card_id`, and no post:** call again only once `get_project`'s `status` is
  `ready` and 30 minutes have passed since the request (the record's Card line, or the log), and only after
  Preconditions above hold again (for a `sale` post, a green funnel today; under red or yellow it waits), so it waits
  for step 11, when the funnel's colour exists. Note `second request`.
- **`uploaded`, no post:** go on at The post, at step 11 (after the funnel's colour, and in auto the stops), and only
  once the gate is passed (Preconditions: a canceled auto post needs a human Publish while `autopost` is not `auto`).
- **`uploading`, `status` `processing` or `ready`** (past upload): write `uploaded`, delete the reply file, and
  never PUT again.
- **`uploading`, `status` `queued`, reply still valid** (`expiresAt` ahead): run the PUT again, then
  `complete_upload`.
- **`uploading`, `status` `queued`, with an expired or missing reply:** the row keeps the old `projectId` in `note` as
  `abandoned: <projectId>`, and a new upload starts at `uploading`.

Tell the user in at most two lines per row: `found <post id>, <time on the account's clock>; set <status>`, or
`found nothing; <what happens next>`.

## Failures

- **PUT 4xx, a refusal of `complete_upload`, or `needs_approval`** (a connection cap): status `failed`, the reason in
  `note`. Tell the user. The agent-captions refusal is not this: see The caption.
- **A refusal of `create_upload`** (no `projectId` in the reply): nothing exists in boqo yet. Status `failed`, the reason
  in `note`. On the human's word, it returns to `approved` and starts The upload again, after any fix the refusal asks for.
- **A refusal of `post_video`** ("That time has passed", a reconnect, Defaults), or a `failed` row from Reconcile's
  hand-off alarm: status `failed`, the reason in `note`, and `boqo_project_id` kept, because the file is already in boqo.
  On the human's word, it returns to `uploaded`, with `card_id` and `boqo_post_id` cleared, and goes on at The post with
  a new slot. Never a new record: it would orphan the project.
- **Asked for the file, to post by hand, on a boqo channel:** under `boqo-only`, one line: posts go only through
  boqo, and the post waits as a file; no file, no steps for a native post; then the rest of the day. Under `auto`:
  A canceled post → Handed over instead; then By hand.
- **boqo down** (the MCP unreachable, the wrong login, or the channel's account not `active`): production goes on,
  and every post of that channel waits as a file at its status. The day goes on: plan, produce and check (steps
  7–9), the community list, the close. The report carries:
  - an alarm line: `Alarm: boqo <error> since <time>; posts wait as files: <slugs>`; for a wrong login (Start, step
    1), `<error>` is `login does not hold <account_id>`;
  - the human's step: `/mcp` to log in again, or a reconnect in boqo → Accounts if `list_accounts` says so; under
    `auto`, also that a waiting post with no `card_id` and no `boqo_post_id` can be handed over on their word, and
    that one in boqo's queue waits for boqo (A canceled post → Handed over instead);
  - the next queue rows by name and stage (`ready`, `script`, `idea`): the production that goes on.
- **A problem report** is drafted for every failure, in the log under Owed:

  ```
  Title: <what blocks, in a line>
  Body: What blocks: … / How it was found: <call, error, time> / The workaround: … / Impact on <channel> @<handle>: …
  ```

  With `issues_repo` set it is filed there once, only when the fault is not the human's own step (an expired login
  is drafted and never filed), after `gh issue list --repo <issues_repo> --search "<words>"` finds none, and after the
  `Filing …` line (SKILL.md → Rules): `gh issue create --repo <issues_repo> --title "<title>" --body-file <file>`, with
  `--label <issues_label>` when the config names one. With `issues_repo` empty it stays in the log, and the report's
  Alarms names it.

## After it posts

- Write `posted` and `posted_at` in one edit. Through boqo, `posted_at` is the post's `scheduledAt` in the start
  read: `when` is an explicit time, so it carries no jitter. Never from `get_analytics`: it lags, and it can freeze.
  By hand, it is the confirmation's time (By hand, step 5). A `posted` row without it stops `due`, `norms`, `stops`
  and `streak`, and `mode` refuses it.
- Through boqo, the permalink comes from `get_analytics` `top` (the unwrapped title = the upload name without
  `.mp4`). No row there: leave `permalink` empty and write `Permalink: owed` in the record; each run tries `top`
  again. The fallback is the public profile read logged out, or the human.
- A post made to loop (`loopSafe` in the probe): the first time one goes out on a channel, look at the platform's
  copy on its public page and check the loop still closes (the last frame meets the first, the sound starts at
  zero). With no permalink yet this stays owed in the log. A broken loop is a problem report (Failures).

## Never

- a post the human did not approve (calibration) or the checks did not pass (auto);
- one post on one channel both ways;
- under `boqo-only`: a native post, or a file handed over for one;
- `posted` for a handed post without its link;
- a second `post_video` for a row that has a post, or a `card_id`;
- `reschedule_post` with `now` to catch up;
- `uniqueize` on a looping film;
- a caption the human did not approve, byte for byte.
