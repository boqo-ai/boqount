# KPI: the account's week against its targets, what sold, and the next bets

The roll-up's KPI step (`memory.md` → The roll-up), the `week` mode, and the bets steps 7 and 8 plan first. A post's
verdict says how one post did against its type's norm (`measure.md`). A KPI says how the account did over a week,
stage by stage, down to the sale. The account's goal (`strategy.md` → The account's goal) is to be the account its
audience would follow if the product were not in it, so the brand is the name they hold when the need comes. Reach,
followers, sign-ups and buyers are measured in that order so the weakest step is known and worked on.

**Every KPI number comes from `account-state kpi`. None is summed, divided or compared by hand, no target comes from
memory, and an open week is never judged.**

Run it for each channel in `channels`; with one channel the flag may be left out. In every answer the reach and
follower figures are that channel's. The sign-ups, activation, buyers, the sales goal, the back-plan, the paths and the
spend are the whole account's (`salesScope: "account"`): report them once, never once per channel.

## The KPIs

Four stages in funnel order, each with one volume and the rates that feed it:

| Stage | Volume | Rates | Read from |
|---|---|---|---|
| reach | `views_week` | `views_per_post` | the ledger: each post at its newest view count |
| followers | `followers_gained_week` | `follows_per_1000_views` | `account.csv` |
| conversion | `signups_week` | `signups_per_1000_views`, `activation_pct_28d` | the campaigns reply (`signups_source`): only the campaigns the window's own posts carry |
| sales | `buyers_28d` | `buyer_pct_28d` | the same reply. A buyer is an account that paid anything |

The funnel is posts → views → sign-ups → activations → buyers. An activation is the first real use of the product
after a sign-up. A brand with no such step leaves `activated` empty, and `activation_pct_28d` reads `no-data`.

The `_28d` ones count the 28 days that end with the judged week. The rest count the judged week.

An organic post carries no campaign (`measure.md` → Attribution), and the tool counts sign-ups only under the campaigns
the window's own posts carry. A window with none reads the conversion and sales figures as the tool prints them,
blind (`no post in the window carries a campaign`), never 0. The account's sign-ups for that window are still read,
for the period, from the campaigns reply (What sold, below), and reported beside the KPIs, never inside one.

## Targets

The tool picks each KPI's target, in this order, and prints which one it took (`basis`):
1. `goal`: for `buyers_28d` only, the human's `sales_goal_28d` in `config.md`.
2. `standard`: the industry standard for accounts of our size and a product like ours. It is the KPI's row in
   `strategy.md`'s ` ```kpi ` block, which only `/boqount-research` writes, with its source, sample and date.
3. `own`: our own median of the weeks before, until a standard is sourced.

- **The sales goal is the human's,** asked at the first roll-up (`memory.md` → The roll-up), never on day one. From
  then, while `sales_goal_28d` is empty, `state.md` → Open questions carries one line, with the date first asked: "How many buyers in 28 days should the account bring?
  `/boqount config set sales_goal_28d <n>`". `config set` adds the key's line when the block lacks it. You never
  set a goal and never plan against one of your own.
- **No standards yet** (`standards.block` is `false`): the research trigger fires (`measure.md` → Learning 6,
  `research focus kpi`). Until its edition lands, targets are `own`.
- A target is the number the tool printed as `target`. You never read `strategy.md`, `research.md`, a research
  edition or the seed for one, and never bring one from memory or the web.

## The weekly read

It runs inside the roll-up, after the fold. `<from>` and `<to>` are the fold's printed `from` and `to`: the week that
ended.

1. The campaigns reply, from `signups_source`. Save it, whatever it says, as `.boqo-upload/campaigns.json`. It
   spans 70 days: a shorter reply is too short for the 28-day KPIs.
   - `manual`: `node <skill>/tools/account-state.mjs campaigns --days 70`, over `marketing/signups.csv` as it stands.
     A week with no sign-ups still gets a row (its last day, `0`): the file's newest date (the reply's `through`) is
     how far it is known. A week the file does not reach is `unavailable: not typed yet` (the tool leaves its sign-up,
     activation and buyer KPIs blind, `the sign-ups file ends <through>`), and the roll-up is written with that. The
     missing rows (date, campaign, sign-ups, activated, buyers) are asked for in the run's one request to the person,
     after the report (`measure.md` → Measurements, point 7); the next run's numbers include them. Nothing waits.
   - `command`: run `signups_command` and save its reply. It must have the shape of the `campaigns` reply, with
     `signups`, `activated` and `buyers` for every campaign.
   - `none`: save `{"unavailable":"no sign-ups source"}`. Every sign-up and sales figure is then
     `unavailable: no sign-ups source`, never 0.
2. Run the tool for each channel, then print it. An ad post (`ad: yes` in the ledger) is kept out of the reach and
   follower stages by the tool itself (`measure.md` → Bought views):

   ```bash
   node <skill>/tools/account-state.mjs kpi --channel <channel> --from <from> --to <to> --campaigns .boqo-upload/campaigns.json --now <now> > .boqo-upload/kpi-<channel>.json
   node -e 'const k=JSON.parse(require("fs").readFileSync(0,"utf8"));if(k.error)throw new Error(k.error);const f=x=>x===null?"-":x;console.log("judged",k.judged.week,k.judged.from,k.judged.to,JSON.stringify(k.judged.reads),"standards",JSON.stringify(k.standards));for(const r of k.kpis)console.log([r.stage,r.kpi,f(r.value),f(r.target),r.basis??"-",f(r.ratio),r.verdict,r.trend,"run "+r.belowRun,r.why??"",r.source??"",r.date??""].join(" | "));for(const n of ["constraint","blind","thin","interim","sales","backplan","salesScope","adPosts"])console.log(n,JSON.stringify(k[n]))' < .boqo-upload/kpi-<channel>.json
   ```

   Each KPI line is `stage | kpi | value | target | basis | ratio | verdict | trend | run | why | source | date`.
3. Read it as the tool means it:
   - **`judged` is the week before the one that ended.** Every post in it is 7 days old, so its windows have closed.
     Only it has verdicts. `interim` is the week that ended: values, and no verdict.
   - The verdict is `above`, `within` or `below` the target, by `config.md`'s `verdict_band`. `trend` is the same
     comparison against our own earlier weeks.
   - `no-data` always carries its `why`, one of three: **blind** (the value is `-`: it could not be read, and it is
     never written as 0), **thin** (the value stands, but a rate over fewer than its minimum is not judged), or no
     target.
   - `constraint` is the rate furthest below its target. `null` means no judged rate is below.
   - The account's figures are the same in every channel's answer: take them from one.
4. Write the bets to the queue (The bets, below).
5. The numbers then go to two places: the week's summary, which the roll-up's next step writes with its `## KPI`
   and `## Sales` (`templates/weekly.md`; `memory.md` → The summary's rules), and the `KPI:` and `Bets:` lines of
   this run's `state.md` (Report, below).

## What sold, to whom, and how

`## Sales` comes from the tool's `sales` (the 28 days to the judged week's end) and from the campaigns reply, and from
nothing else.
- **What:** `buyers`. A price is read at brand-book → Facts' source. Revenue is never estimated from a count.
- **To whom, and how:** `paths`, one line each, in the tool's order. A path is a **series or a product function** (the
  ledger's `rubric`) with the segment its posts aimed at: posts → views, and sign-ups → activations → buyers only where
  a campaign carried them. An organic post adds its posts and views to its path and no sign-ups of its own, so a path
  with no ad post reads `unavailable: organic, no link of its own` for those three, never 0. An ad post adds no
  posts or views to its path (`measure.md` → Bought views), and its campaign's sign-ups count there as any campaign's;
  its bought views stand on their own line beside the paths, from its record.
- **The account's sign-ups,** one line, for the 28 days, read three ways (`measure.md` → Attribution), reported as the
  account's and never as a path's: the profile link, by its tag's entry in the reply's `byCampaign` (the tool counts it
  in `otherCampaigns`), or in the untagged total (`untagged`); the campaigns an ad post or a DM rule carries; and the
  answers to "how did you hear about us?" (`unavailable: nobody has read the answers`, with the last reading and its
  date, when none). Say in the line that these are read for the period, not per post. Never move a number from this
  line into a path or a post.
- **Who the buyer is,** beyond the segment the post aimed at, is `unavailable: not in the sign-ups source`. It is never
  inferred from the post, the comments or the segment's name.
- **Not attributed:** `untagged` and `otherCampaigns`, reported apart (they are the account's line above).
  They are never added to a post, a path or a KPI.
- **No sign-ups source** (`signups_source: none`): the whole section reads `unavailable: no sign-ups source`.

### The month

At the first roll-up of each calendar month, `## Sales` also carries one line for the last 30 days, beside the weekly
KPIs (`templates/weekly.md`): the profile link's sign-ups (by its tag, or untagged), the campaigns, and the answers to
"how did you hear about us?" with their counts and the date they were read. Under `manual`: `node <skill>/tools/account-state.mjs campaigns --days 30`;
under `command`, the command's reply for 30 days; the figures are the account's, with the same `unavailable` rules.

## The bets

This is how the account sells more: every roll-up ends with **at most two bets** for the coming week. A bet is a row
in `queue.md` at `idea`, its `note` starting `bet: <kpi>`, with its type, rubric, kind, hook and hypothesis, and its
layer in `layer` like any other row (`production.md` → An idea from the human gives the row's shape).

1. **The constraint bet,** when `constraint` is not `null`:
   - **Reach or followers:** one post of the type that feeds the constraint's stage (reach → `reach`; followers →
     `awareness`), on a rubric that carries that type (step 7's strategy line) and for that rubric's own segment. Among
     several such rubrics, take the one highest in `paths`. Its one variable is chosen to move that KPI, and its
     expectation is a range in that KPI. It puts the post on that channel.
   - **Conversion or sales:** read for the whole account, it is not a film's to move: an organic post carries no
     sign-up of its own and asks for nothing. The bet is about the profile (the bio's words, the pinned posts) or about
     an ad post. A profile bet is the person's step: draft the words and say what to pin (`your steps`,
     `memory.md` → The morning report); it counts as one of the two and stands on the `Bets:` line as
     `profile (<kpi>)`. An ad post is a `sale` row only on the person's word that they will promote it (`Ad: yes`), and
     is never made as a film for the sake of the bet.
   - With several channels, take the constraint with the lowest `ratio` among the channels' answers (a conversion or
     sales constraint is the same in each: it counts once).
2. **The repeat:** the first path in `paths` that has a buyer, else an activation, else a sign-up, gets one more
   post: the same segment and rubric, one variable changed. Its KPI is `buyers_28d`: more buyers through the path that
   already converts. With no path that has a sign-up, there is no repeat.

- The two are one row when they name the same segment, rubric and type.
- A `bet:` row still in the queue counts toward the two: never more than two open.
- A `sale` bet waits like any sale post: only on a green funnel.
- Step 7 plans a `bet:` row before any other row of its type. Step 8's film for an empty day is the oldest open bet,
  before the calendar's hook.
- A bet is judged as its post. Its record's Hypothesis names the KPI; its verdict and the playbook's two-post rule
  (`measure.md` → Learning) do the rest.
- A profile bet is judged on the next roll-up's figure for its KPI, and on the profile link's sign-ups for the period
  against the period before (`unavailable` where either is). Its record is the log's line.
- When the constraint is `activation_pct_28d` or `buyer_pct_28d`, the step after the sign-up is the brand's own
  product (its first run, its price, its checkout). The bet still goes out, and a problem report is drafted with the
  KPI, its value, its target and the judged week (`posting.md` → Failures); it reaches GitHub only when `issues_repo`
  is set.

## Keeping to the targets

- A KPI `below` at two roll-ups running (`run 2`) and falling against our own weeks (`trend` is `down`) triggers the
  research (`measure.md` → Learning 6). Below but not falling, the bet is what works on it.
- With a goal set, the tool prints `backplan`: what the goal needs at the last 28 days' rates, in sign-ups, views and
  posts, against `capacityPosts` (all channels). `feasible: false` means more posts cannot reach the goal, so a rate
  must move: the Goal line says so and names the constraint.
- KPIs never stop a post, lift a limit or move the budget. Only the plan and the research follow them.

## Asked between roll-ups

A question about the KPIs, what sold, to whom, or what is tried next is answered from what the last roll-up wrote, with
its dates: `state.md`'s `KPI:` and `Bets:` lines, and the newest week's file above its Log
(`sed '/^## Log$/,$d' marketing/weekly/<week>.md`). The judged week does not change on a weekday, so the tool is not
re-run for a fresher verdict; `/boqount week` runs the roll-up again.

## Report

- **The week's file:** `## KPI` and `## Sales`, and so the tracker comment when `tracker` is set. Without a tracker the
  week's file is the record.
- **`state.md` → Today,** two lines whose values change only here. They are part of the run's one rewrite of
  `state.md` (`memory.md` → state.md, every run: today's date, the template's sections, at most 80 lines by `wc -l`),
  in `week` mode too. They are never a patch on yesterday's file:

  ```
  - KPI: judged <YYYY-Www>: <on>/<judged> on target; constraint: <kpi> at <ratio> | none; buyers_28d <n> (goal <goal> | no goal), <date> (account-state kpi)
  - Bets: <slug> (<kpi>), <slug> (<kpi>) | none, <date>
  ```

  A profile bet stands as `profile (<kpi>)` in place of a slug.

  `<on>` counts the verdicts `within` and `above`; `<judged>` counts every KPI but the `no-data` ones. The account's
  KPIs count once, each channel's reach and followers KPIs once for that channel.
- **The morning report,** on the roll-up's day: one Numbers item (`memory.md` → Numbers), and `your steps` names the
  sales goal while it is empty. The `week` reply has the same item (`memory.md` → The other reports).

## Red flags

| Thought | Reality |
|---|---|
| "4,212 views this week, 351 a post, so reach beats the 340 bar" | The week that ended is open, and its posts are of mixed age. The tool judges the week before it; the open week is `interim`, with no verdict |
| "340 views is the industry bar, from the seed research" / "I'll grep strategy.md for a benchmark" | A target is what the tool prints as `target`. No ` ```kpi ` row means `own`, and the research trigger |
| "No source for followers, conversion or sales, so no verdict there" | The target is then our own median (`own`). `no-data` only with the tool's `why` |
| "The weekly template has fixed sections; KPI and what we sell go in the reply" | `## KPI` and `## Sales` are sections of the week's file, so the week's record has them |
| "We sell to <the audience the brand book names>" | That is who we aim at. Who signed up and bought is `sales.paths`, with its numbers |
| "Next week: more reach, it beats its norm" | The bet goes to the constraint, the weakest step |
| "Five things to do next week" | At most two bets, each a queue row with `bet: <kpi>` |
| "1 sign-up and no activation: activation is 0%, the constraint" | Thin: the value stands, with no verdict, and is never the constraint |
| "No campaigns reply, so 0 sign-ups" / "No sign-ups source, so 0" | Blind: `no-data` with its why, never 0 |
| "The one payment came untagged; it is the account's sale" | Untagged is reported apart and never credited to a post or a path. It is the account's line |
| "The offer's post is the path with sign-ups" / "7 sign-ups came this week, so the series earned them" | An organic post adds posts and views to its path and no sign-ups. The profile link's sign-ups are the account's, in their own line |
| "Conversion is the constraint: a sale film" | Conversion is read for the account. The bet is the profile or an ad post, put to the person as their step |
| "Nobody answered 'how did you hear', so 0 answers" | `unavailable: nobody has read the answers`, with the last reading and its date |
| "A goal of 5 buyers makes the plan concrete" | The goal is the human's. One Open question, asked once |
| "The KPI is below, so three posts today" / "…so auto pauses" | KPIs move the plan and the research. The limits and the stops stay as they are |
