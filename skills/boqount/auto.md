# Auto mode, the stops, the gap and the timers

SKILL.md steps 3 (the gap) and 10 (the gate, while `autopost: auto`), the stops after step 5 and before each post,
and the session timer. `marketing/config.md` is still the whole autonomy: auto runs only while it says
`autopost: auto`.

The per-channel commands below (`stops`, `streak`): run it for each channel in `channels`; with one channel the flag
may be left out.

## The switch

When `node <skill>/tools/account-state.mjs mode` says `switchDue: true` (calibration's approved posts reached
`calibration_posts`), whether after a Publish (`gate.md`) or after step 5's reads, and every `Analytics` line in
`state.md` (one per boqo channel) reads `fresh`:
1. Set `config.md` to `autopost: auto`, with `paused_by:` empty.
2. Log `Ruling: calibration <approved>/<needed> → autopost: auto (auto.md) — auto after calibration_posts approved
   posts — cost if wrong: posts go out without a question until a stop or a config pause`.
3. Save, locally. Step 10 is this file from now on, in this run too.
4. Report it on the Auto line ("auto mode on, after 10/10").

`switchDue` never acts on `paused`: only the human resumes.

**The switch waits while the readings are stale** (`measure.md` → Stale analytics). With frozen analytics `views_72h`
stays empty, so the reach stop can never fire: auto would run with one of its stops dead. Calibration goes on, every
post keeps its gate, and the report carries `Alarm: calibration <approved>/<needed> done; auto waits for analytics
(<line>)`. It switches at the first run whose lines read `fresh`. The human may overrule with
`config set autopost auto`, which is a `Ruling:`.

## Step 10 in auto

- **No question.** No approval message, no type question, no AskUserQuestion, no wait. A `checked` post with `GO`
  goes straight to posting (`posting.md`) on each of its channels: through boqo, or, on a channel that goes by hand,
  the hand-over message (`posting.md` → By hand) with no Publish from the person. A handed post is `posted` only on
  their link.
- **The type is your pick**, written as `type_source=skill` and `approval: auto` in the record and the ledger. The human
  may correct it later (by saying so, or with `post`). The record then reads `type_source: human`, with a `Ruling:`.
- **The record's Posting** gets `- Gate: auto <ISO> (autopost: auto)` in place of the message line. Commit it locally
  before the first call.
- **Everything else still runs**: the check (`check.md`), the budget, the limits (at most 2 a day on a channel, only
  in the windows, one a day first), the funnel (a `sale` post only on green), the stops, and every precondition in
  `posting.md`.
  - **`GO with edits`** is a caught post: it needs a human Publish in gate.md's shape, and does not go out alone. So
    does a record with a `Hook ruling:` line (`check.md` item 2), and one with a `Script: written from the file`
    line (`check.md` → What it reads).
  - **A record whose `- Gate 3:` line reads `owed`** (`film.md` → The gates writes it) is held for the person
    exactly like `GO with edits`. Any other film's gate in auto is the check plus the stops: nobody watches it at speed
    or hears it (`film.md` → The gates).
  - **A record that carries outside material** is held for a human Publish the same way, whatever its kind (`film`,
    `clips`, `file`, `slideshow`): the test is its `Outside material` line (anything but `none`); `Gate 3: owed` is how
    a film says it.
  - **An ad post** (`Ad: yes`) needs a human Publish too (`check.md` item 3).
  - **`HOLD`** is held, as always.
- **A batch the person approved in one answer** (`gate.md` → A batch) is scheduled as approved: each post with
  `approval: human`, in its own slot, under the same limits. A post made after that answer is not in it: it passes the
  same checks and the stops with no question, as above.
- **A changed film needs a new approval, whatever the mode.** A film that changed after it was approved (a new cut,
  another file), by the person, in a batch or by auto, goes back through the check and out only on a human Publish in
  gate.md's shape.
- **The caption rules hold.** Through boqo, the agent's own caption goes out only on the field branch, with the setting
  `on`; with the setting `off`, it is the file-name path. By hand, it is the hand-over's block. Either way it is the
  channel's "As it will appear" block, byte for byte, as the check passed it. Any later change goes back through the
  check.
- **The AI label holds.** While the AI label test is owed (`state.md` → Open questions), the only labelled post that may
  go out on Instagram through boqo is the one `state.md`'s `AI label test post` line names, and no second one goes out
  before the human confirms the platform shows its AI label on it (`posting.md` → The AI label). Auto never confirms
  the test itself, and never names the test post. A post `held` with `ai-label by hand` waits for the human's word.
- **Every act goes on the Auto line**: of the report and of the log entry. That covers each post on each channel
  (`<slug> <channel>: <type> (skill), <date> <time>, <kind>, $<cost>`), each hand-over, each pause, each cancel,
  and the switch.

## The stops

Run `node <skill>/tools/account-state.mjs stops --channel <channel> --funnel <colour> --restricted <yes|no> [--since <ISO>]`:
- **in the morning**, for each channel, after step 5's reads and step 6's verdicts, once the funnel's colour is settled.
  Today's readings come first, never a stops call before them;
- **before each post**, for each channel it goes to: between its check and its `create_upload` or its hand-over, or
  before a `post_video` that is resumed. A resume the start reconcile finds (an `uploaded` record, a second request)
  waits for step 11, when the funnel's colour exists.

The inputs:
- `--funnel` is today's colour from step 4: `green`, `yellow` or `red`.
- `--restricted` is the channel's `Account status (<channel>)` line in `state.md`: `restricted` → `yes`; `ok` or
  `unread` → `no`.
- `--since` is `config.md`'s `resumed_at` whenever it is set (the tool also reads it): after a resume, a drop run
  counts only posts posted after it.

The tool stops on any of these:
- `funnel red` (yellow does not stop);
- `two caught in a row` (check catches; `caught:funnel`, the funnel holding a sale post, is not one, and a post held
  only for the human's word is not caught at all: `check.md` → The output);
- `reach under half the norm three in a row` (an ad post's bought views are kept out: `measure.md` → Bought views);
- `<channel> restricted`.

A stop on any channel pauses auto-posting for the whole account: one config, one switch. On `stop: true`, before any
further call about a post:
1. Write `config.md`: `autopost: paused`, `paused_by: <channel>: <the reasons, joined by "; "> <YYYY-MM-DD>`, with
   every channel that stopped, joined by "; " (for example
   `paused_by: tiktok: reach under half the norm three in a row <date>`). Then the `Ruling:` line, and Save,
   locally.
2. **Queued auto posts are recalled,** on every channel. Every `approval: auto` row at `scheduled`, or at
   `post_requested` with a `card_id`, takes the one cancel path (`posting.md` → A canceled post, as measure.md's red
   funnel does):
   - its post id is `boqo_post_id`, or, at `post_requested` with a card and no `boqo_post_id`, its match in the start
     read (`posting.md` → Reconcile);
   - write `held`, with `canceled: <postId> (auto stop <date>)` in `note`, `card_id` and `boqo_post_id` cleared, its
     `boqo_project_id` kept; Save, locally; then `cancel_post {postId}`. Log each under Auto.
   - a `post_requested` row with a card and no match yet (boqo has not listed the post) is recalled at the first
     run whose start read lists it: Reconcile cancels it then, by the same path. Until then no other post goes out
     on that channel (`posting.md` → The slot, rule 1).
   - an `approval: auto` row at `handed` whose time has not come: the Alarms line asks the person not to publish it.
     On their word that it is not out, write `held`, with `canceled: by hand (auto stop <date>)` in `note`; a link
     instead makes it `posted` (`posting.md` → By hand).

   Posts the human approved stay, except a `sale` post under red.
3. **Approvals come back.** Every post at `checked`, and every recalled one, gets its message in gate.md's shape, and
   nothing goes out without a Publish. A recalled boqo row's Publish returns it to `uploaded` and it goes on at
   `posting.md` → The post with its project: it never calls `create_upload` again. A recalled hand-over's Publish
   gets a new slot and a new hand-over message.
4. **Tell the human why**, on the Alarms line, with the channel and the evidence:
   - a drop: the tool's `run`: each post by slug, its `views_72h` and its `baseline` (the median of its type's posts
     before the run, or `pooled`), never `norms`' pooled norm;
   - two caught: the two posts and their rules;
   - red: the link;
   - restricted: the screenshot or the human's words.
5. **Tell them how to resume**: `/boqount config resume`. A resume writes `resumed_at`, so the same three drops
   never stop auto again. `two caught in a row` is not scoped by `resumed_at`: after a catch stop, the same two catches
   stop auto again at the next `stops` call until a newer checked post exists (the check runs while paused, so the next
   film that passes clears it). A red funnel or a restriction still stops it. Say which applies.

**While `paused`** (a stop, or `config pause`), the day runs calibration's gate (`gate.md`).
- `config pause` stops auto at any time: `autopost: paused`, `paused_by: human <date>`.
- `config resume` sets `autopost: auto`, once `mode` shows calibration done, empties `paused_by` and writes
  `resumed_at:` as an ISO instant with `Z` (`resumed_at: <YYYY-MM-DD>T<HH:MM:SS>Z`). Only the human resumes.

## A restricted channel

`state.md` → Today carries, for each channel, `Account status (<channel>): unread|ok|restricted, <date> (<source>)`.
Two things change it:
- the Monday account status screenshot (`measure.md` → Screens writes the line);
- anything the human says about the channel's recommendations being restricted.

`unread` for more than 7 days goes into the screenshot request again. A restricted channel stops auto for the whole
account, with the tool's reason `<channel> restricted`.

## The gap (step 3)

The last run is the newest heading in `marketing/log.md` tagged `day run` or `evening close` (`memory.md` → The log
entry); with none, there is no gap. A last run before yesterday is a gap, and the day runs in catch-up mode:
- **The start read** (`posting.md` → Start) of each boqo channel goes from the last run's time instead of 48 hours
  back, so every post boqo published or scheduled during the gap is reconciled. The read must still be complete
  (`truncated`: page it). The posts still `handed` are named as always (`posting.md` → By hand).
- **Every due checkpoint** is read at its real age (`account-state due`), under measure.md's late rule.
- **The days with a post** are counted honestly, after the reconcile, for each channel:
  `node <skill>/tools/account-state.mjs streak --channel <channel> --from <last run's date> --to <yesterday>`. Report
  `Days with a post: <withPost>/<days> since <date>` in Numbers (`memory.md`), per channel, and name each day without
  one as missed. A missed day stays missed: never a post scheduled into a past day, never `reschedule_post` with `now`.
- **Never a batch.** Today gets at most `max_posts_per_day` on each channel, in the windows, one a day first. The
  buffer is rebuilt over 2–3 days (`posting.md` → The buffer): every `ready` film gets a day and its record and is
  checked, and one the check holds is `held` with its rule, never left undated.
- **Asked to catch up**, decline in one line, with the reason: "No catch-up batch: at most 2 posts a day on a channel,
  in the windows; the missed days stay missed, and the queue fills over the next 2–3 days." Then run the day.

## Timers

While the session is open, the skill can wake itself, only on the person's word:
1. **Proposed once.** With no job whose prompt is `/boqount` in `CronList`, the run proposes the timer once, in the
   report (a daily `/boqount` at 21:13 on the account's clock), and logs `Asked: timer`; a run whose last 7 days of
   the log hold that line or the answer does not propose it again. It is created only on a yes (a `Ruling:`), and
   `state.md` → Today then keeps `Timer: yes, <date>`: with that line, a lapsed timer is created again without asking.
2. **Renewed each run** once it exists: `CronList`; delete the job with the prompt `/boqount`, then
   `CronCreate {cron: "13 21 * * *", prompt: "/boqount", recurring: true}`. A recurring job expires after 7 days,
   so renewing each run keeps it alive.
3. The cron runs on the computer's clock. It means 21:13 on the account's clock only while the computer is set to the
   account's zone (`timezone` in config.md); otherwise convert the hour first.

Timers are a convenience. The human's morning start is the rule, and a missing timer is no alarm.

## Red flags

| Thought | Reality |
|---|---|
| "Calibration is done, but I'll ask once more to be safe" | After the switch, step 10 asks nothing. The stops are the safety |
| "10/10, so auto, even with the analytics frozen" | The switch waits, with an alarm, until the `Analytics` lines read `fresh`: the reach stop needs those numbers |
| "auto.md isn't built, so it's calibration" (with this file present) | It is built. `switchDue` switches |
| "Three posts below the norm, but today's film is fine" | `stops` decides, and a stop pauses before the post |
| "I'll pause, but post today's film first since it's checked" | The pause comes first; today's post goes to approval |
| "Paused now; what auto already scheduled can still go out" | Recall it by the one cancel path (`posting.md` → A canceled post): `held`, then `cancel_post`; a Publish resumes it |
| "The user wants all the missed days today" | never a batch: at most 2 today on a channel; the rest over 2–3 days |
| "There was no run that day, so it doesn't count" | A day without a post counts as missed |
