# <brand> content strategy

Edition: <YYYY-MM-DD> (`<mode>`). Before it: <the last edition | none>. Report: `marketing/research/<YYYY-MM-DD>/report.md`;
the table of contents is `marketing/research.md`. Brand facts come from `brand/<slug>/` (<v0 | v1, approved <date>>),
never from this file.

Every item carries its evidence line: a URL with a short quote and the date read, or our own data with its file and
date. An item with no evidence is not written. An item says which channel it is about when it differs by channel.
The sections below are these ten, in this order.

## The account's goal

Be the account <who the audience is> would follow if <the product> were not in it, so <the brand> is the name they
hold when the need comes. <One or two sentences more: what that means for this brand, in its audience's words.>
No organic post asks for anything; the call lives on the profile (`brand/<slug>/brand-book.md` → CTA). A post is
judged on its type's main metric against its norm. Sign-ups are read for a period, three ways, never per post
(Metrics and norms → Sign-ups). The direction is reviewed on <YYYY-MM-DD> (Metrics and norms → Review).
- Evidence: <brand-book → Positioning (its date)>; <the human's word on the direction, quoted, with its date>; <our
  data: file, numbers, date>

## Segments and offers

| Segment | Offer | Function | `fn` | Evidence |
|---|---|---|---|---|
| <who> | <what we offer them, with its price from brand-book → Facts> | <product function> | <fn> | <source, date> |

## Content pillars by type

One pillar per type: what a post of that type is about, for whom, in its layer (`<skill>/hooks.md` → The arc). The
layer suggests the type; the human picks the type at the gate.
- **reach** (`niche`): <the viewer's world with no product in it, as the series in Rubrics: what a film opens on,
  and how long it runs>. Evidence: <…>
- **awareness** (`product`): <the viewer's problem, with the product in the middle>. Evidence: <…>
- **trust** (`product`): <…>. Evidence: <…>
- **sale** (`offer`): <one real offer, said on its real date>. Evidence: <…>

## Rubrics

A rubric is a series (layer `niche`) or a product function (layers `product` and `offer`). The ledger's `rubric` is
its slug. No rubric has a code word or a link of its own: no organic post asks for anything (brand-book → CTA). Each
series' name, opening line and numbering are also in `brand/<slug>/style.md` → Language; a change goes into both.

| Rubric | Layer and type | What it is | Format | Fixed opening line | Episodes | Evidence |
|---|---|---|---|---|---|---|
| `<series-slug>` | niche, reach | The series "<name>": <what one episode is> | <chain explainer \| dated news \| data story \| the opening>, <length in s, from the research> | "<the line every episode opens on, with its slots>" | <how they are numbered, and where the number shows> | <…> |
| `<function-slug>` | product, awareness or trust; offer, sale | <the product function at work> | the arc (`<skill>/hooks.md` → The arc) | the film's own hook | — | <…> |

**The opening** is a series form: the first five parts of the product film's arc (`<skill>/hooks.md` → The arc) with
no product in them: a number about an event everyone knows, a second sourced fact, the gap, the people the gap makes,
and the opening for the viewer, which is its last line, never a product or a call. A length beyond `<skill>/hooks.md`
→ Length, and an episode in the form `the opening`, are proposals to the human in the report: the rubric is written
here as proposed, and an episode is built to it only on the human's word. A new series is judged after three
episodes, not one.

## Format catalog

| Format | Layer | Made as | Price | Evidence |
|---|---|---|---|---|
| <format> | <niche \| product \| offer> | <film \| clips \| file \| slideshow> | <$ and credits, hours> | <…> |

## Hook bank

Drafts for `<skill>/check.md`, each with its number proved on screen. No hook, and no line written after it, carries a
call or a code word.

| Hook | Layer | Type | Evidence |
|---|---|---|---|
| "<hook>" | <niche (<series>, episode <n>) \| product \| offer> | <type> | <the post or study it comes from: numbers, source, date> |

## Calendar

Twelve weeks from <the Monday>, <YYYY-MM-DD> to <YYYY-MM-DD>. Every week is dated and has a hook; every dated
moment names its source. An `offer` week stands on a real offer and its real date. An event everyone knows may carry
several `niche` films, each on a different number: one hit is one post in many.

| Week | Dates | Hook of the week | Layer | Type | Evidence |
|---|---|---|---|---|---|
| <YYYY-Www> | <MM-DD> to <MM-DD> | <hook; the moment and its date; the series and episode for a `niche` week> | <niche \| product \| offer> | <type> | <source of the moment, date> |

(12 rows)

## Mix

<reach <n>, awareness <n>, sale <n>, trust <n>> — <where it comes from: config `mix`, the start mix>. By layer:
`niche` <reach's share>, `product` <awareness and trust>, `offer` <sale's>. <What mix the research sets, with its
evidence, or: "The research sets no mix.">
<A change is proposed in the report as `config set mix …`, never written here as in force.>

## Metrics and norms

Main metrics: reach `views_72h`; awareness `follows_per_1000_views_7d`; trust `comments_7d`; sale `signups_7d`. Read
by `node <skill>/tools/account-state.mjs norms --channel <channel>` (run it for each channel in `channels`; with one
channel the flag may be left out): one row per type, `type | metric | value | source | date`, in its main metric
only. Every type a source gives a value for gets its row; a value derived from a sourced line (our own post, a study's
median) counts, with the arithmetic in its source cell. A row with no source is not written. One row per type and no
channel: the row holds the value for the account's first channel (the first in `channels`), its caveat names the
platform, and it is the starting norm on every channel until that channel has five posts of its own type.
- **A post's number is a type's value only when the post reached that type's audience**: reach and
  awareness, non-followers; trust, followers; sale, warm followers, the segment with the pain. Comments on a post seen
  mostly by non-followers are not trust's value.
- **No `sale` benchmark from a period's sign-ups over its posts:** an organic `sale` post has no figure of its own, so
  the `sale` row is absent and its one sentence below says so.
- **A row's date is the date the number was measured** (the screenshot, the ledger read, the study's date), not the
  day this edition read it.
- **The parser:** value a bare number (no comma, no ~); no `|` in the source; nothing after the date.

```benchmarks
<type> | <its main metric> | <number> | <source: who, sample, via which note or file and section> | <YYYY-MM-DD the number was measured>
```

<For each type with no sourced value, one sentence: "The research sets no <type> benchmark (`<metric>`); <type>'s
norm waits for 5 own posts.">

**KPI standards** (`<skill>/kpi.md`), read by `node <skill>/tools/account-state.mjs kpi --channel <channel>`: one row per
KPI a source gives a standard for, `kpi | value | source | date`. The KPIs are `views_week`, `views_per_post`,
`followers_gained_week`, `follows_per_1000_views`, `signups_week`, `signups_per_1000_views`, `activation_pct_28d`,
`buyers_28d` and `buyer_pct_28d`. One row per KPI and no channel: a reach or followers row holds the standard for the
account's first channel, its caveat names the platform, and it is the target on every channel; a sign-ups, activation
or buyers row is the whole account's. The benchmark rules above hold: a sourced value, or one derived from a sourced line
with the arithmetic in its source cell, for accounts of our size and a product like ours; the date the number was
measured; the parser's limits. A standard given as a share of followers or of views is turned into the
KPI's unit with our own current number, and the source cell shows that number, its file and its date. A row with no
source is not written. The block is written even when it holds no row: its presence says the standards were looked for.

```kpi
<kpi> | <number> | <source: who, sample, via which note or file and section; the arithmetic> | <YYYY-MM-DD the number was measured>
```

<For each KPI with no sourced standard, one sentence: "The research sets no <kpi> standard; its target is our own
median.">
<Caveats, per row: the platform its value is for; one post, a larger account or another age makes it a ceiling more
than a median. The row stays.>

### Per film

Beside the type's main metric, every film is read for: views at 72 hours (`views_72h`), sends per reach (`sends` /
`reach`), and follows per 1,000 views (`follows`). They compare films across layers and series; they set no norm.
<Each with what it is compared against, or: "no baseline yet".>

### Sign-ups

A sign-up is not tied to an organic post. It is read for a period, three ways (`<skill>/measure.md` → Attribution):
- **The profile link:** <the link, per channel (`brand/<slug>/accounts.md` → Links), and its tag when it has one;
  with none, its sign-ups stand in the untagged total>.
- **Campaigns:** <each campaign an ad post or a DM rule carries | none>.
- **"How did you hear about us?":** <where the answers come from: the human, or `unavailable` with the last reading
  and its date>.

Per month: the profile link's sign-ups and the answers. No number is moved to a post that did not carry its own link:
an organic `sale` post has no sign-up figure of its own, and its verdict says so, never 0.

### Review

Proposed in the research message; written here, and as `Review: <date>` in `marketing/state.md`, only on the human's
approval of the date and the stop rule. Until then: `proposed <date>, awaiting approval`. Only the human moves it.
- **Date:** <YYYY-MM-DD: <n> days from the human's approval of the direction>.
- **Compared:** <the per-film medians of the posts from <date>, against <the posts before it, named>>; <sign-ups a
  week in the review's last 28 days against <the period before>>.
- **Stop rule:** <for example: if the median of views at 72 hours is not higher and sign-ups a week are lower, the
  direction has failed on the account's own data>.
- **Limits, known now:** <the arms' sizes, missing reads, what differs between them besides the direction>.
- Evidence: <the human's approval, quoted, with its date>; <the baseline: file, numbers, date>

## What not to do

- No fake engagement in any form: no mutual likes, pods, view farms or bought metrics (cite the platform's rule and the law that applies, for example FTC 16 CFR 465 in the US).
- No false claim. No realistic AI without its label. No other person's face, name or channel without their written
  permission, and no leaked or pre-release material.
- No call in an organic post: nothing in the voice, on the picture or in the caption asks for a comment, a code
  word, a follow, a click or a visit, and no post ends on a logo or a link. The one exception is a post the human
  will promote with bought views, on their word for that post: it carries only the brand book's call line
  (brand-book → CTA).
- No product in a `niche` film: not in a line, on a frame or in the caption.
- No per-post link: a post's Link is the profile link, shown in no post; the ledger's `code_word` and `utm_campaign`
  stay empty, except on an ad post.
- No material that is not the brand's without the human's word for that source (brand-book → Do and don't).
- No batch posting to catch up on missed days.
- No sale post while the funnel is broken.
- No spend over the budget. No autonomous act missing from the report.
- No post goes out by a route the config's `publish_via` does not allow, "because it is faster".
- A post is a video file: no carousel posts.
- <Each track the user stopped (brand-book → Do and don't → Stopped tracks), with its date.>
- <Each theme that sells what brand-book → Positioning does not, with its source.>
- <Each thing the research found that loses reach or trust here, with its evidence.>
