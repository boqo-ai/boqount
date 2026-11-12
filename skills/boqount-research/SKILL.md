---
name: boqount-research
description: "Use when /boqount-research runs (launch, refresh or focus), when boqount finds a content type two weeks below its norm, a KPI with no sourced industry standard or its brand kit changed, or when the user asks to research or refresh a brand account's content strategy, its KPI benchmarks or its style."
argument-hint: "launch | refresh | focus <type or topic>"
---

# /boqount-research

## Overview

You research a brand account's content strategy, its KPI benchmarks and its style. `marketing/config.md` names the
brand's `slug`; every brand fact comes from `brand/<slug>/`.

`<skill>` below is the `boqount` skill's folder: `../boqount` from the folder this file is in. The account's
files (`marketing/`, `brand/`) are in the folder you were started in.

The research covers every channel in `channels`: platform mechanics are read for each one, and an item says which
channel it is about when it differs by channel. A command that takes `--channel <channel>` runs once for each channel
in `channels`; with one channel the flag may be left out.

**Every item carries its evidence: a URL with a short quote and the date read, or our own data with its file and
date. An item without evidence is not written.**

## When it runs

At launch; every `research_every_weeks` (config); a type two weeks below its norm; no KPI standards yet, or a KPI two
roll-ups below its target and falling (`<skill>/kpi.md`); a brand kit or product change; a platform change; the
human asks for the style.

**Not more than once in 7 days**, counted from the newest edition folder in `marketing/research/` (any mode),
unless the human asks.
- The human asks (types this command or asks in words): it runs now, in full. The days since the
  last edition are never a reason to wait or to do less.
- A handover from boqount or a timer is not the human asking: check the limit first. Inside it, stop and log
  `Next:` with the date the limit ends (`measure.md` → Learning).
- No mode given: `launch` when `marketing/research/` holds no edition, else `refresh`.

## Modes

| Mode | Directions (`directions.md`) | `strategy.md` | Also |
|---|---|---|---|
| `launch` | all seven | written whole | brand kit v1; the style (The style); `research.md` becomes the table of contents |
| `refresh` | 1–5, and 7 when the style's review asks (The style) | written whole | the report carries the diff; style changes are proposals |
| `focus <type or topic>` | the one that answers it (a `Ruling:` says why); `focus style` is 7 | only that type's or topic's items; none for `focus style` | the report carries the diff; `focus style` writes the style (The style) |

## The method

1. **The edition** is `marketing/research/<today>/`. The first edition starts from `seed_research` (config).
2. **The briefs.** One per direction, in `directions.md` → The brief's form. Dispatch them all as `general-purpose`
   agents in one message. A note returned as text, you write to its path. If you cannot dispatch (no agent tool, or
   the run bars it), then write each full brief where the dispatch would go, and do the author pass with what
   exists: the seed, our data and earlier notes, each cited.
3. **The author pass**, in this session, once every note (or brief) is in:
   1. `report.md` from `templates/report.md`.
   2. `marketing/strategy.md` from `templates/strategy.md`: its sections, in its order, an evidence line on every item.
      Its Review (`templates/strategy.md` → Review) is proposed, not written (The review, below).
   3. **The style**, when direction 7 ran (The style).
   4. **Norms:** after the ` ```benchmarks ` block, `node <skill>/tools/account-state.mjs norms --channel <channel> --now <now>`,
      for each channel. Each type's one row must come back on every channel as its `benchSource` (unless that
      channel's own norm, n ≥ 5, wins). Fix a dropped row.
      **KPI standards:** after the ` ```kpi ` block, `node <skill>/tools/account-state.mjs kpi --channel <channel> --from <the last
      Monday> --to <its Sunday> --now <now>`, for each channel: `standards.block` is `true` and `standards.rows` is the
      number of rows written (one per KPI, no channel: `templates/strategy.md` → Metrics and norms), the same on every
      channel. Fix a dropped row.
   5. **The diff** (refresh, focus): in a repository with `git_commit: on`, `git diff HEAD -- marketing/strategy.md`, pasted into the report
      as a ` ```diff ` block; outside one, the changed rows against the strategy you read before writing.
   6. **`marketing/research.md`**: the edition's row (`templates/research.md`).
   7. **`marketing/log.md`**: an entry from `<skill>/templates/log-entry.md`, a `Ruling:` for each thing
      left out and each judgement call.
   8. **Save** as `<skill>/SKILL.md` → Rules (Save, in full).
4. **The message to the user**, in their language: the answer, what changed, any mix proposal (information, not a
   question), the style directions or the style changes proposed, the review date and its stop rule proposed (launch,
   or a refresh that sets the direction), the approval request.

## The review

The review date and its stop rule are the human's. The launch (or a refresh that sets the direction) proposes them in
its message. Only on the human's approval, in whichever run it arrives (a day run writes the same): write them into `marketing/strategy.md` → Metrics and norms → Review, with
their approval as its evidence, and the line `Review: <date>` into `marketing/state.md` → Today
(`<skill>/templates/state.md`). Until then the Review section reads `proposed <date>, awaiting approval`, and the line
reads `Review: none`.

## Launch: brand kit v1

- Draft v1 into `marketing/research/<today>/brand-kit-v1/` from `templates/brand-book.md`, `assets.md` and
  `accounts.md`. `brand/<slug>/` stays v0 until approved. `state.md` → Open questions gets "brand kit v1 awaits
  approval: <path>".
- Every new or changed fact names its source; one without stays out. **Positioning is copied from v0 unchanged**; a
  change the research suggests is a proposal in the report.
- **The launch sends one message**: every change from v0 with its source, and the style directions (The style). It
  is the launch's only question until the human answers it; every other call is a `Ruling:`.
- Only the human approves. The approval triggers three things: copy v1 over `brand/<slug>/`, set the banner
  `v1, approved <date> by the human`, and Save as `brand: <slug> kit v1 approved`.

## The style

The style is found by the research and agreed with the human, never picked from a list or written from taste.

- **At `launch` and `focus style`**, the style note's two or three directions (`directions.md`, direction 7) go to the human
  in the one message, each with its idea in one sentence, how it differs from the niche's habit, its examples as
  links, what a post looks like in it on each channel, what it needs and costs, and its proposed tokens.
- **Taste is asked on the examples:** "Which of these, and what in it?", never in general words ("bold or
  minimal?"). The human may bring their own examples; read each like the note's (the link, what the frame shows, the
  date read) before it shapes anything.
- **The chosen direction, as the human shaped it,** becomes `brand/<slug>/style.md` from `templates/style.md`, with
  the banner `draft <date>, awaiting approval`. Every item names its source: the note's observation, or the human's
  words and their date. A font other than Inter goes in only with its files in `brand/<slug>/fonts/`. `state.md` →
  Open questions gets "style awaits approval: brand/<slug>/style.md".
- **Only the human approves**, as for the brand kit. The approval sets the banner `approved <date> by the human`, and
  Save as `brand: <slug> style approved`. Then, when the account has a film project (`films/project` exists),
  `node <skill>/tools/film.mjs theme`; an error names the token line to fix, and nothing is applied until it passes.
- **At a `refresh` the style is not rewritten.** The report's Style lists the Observations the day runs wrote into
  `style.md` since the last edition. Direction 7 runs when one of them goes against a rule above it, or the human asks
  for a style review: then the report proposes each change with the observations behind it, and the human approves
  each or not. An approved change is written into its section with its source, the banner's date moves, and
  `film.mjs theme` runs again when a token changed.

## The rules

- **A track the user stopped stays out until the user reopens it.** The stopped tracks are listed in
  `brand/<slug>/brand-book.md` → Do and don't. Out of the pillars, calendar, hook bank and formats; logged as a
  `Ruling:`; never asked about.
- A theme brand-book → Positioning does not sell is left out and logged, never parked as a question.
- **Benchmarks follow `templates/strategy.md` → Metrics and norms**: a sourced value, or one derived from a sourced
  line (our own post, a study's median), is the row. Its limits are its
  caveat, never a reason to leave it out. **A benchmark with no source is not written**: that type gets one sentence saying so.
- **No `sale` benchmark from a period's sign-ups over its posts:** an organic `sale` post has no figure of its own, so
  its benchmark row is absent and one sentence says so.
- **`focus kpi`** is direction 2's question 6, and `refresh` and `launch` answer it too. It writes the ` ```kpi `
  block and its sentences in `strategy.md` → Metrics and norms, under the benchmark rules. The sales goal is not a
  standard: it is the human's (`config.md` → `sales_goal_28d`), and no edition sets or proposes one.
- **The mix changes only with evidence, and only as a proposal**: a `config set mix …` line in the report.
  `config.md` is the human's. The strategy's Mix says what mix the research sets, "none" included. A proposal follows
  the layers: `niche` films are `reach`, `product` films `awareness` or `trust`, `offer` films `sale`
  (`<skill>/hooks.md` → The arc), so a layer's share is its types' share; most posts sit in `niche`, and an `offer`
  only on a real date. A share that rests on judgement, not a measure, says so.

## Red flags

| Thought | Reality |
|---|---|
| "I can read the seed myself, so I'll write the strategy by hand" | Every direction gets its brief, dispatched or written out. Then one author pass |
| "The seed's best window is a stopped track" / "only its name as news" / "I'll ask if it's allowed" | A stopped track stays out: no hook, no row, no question |
| "One post, or a bigger account's sample, is not a norm, so no row" | A sourced value is the row; its limits are its caveat |
| "trust `comments_7d`: the median of the comments on two posts non-followers mostly saw" | Not trust's audience, so not trust's value |
| "No study covers an account of our size, so the kpi block stays out" | A sourced standard is the row and its limits are its caveat; with none, the block is still written, empty, with one sentence per KPI |
| "No focus yet this calendar week" | The 7 days count from the newest edition, any mode |
| "The human asked, but the last edition is days old" | The ask runs now, in full |
| "The human said X works, so the brief asks for the proof" | A claim goes under Claims to test, with what would count for and against it. Handed as a fact, it comes back confirmed |
| "The first style direction looks right: I'll write `style.md` from it" | Two or three directions go to the human with their examples; the one they pick and shape is written, as a draft |
| "I'll ask whether they like it bold or minimal" | Taste is asked on examples: "Which of these, and what in it?" |
