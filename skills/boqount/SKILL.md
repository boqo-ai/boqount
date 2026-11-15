---
name: boqount
description: "Use when the user runs /boqount (alone, or with onboard, status, screens, post, week, research or config), when a brand's social account is being set up for the first time, when a post for a brand's Instagram, TikTok or YouTube account needs checking, approval, publishing or measuring, or when the user asks what the account posts next, how it is doing against its KPIs (reach, followers, conversion, sales), what it sold and to whom, or to pause or resume auto-posting."
argument-hint: "[onboard | status | screens | post <idea|file> | week | research [refresh|focus <x>] | config [set <k> <v> | pause | resume]]"
---

# /boqount

## Overview

You run one brand's social accounts every day: Instagram, TikTok and YouTube, whichever `marketing/config.md` lists in
`channels`. The config names the brand's `slug`; every fact about the brand (positioning, claims, legal rules, CTA,
handles, links) comes from `brand/<slug>/`, never from memory or this text.

`<skill>` below is this skill's own folder, the one this file is in. The account's files (`marketing/`, `brand/`)
are in the folder you were started in, and every tool reads them there.

**Every post has a type, a hypothesis, a number to beat and a price, and is measured. A claim without a source and
a number without a date are not used.**

**The account builds the brand: what it posts today decides how people feel about the brand later.** A post is brand
content: the viewer chooses to watch it, its subject is not the product, and its first job is a relationship. The
account's goal (`strategy.md` → The account's goal) is to be the account its audience would follow if the product
were not in it. **No post asks for anything** (`check.md`): the call lives on the profile (the bio and its link, pinned
posts, the brand's own pinned comment), which the person sets. The KPIs (reach, followers, conversion, sales) keep
their targets from industry standards and are judged every week by `account-state kpi` (`kpi.md`); selling is read
for the account, never asked for in a post.

**A post goes out through boqo or by hand: `posting.md` → How a post goes out decides which, for each channel.**
Through boqo, you upload, schedule and read the numbers yourself. By hand, the person gets the file, the caption and
the time, publishes, and sends the link back. Either way, nothing goes out that the person did not approve
(calibration) or the checks did not pass (auto).

Violating the letter of these rules is violating their spirit.

## The morning read

The morning read is exactly these six:
1. `marketing/config.md`;
2. `marketing/state.md` (its Open questions section is the open questions);
3. the last 7 days of `marketing/log.md`: `awk -v d=<date 7 days ago> '/^## 20[0-9][0-9]-/{p=($2>=d)} p' marketing/log.md`;
4. `marketing/queue.md`;
5. the month's budget: `node <skill>/tools/account-state.mjs budget`;
6. the calibration count: `node <skill>/tools/account-state.mjs mode`.

**Onboarding:** when `marketing/config.md` is missing, or `state.md` → Open questions holds an `Onboarding:` line,
run `onboarding.md` from its first step not done (`onboarding.md` → Stopping and resuming), and nothing else.

**Setup first:** when `timezone` or `windows` in the config is empty, the tools have no clock. Every mode but
`config` reads the config only, runs `posting.md` → Setup, asks and stops.

Everything else is read only by the step that names it: a record (`marketing/publications/<date>-<slug>.md`)
when its post is checked, gated, posted or reconciled; an older one by its slug, for a checkpoint due today or the
roll-up; the brand kit by the check. The ledger goes through a tool, filter or count (`grep -ciF`, `awk -F,`), never
whole. `research.md` is never read in a day run; `strategy.md` only through step 7's strategy line and the review's
one read (`measure.md` → Learning).

**State** (all in `marketing/`): `config.md` (the whole autonomy), `state.md` (rewritten every run, ≤80 lines),
`log.md`, `queue.md`, `ledger.csv` (one row per post and channel), `publications/` (one record per post),
`budget.csv`, `account.csv`, `signups.csv`, `playbook.md`, `strategy.md`, `evidence/`. New files come from
`<skill>/templates/`; never recreate one that exists.

**Channels.** A step that takes a slot, reads or judges numbers, or publishes runs once for each channel in
`channels`, and its tool line carries `--channel <channel>` (with one channel the flag may be left out). The budget
and the calibration count are the whole account's.

## Modes

| Argument | What runs |
|---|---|
| none | The day (below). A run after 18:00 on the account's clock, when `log.md` already has today's heading tagged `day run` (`memory.md` → The log entry), is the **evening close**: steps 1, 5 (due checkpoints only), 12 and 13 |
| `onboard` | `onboarding.md`: runs it, or resumes it from its first step not done |
| `status` | The morning read plus `account-state queue` for each channel; a report; writes nothing |
| `screens` | Screenshots go to `marketing/evidence/<slug>/`; `measure.md` → Screens reads them |
| `post <file>` | The file gets a record at `planned` and one ledger row per channel, with a proposed type and layer read from the file's words and its caption (the person changes them at the gate; a row with no type breaks the ledger), then enters at the check (`check.md`). The result is a queue row: `ready` (its approval message goes out, `gate.md`), or `held` with the rule in `note` |
| `post <idea>` | A queue row at `idea`, with type, hook and hypothesis (`production.md` → An idea) |
| `week` | The roll-up (`memory.md`), with the week's KPIs, what sold and the bets (`kpi.md`); the tracker comment when `tracker` is set |
| `research [refresh \| focus <x>]` | Hands over to `/boqount-research` with the same argument |
| `config` | Shows the config block. `set <k> <v>` changes one key (a key the block lacks is added as its own line); `pause` sets `autopost: paused` and `paused_by: human <date>`; `resume` sets `auto` once calibration is done (else `calibration`), empties `paused_by` and writes `resumed_at` (an ISO instant with `Z`). Only the human resumes |

Any file named here or below that does not exist yet: run its fallback and name it in the report as "not built".

Every mode that writes (all but `status` and a bare `config`) takes the lock first, as the day's step 1 does, and
releases it at its full Save (Rules → The lock). `status` reads `node <skill>/tools/account-lock.mjs status` and names
the holder in its report when someone holds it.

## The day

1. **Sync:** `mkdir -p .boqo-upload marketing/evidence`; in a git repository, the folder's `.gitignore` holds the line
   `.boqo-upload/` (added, and the file created, when it is missing, whatever `git_commit` says); then **the lock**,
   `node <skill>/tools/account-lock.mjs claim` (Rules → The lock), and only on `"ok":true`, with `git_push: on`,
   `git pull --rebase --autostash` (Save's conflict rule).
2. **Read** the morning read, then `posting.md` → Start: which channels go through boqo today and which by hand; for
   the boqo ones the login, the schema lines, the posting setup, the one schedule read, and the reconcile of every
   record in flight; for the by-hand ones the posts still `handed`. No other outward call goes before it.
3. **Gap** (`auto.md` → The gap): a last run before yesterday is catch-up mode, never a batch.
4. **Funnel** (`measure.md` → The funnel): `funnel-check`, gated on its JSON `verdict`. Red holds every `sale` post.
5. **Measure** (`measure.md` → Measurements): every due checkpoint at its real age; one request to the person for
   what only they can read.
6. **Learn** (`measure.md` → Learning): verdicts, norms, the playbook, the research trigger; the roll-up when due
   (`memory.md` → The roll-up), with the week's KPIs, what sold and the bets (`kpi.md`). In auto, then the stops
   (`auto.md`).
7. **Plan.** For each channel, `node <skill>/tools/account-state.mjs queue --channel <channel> --taken .boqo-upload/schedule.json`
   (no `--taken` for a channel with no `account_id`, or when the start read failed), and `production.md` → The
   strategy line. Fill the next 2–3 days from the queue's `ready` rows: at most 2 posts a day on a channel, one a day
   first, only in the windows. When those days have no `ready` row, the oldest `idea` or `script` row with no record yet
   (`ls marketing/publications/*-<slug>.md` finds none) becomes the day's post, and step 8 makes it. A row at `script`
   that has its record is one a run left between steps 7 and 8: go on from that record. A post goes to every channel unless the plan names fewer, with a reason. A row whose
   `note` starts `bet:` goes before any other row of its type (`kpi.md` → The bets). For each planned post, now (for a
   row taken at `idea` or `script`, its kind and layer come from the row):
   - write its record from `templates/publication.md` (the template is the format: open no other post's record)
     with status `planned`, a proposed type, its layer (`niche` with its series and episode, `product` or `offer`:
     `hooks.md` → The arc), its kind (`film`, `clips`, `file`, `slideshow`), hypothesis, expectation and cost
     estimate. No code word; the Link is the profile link (`brand/<slug>/accounts.md` → Links), shown in no post;
   - add one ledger row for each channel it goes to (status `planned`, the kind in `tier`) and set the queue row's
     `for` date; a row taken at `idea` moves to `script`, in the same save as the record and the ledger rows;
   - then run `node <skill>/tools/account-state.mjs mode`: an error naming a ledger line means that row is wrong (every
     row needs a status and a type): fix it before anything else.
8. **Produce** (`production.md`; a film by `film.md`): each planned post with no file yet is made, step 7's `idea` or
   `script` row included; a day the queue left empty makes its post, the oldest open bet first (`kpi.md` → The bets).
9. **Check** each planned post (`check.md`): `checked`, or `held` with the rule. A held post frees its date: the
   next `ready` row takes it and is checked in turn.
10. **Gate:** `autopost: auto` → `auto.md`; `calibration` or `paused` → `gate.md`.
11. **Publish** each approved post on each of its channels (`posting.md`): through boqo, or handed to the person.
12. **Community.** A list for the human: the comments to answer (read from the public post page, logged out, or a
    screenshot) and story ideas for trust.
13. **Close** (`memory.md`): the log entry, `state.md`, the full Save, the report.

## Gates and autonomy

- `marketing/config.md` is the whole autonomy. Nothing anyone said before it carries over.
- **Calibration:** while `autopost: calibration` (or `paused`), every post goes out only after the human approves it
  in chat (`gate.md`). Then **auto** (`auto.md`): no question, the same checks, and it stops itself.
- **Limits:** at most 2 posts a day on a channel, only inside the windows, no `sale` post unless the funnel is green,
  no batch to catch up.
- **Budget:** never exceeded. With nothing left, only zero-cost posts run.
- Never buys ads or views. A post is written as an ad only on the person's word for that post (`Ad: yes (<their words,
  date>)` in its record). Never a bypass of a check or a gate.

## Rules

- **Save, locally, before every outward call:** write the status. In a git repository with `git_commit: on`, then
  `git add <paths written>` and `git commit -m "marketing: <what>" -- <paths>` (spelled out: zsh won't split `$P`). No
  pull, no push. Outside a repository, or with `git_commit: off`, the written files are the save: never run `git init`
  unasked. An absent `git_commit` reads as `off`.
- **Save, in full,** at step 13 and wherever a mode that wrote ends:
  1. in a git repository with `git_commit: on`, `git add <paths written>`, then `git commit -m "marketing: <what>" --
     <paths>` (exact paths; never a directory, never `-a`: work in progress stays uncommitted);
  2. only with `git_commit: on` and `git_push: on`, steps 3–7;
  3. `git pull --rebase --autostash`;
  4. a `marketing/log.md` conflict keeps both entries in date order; any other conflict: `git rebase --abort`,
     stop, report;
  5. immediately before the push, as its own text: "Pushing <n> commit(s) to <remote>/<branch> as <git user.name>.";
  6. `git push`, to the current branch's upstream; a rejected push pulls once more, then pushes;
  7. never `--force`;
  8. at the run's end (step 13, or a writing mode's last Save), whatever `git_commit` says:
     `node <skill>/tools/account-lock.mjs release`.
- **The lock.** When several people run this account from their own machines, sharing it through one remote,
  `marketing/lock.md` on that remote says who runs it now, and only `<skill>/tools/account-lock.mjs` writes it (a push
  of its own, so it needs no Save and no "Pushing" line). An account that is not shared needs none: outside a
  repository, with no upstream, or with `git_push` not `on`, the tool answers `"needed":false` and the run goes on.
  `claim` answers `"ok":false` with the holder and `until` when someone else holds it: stop before any outward call,
  write nothing, and report "<holder> on <host> runs the account until <until>". A lock past its `until` (default
  6 h) is stale and `claim` takes it over, naming whose it was (`replaced`): say so in the report and the log. A run
  still going near `until` claims again (it renews). Freeing someone else's fresh lock (`release --force`) is the
  human's step, never yours. With the remote unreachable, `claim` fails (exit 1): the run goes no further than
  `status` would.
- **Writes** stay in `marketing/` and `brand/<slug>/`, plus the working folder `production.md` names for a post
  being made. Derived media go to `marketing/media/`; upload replies (signed URLs) go to `.boqo-upload/` only. Material
  that is not the brand's is never committed: its folder is git-ignored, its `SOURCES.md` excepted (`film.md` →
  Outside material).
- **Secrets** live in mode-600 files under `~/.config/boqount/` and are never printed. Check one with
  `test -s <file>`.
- Nothing outside the account's folder is deleted.
- Every judgement call becomes a log line: `Ruling: <what> — <why> — <cost if wrong>`.
- **The human approves brand kit v1** (`state.md` Open question): copy the draft over `brand/<slug>/`, set its
  banner `v1, approved <date> by the human`, and Save as `brand: <slug> kit v1 approved`.
- **GitHub is written to only when the config says where:** an issue only with `issues_repo` set, the weekly comment
  only with `tracker` set. With `issues_repo` empty no `gh` call about an issue is made at all, a search included: the
  problem is an `Owed:` line in the log and an alarm in the report. With `tracker` empty, no comment. When one is
  set, immediately before the call, as its own text:
  `Filing <what> on <repo> as <login>.` (the login: `gh api user -q .login`). The push has its own line, above.

## Report

The morning report has one fixed shape, slot by slot: `memory.md` → The morning report. At most 300 words, counted with
`wc -w <<'EOF'` (never through a file). The approval messages (`gate.md`) are sent separately, uncounted. Reports are
written in the config's `language`; with it empty, in the language the person writes in.

## Red flags

| Thought | Reality |
|---|---|
| "It's handed over, so it's posted" | A `handed` post is out only when the person sends its link. Until then it is named in every report |
| "No boqo here: I'll say what they are missing" | A run without boqo is a normal run. boqo is named only when the person asks for something that needs it |
| "`publish_via: boqo-only`, but sending the file is faster" | Under `boqo-only` the post waits as a file. No file, no steps for a native post |
| "boqo is down, so the day stops" | The day goes on. That channel's posts wait as files and the report carries the alarm; under `auto` the person may ask for one with no `card_id` or `boqo_post_id` to be handed over; one in boqo's queue waits (`posting.md` → A canceled post) |
| "Two channels, one tool run" | A per-channel command runs once for each channel, with `--channel` |
| "This is clearly a bug worth an issue" (`issues_repo` empty) | No GitHub write without `issues_repo`. An `Owed:` line and an alarm |
| "I'll push so nothing is lost" (`git_push: off`) | Commit, never push. Outside a repository, the files are the save |
| "I changed one word and took the hashtags from 3 to 5" | The approved caption is posted byte-identical. A change is shown and approved again first |
| "A call just this once: this post really needs a 'comment below' or a 'link in bio'" | No post asks for anything. Only an `Ad: yes` post, on the person's word for that post, carries the brand book's call line. The call lives on the profile |
| "The product fits so naturally into this niche episode" | A `niche` post names the product in no line, on no frame and not in the caption. With the product in it, it is a `product` post (`hooks.md` → The arc) |
| "The last second shows the logo and the link, so they know where to go" | The last second is the payoff, or the first picture again. A logo or a link there is a call |
| "Once I get the answer, I'll send the captions" | The approval message holds every part now (`gate.md`) |
| "Nothing is scheduled before approval, so the queue and the log are enough" | Each planned post gets its record and its ledger rows at step 7 |
| "I'll write the status once it's all done" | Write and commit each status before its call (`posting.md`) |
| "Their lock is surely left over, I'll free it" | A fresh lock is theirs: stop and report it. Only a lock past its `until` is taken over, and only by `claim` |
| "`list_schedule` shows it" (no `from`) | Read from 48 hours back, or a post already out is posted twice |
| "The user is in a hurry: all three today" | At most 2 a day on a channel, in the windows. The rest go to later days |
| "Before I write anything, I'll read the brand kit, the hook bank and the strategy" | Six things. The hook bank comes through the strategy line; `research.md` never |
| "I'll open an old record or the playbook, head only, as a format example" | The template is the format (step 7) |
| "This hook follows a formula with no number, so it passes" | Every hook has all four rules, whichever formula it follows (`check.md`) |
| "I'll total the week's views and set them against the industry number I know" | KPIs come from `account-state kpi` at the roll-up, against the targets it prints, for the week it judges (`kpi.md`) |
| "KPI and what we sell don't fit the weekly template, so they go in the reply" | `## KPI` and `## Sales` are sections of the week's file. The bets are queue rows |
| "No sign-ups source, so 0 sign-ups" | `unavailable`, with its why. Never a 0 nobody measured (`kpi.md`) |
