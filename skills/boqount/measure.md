# Measuring, learning and attribution

SKILL.md steps 4 (the funnel), 5 (measurements) and 6 (learning), and the `screens` mode. Every number written here
carries its source, its read time and its real age. A number without them is not used.

A per-channel command below is written with `--channel <channel>`: run it for each channel in `channels`; with one
channel the flag may be left out.

## Rows

The ledger is never read whole. A post's rows (one per channel) with the header:

```bash
awk -F, -v s="<slug>" 'NR==1 || $1==s' marketing/ledger.csv
```

The posted rows: `awk -F, 'NR>1 && $3=="posted" {print $1, $2}' marketing/ledger.csv`. Edit a row by column name, one
row per slug and channel (`posting.md` → Records), then run `node <skill>/tools/account-state.mjs mode` to catch a
broken row. A record is `marketing/publications/<date>-<slug>.md`. Write the record's row and the ledger's row together,
and save before the next outward call (SKILL.md → Save, locally).

## The funnel (step 4)

1. **The links.**
   - The profile link (`brand/<slug>/accounts.md` → Links): it carries every sign-up of a `niche` post, and no post has
     a link of its own (Attribution, below).
   - Each code word's link in `brand/<slug>/accounts.md` → DM automation: the `product` and `offer` films send people
     to them.
   - An ad post's own link (its record's `Ad call` line) while its ad runs, until the person says it ended. The
     record's `Link` is always the profile link.
   - With none of these (day one: no profile link yet), `funnel-check` is not run, since with no link it exits 1: the
     funnel is yellow, `no link`.
2. **The check.** `node <skill>/tools/funnel-check.mjs --must-have "<link_must_have>" --must-not-have "<link_must_not_have>" <url>…`,
   the texts from `config.md`; leave a flag out when its key is empty. It prints one JSON line. Gate on its
   `"verdict"` field, never on the exit code: every verdict exits 0. Exit 1 is a tool error, and the funnel is then
   yellow ("funnel-check failed"). Save the reply as `.boqo-upload/funnel.json`, and print every link before you write
   a word about them:

   ```bash
   node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(r.verdict,r.readAt);for(const l of r.links)console.log(l.state,l.error??"",l.url)' < .boqo-upload/funnel.json
   ```

   Each link's `state` is `open`, `blocked` (the way in is closed), `changed` (the page lacks a `link_must_have` text
   and shows no `link_must_not_have` one) or `unread` (a hop failed). Name each `blocked` link by what it is (the profile
   link, a DM rule, an ad post). Count them: "1 of 6", never "all" unless every line says so.
3. **boqo's MCP**, for each boqo channel (`posting.md` → How a post goes out), answers and the channel's account is
   `active` (`list_accounts`). If not, the funnel is yellow, and `posting.md` → Failures gives the alarm.
4. **Sign-ups** (the account's, every campaign and the untagged) for the two days before today, by `signups_source`:
   - `manual`: `node <skill>/tools/account-state.mjs campaigns --days 3`, read from its `byDay`;
   - `command`: run `signups_command`, save its reply as `.boqo-upload/campaigns.json`, and read its `byDay`;
   - `none`, or a reply with `unavailable`: the point is `unavailable: <why>`, never 0 sign-ups.

   A date with no key is 0, except under `manual` when it is after the file's newest date (the reply's `through`):
   then it is `unavailable: not typed yet`. **Zero on both days is yellow only when those days' posts had views**
   (step 5's read: views > 0 on any channel); with no views, zero sign-ups says nothing, and an `unavailable` point
   never sets the colour (a blind source is not a zero). This point is settled after step 5's read, and the colour
   with it.
5. **The DM review** (does your DM automation still send the right link?) is the human's item, once a week, on
   Monday's list, with each code word's row: the product films ask for those comments. A code word the person answers
   by hand is their item too: "are the <CODE> comments answered?"
6. **The colour** is the links' state and, for a boqo channel, its account being active.
   - **green**: the verdict is `green`, boqo answers for every boqo channel, and nothing is yellow. A `sale` post goes
     out only on green.
   - **yellow**: a `changed` or `unread` link, no link, a tool error, boqo down or a boqo channel's account not
     `active`, or zero sign-ups as in point 4. Sale posts wait at their status, unposted today. Other types go on.
     Zero sign-ups against live views also raises an alarm: the way from a view to a sign-up may be broken somewhere
     the links do not show. Any other yellow is on the Funnel line, with an alarm only where its own rule gives one
     (`posting.md` → Failures).
   - **red**: any link is `blocked`.

**Red.** A `blocked` link, whichever it is, holds every `sale` post, on every channel, whatever its status (a `handed`
one only on the person's word, below). Other types go on. The report's Alarms line names the red link.
- `planned`, `checked`, `approved`: the record and ledger row become `held`, with `check: caught:funnel` and the red
  link in `note`; the queue row is `held`.
- `handed`: it stays `handed`, and the Alarms line asks the person not to publish it. On their word that it is not
  out, write `held`, with `canceled: by hand (funnel red <date>)` in `note`; a link instead makes it `posted`
  (`posting.md` → By hand). The same rule as at a stop (`auto.md` → The stops).
- `uploading`, `uploaded`: the same, and it stops before `post_video`.
- `scheduled`, or `post_requested` with a `card_id`: the post is already in boqo's queue, so a label alone would let it
  go out. Take its post id (`boqo_post_id`, or its match in the start read, `posting.md` → Reconcile). By `posting.md` → A
  canceled post: write `held` with
  `canceled: <postId> (funnel red <date>)` in `note` and save (Save, locally), then call `cancel_post {postId}`. It is
  free and undoable for 10 minutes, and protective, so it needs no approval. Log it under Auto and name it in the
  report. Cancel only the sale posts.

A held post keeps its Publish. When a later check is green, it returns to `approved` (or, when its boqo project
exists, to `uploaded`, with `card_id` and `boqo_post_id` cleared: `posting.md` → A canceled post, the same path a stop's
recall takes) and takes the next free slot; one held from `handed` gets a new hand-over message. A record with a
`boqo_project_id` never calls `create_upload` again.

A `blocked` link means the way in is closed, whichever it is.
- **The link is in the form `brand/<slug>/accounts.md` → Links gives**: the fault is the site's. When `state.md` →
  Funnel was not already red for that link, draft a problem report (`posting.md` → Failures): the link, the hops, the
  state, the read time, and the posts held. With `issues_repo` set, search first, so it is never filed twice; with it
  empty, no `gh` call at all, a search included. Change no link and no field of
  your DM automation.
- **The link is not in that form**: that link is off-form. Rewrite a record's Link to the profile link, and name an
  off-form DM rule link or profile link as the person's step (the bio's words and link, and a DM rule, are theirs to
  edit; a changed rule needs re-confirmation, Attribution below). Still report the closed way in as above.

Write the colour, its time and the red links to `state.md` → Funnel.

## Measurements (step 5)

1. **Read,** for each channel.
   - **A boqo channel** (any channel `posting.md` → Start reads boqo for): `get_analytics {period: 7, accountId}`,
     then `get_analytics {period: 30, accountId}`, with the channel's `account_id`. Unwrap and unescape each
     `top[].title` (`posting.md` → Start, "Read it as rows"). The call time is the read time. Append the follower
     snapshot to `account.csv`:
     `<date>,<channel>,<read_at ISO>,<followers>,<gainedWeek>,get_analytics`.
   - **A by-hand channel:** its numbers come from the person (Screens below). A follower count they give goes into
     `account.csv` the same way, with its source.

   Then, once for the account:
   - the sign-ups by `signups_source` (The funnel, point 4), over 30 days (or back to the oldest post whose `+28 d` is
     still open): `node <skill>/tools/account-state.mjs campaigns --days 30` under `manual`. Then settle the funnel's
     point 4;
   - `node <skill>/tools/account-state.mjs due --now <now>`: every channel's checkpoints, each with its `channel`.
2. **Stale analytics.** A boqo channel's readings are **stale** when either of these holds:
   - the newest `top[].postedAt` is more than 48 h older than the newest `posted_at` in the channel's boqo-posted rows
     (an empty `top` with such rows counts as older);
   - the numbers are identical to the previous read's: the same followers and `gainedWeek` as the channel's last
     `account.csv` row from an earlier day, and the same views for every post as its record last wrote.

   Write the result to `state.md` → Today, one line per boqo channel,
   `Analytics (<channel>): stale|fresh, <date> (get_analytics)`: the switch to auto reads it (`auto.md`), and in auto
   a stale line means the reach stop cannot fire, which the alarm says.
   A sync can freeze with no error. It can mean a dead platform token while boqo still says `active`, so a stale
   channel also gets the alarm "may need reconnecting in boqo → Accounts", which only the human does. Stale readings
   are still written. Every checkpoint from them is `data: partial`, with the source `stale get_analytics <readAt>`.
   The report carries an alarm. A problem report is drafted (`posting.md` → Failures); with `issues_repo` set it is
   searched first with "analytics stale" so it is never filed twice, and with it empty no `gh` call is made at all.
3. **The join** (a boqo channel). A post's views and likes are the `top` row of that channel's read whose unwrapped
   title equals the row's upload name without `.mp4`. When none does, use the row whose `permalink` equals the row's.
   With neither, the checkpoint is `unavailable: not in get_analytics top`. The 30-day read covers posts up to 30 days
   old; older posts are not read from `top`.
   - `top` holds at most 20 rows, ranked by views, and `accountId` narrows it to the account. From about week 3 a
     low-view post can fall out before its `+7 d`. Its checkpoint is then `unavailable`, and a main metric lost this way
     gets the verdict `no-data`, by the late rule's path: no value, and nothing in the norms.
   - A post under 48 h old that reads 0 is `unavailable: vendor lag`, never a 0: the vendor's first non-zero reading
     arrives about a day after posting, and boqo re-reads a fresh post every six hours.
4. **Write each due checkpoint at its real age.** `due` lists every unread checkpoint with `ageHours` and `late`. Per
   post and channel:
   - Today's read fills the **newest** due row, with Read at (the read time), Age (`ageHours`, also in days), the numbers
     and Source.
   - An older due row that this read cannot be is marked `unavailable: read late at <age>`.
   - A late number is never written into an earlier checkpoint's column.
   - The ledger columns follow the row read. `+24h` → `views_24h`/`likes_24h`; `+72h` → `views_72h`/`likes_72h`;
     `+7d` → `views_7d`/`likes_7d`, plus `signups_7d`, `activated_7d`, `buyers_7d`; `+28d` → `signups_28d`,
     `buyers_28d`. Put the age in `note` when the read was late. The late rule below is the one exception.

   **The late rule.** Each type's main metric has a windowed column: reach `views_72h`; awareness `views_7d`; trust
   `comments_7d`; sale `signups_7d`, `activated_7d` and `buyers_7d`, then `signups_28d` and `buyers_28d`. When the
   read for that window is `late` (more than 24 h past it), the windowed column stays empty. The value read goes into
   the checkpoint row's Source and the ledger's `note`. The verdict is `no-data`, "the <window> value is gone (first
   read at <age>)", and the value never enters norms. A 13-day number is not a 72 h number, and comparing it with a
   72 h norm would read every late post as `above`. Writing the verdict (`verdict_at`) closes that window for `due`.
5. **Sale posts.**
   - **An `offer` post** carries its rubric's code word, whose campaign every post of that rubric shares (Attribution,
     below), so it has no sign-up figure of its own either: as for an organic post, below, with `unavailable: organic,
     the rubric's campaign` and the rubric's figure for the period beside it.
   - **An organic post** (not `Ad: yes`) has no link of its own (Attribution, below), so it has no sign-up figure of its
     own: its `signups_7d`, `activated_7d`, `buyers_7d`, `signups_28d` and `buyers_28d` are
     `unavailable: organic, no link of its own`, never 0, and its verdict says so. What the offer's days brought is read
     for the period (Attribution) and reported beside the post, never in it. No number is moved to a post that did not
     carry its own link.
   - **A post marked `Ad: yes`** reads its own campaign: its record's `Ad call` line names it (`utm_campaign`), and
     that key in `byCampaign` gives `signups`, `activated` and `buyers`. Never a total, a day count, the untagged `-` bucket
     or another post's campaign. A post on two channels carries one campaign: both rows get its
     figures, and it counts once (Attribution). With `signups_source: none` they are
     `unavailable: no sign-ups source`, never 0. Under `manual`, a `signups_7d` … `buyers_28d` checkpoint whose window
     runs past the file's newest date (the reply's `through`) is `unavailable: not typed yet`.
6. **Trust comments** come from the public post page read logged out, or from a screenshot. No count is
   `unavailable: no comment count (not in get_analytics; <page shows none | page not read>; no screenshot)`.
   Never 0 and never a guess.
7. **The request to the person**: one per run, in its own block after the report (`memory.md` → The blocks); Waits
   for you only names it. It does not wait: the day goes on.

   ```
   Screenshots or numbers, when you can (no answer needed now). The post's insights on each platform
   (Instagram: the Reel → View insights → Overview, Interactions, Retention, Audience), for:
   - <slug> on <channel> ("<caption line 1>", posted <date>): <checkpoint>
   Monday: also each channel's follower insights (with its most active times) and its account status (are
   recommendations restricted?); the rows marketing/signups.csv is missing, from the day after its newest date; the
   answers to "how did you hear about us?" since the last reading, with the count by answer.
   Put them in marketing/evidence/<slug>/ (or send them, or type the numbers), then run /boqount screens.
   ```

   One line per post and channel with a checkpoint due today that no tool read in full: one read today without a
   screenshot, or any due checkpoint of a by-hand channel. Add the lines still owed from an earlier request. Nine
   such checkpoints today is nine lines. An owed line expires after the post's `+28 d` checkpoint. The sign-ups rows
   are on Monday's line only under `signups_source: manual`; the "how did you hear" answers are on it whatever the
   source. Log it under Asked. Nothing waits for the rows: the roll-up reads `marketing/signups.csv` as it stands, and
   the next run's numbers include what the person typed (`kpi.md` → The weekly read).

### The platform's copy

Once per film and channel, at its first checkpoint after it posted: the platform re-encodes every upload, and a fault
it adds (a doubled first frame, picture behind the sound, a length padded past the film's end, which breaks a loop)
is in its copy only. `node <skill>/tools/platform-copy.mjs <the post's link, or the saved copy> --ours
films/<slug>/out/<slug>-feed.mp4 --mix films/<slug>/audio/mix.wav` (yt-dlp downloads the account's own post when it is
installed; otherwise the person saves the post's video once, or the line is `not measured: no copy`). Its three lines
go into the record under Checks with the date. A fail is a `Learning:` line naming the fault and what the next export
changes (`film.md` → The project → The file), never a re-upload of a post already out without the person's word.

## Screens (`/boqount screens`)

Screenshots arrive in `marketing/evidence/<slug>/`, one file per screen and channel, from the human or the chat; typed
figures arrive in the chat. For each:
1. **The taken time** comes from the image (the status bar, or the file's own time), and the human's word wins. Age =
   taken time − `posted_at`.
2. **The row.** It fills that channel's checkpoint row that was newest due at its taken time: 4.5 d → `+72 h`,
   14.5 d → `+7 d`. Each number's Source is `screenshot marketing/evidence/<slug>/<screen>.png` (or `typed by the
   person`), with the taken time and its age, never the run's time. An empty row takes the taken time as Read at and
   that age as Age. A row already filled by `get_analytics` keeps its Read at, views and likes, and gains the
   screenshot's other numbers. On a by-hand channel the person's views and likes are the read.
3. **The ledger.** `follows` (with `follows_source: counted`), `sends` (Shares), `saves`, `reach` (Accounts reached,
   which Instagram now shows as Viewers: the cell's Source says `(viewers)`), `skip_3s` (Skip rate, as the screen gives
   it, with its "lower/higher than typical" word in `note`), `visits` (Profile activity) hold the newest screenshot's
   values, with `screenshot <age>` in `note`. Bio-link taps on a screen go into the record's row Source, never into
   the ledger's `clicks` (that column is your DM automation's). The names in brackets are Instagram's, read in
   whatever language the phone shows them; another platform's screen gives its own figure of the same meaning.
   `comments_7d` is written only from a screenshot taken at 7 d or later. An earlier count stays in the record's row.
4. **Then** run Learning's verdict (a screenshot can move `data` to `full`), the screenshot norms and the playbook check
   for the posts it touched. Save, and report what each screenshot changed.
5. **Account status** (the Monday account screens): rewrite the channel's line in `state.md` → Today,
   `Account status (<channel>): restricted|ok, <date> (<screen>)`, `restricted` when it says recommendations are
   restricted, else `ok`, with the taken date. It feeds the stops (`auto.md`).

## Learning (step 6)

1. **Verdicts**, when a post's window has passed: reach at 72 h; awareness and trust at 7 d; sale at 7 d (`signups_7d`)
   and again at 28 d (`buyers_28d`). `node <skill>/tools/account-state.mjs verdict <slug> --channel <channel> --now <now>`
   gives `above`, `within`, `below` or `no-data` against the type's norm on that channel (the band in `config.md`).
   Write `verdict`, `verdict_at` and `data` into the channel's ledger row, and one line under the record's Verdict,
   with the channel, the value, the norm, its n and source, and the reason for a `no-data`. An `Ad: yes` post gets no
   verdict (Bought views).
   - **`data`**: `full` only when the post has a screenshot for that checkpoint; otherwise `data: partial`, whatever the
     tool prints (it knows only estimates), and always `partial` for stale readings or an estimate.
   - **An organic `sale` post** prints `no-data`, because its main metric is empty (Measurements 5). That is the
     expected answer, not a fault. The line under Verdict says "organic, no link of its own: the period's sign-ups are
     read beside it (Attribution)", and the report writes the same. Never 0, never a verdict from the period's total.
   - **Per film, read where the numbers exist and `unavailable` where a channel does not give them:** views at 72
     hours (`views_72h`); sends per reach (the ledger's `sends` over `reach`, when both were read, from a screenshot or
     the person's figures); follows per 1,000 views (`followers`, point 2). Write them in the record and the week's
     table, each with its source and age. No figure is estimated from another.
2. **Awareness follows without a screenshot** are an **estimate**. After the row's `views_7d` is written, run
   `node <skill>/tools/account-state.mjs followers <slug> --channel <channel>`: the channel's follower gain in the 48 h
   after the post. Write `follows` = the gain and `follows_source: estimate`, and say "estimate" in the record and the
   report. Any other post on that channel inside those 48 h shares the gain: say so. Never `gainedWeek`. With
   `views_7d` empty under the late rule, the gain is still written, and the verdict is `no-data`.
3. **Norms**: `node <skill>/tools/account-state.mjs norms --channel <channel> --now <now>` (ad posts are left out:
   Bought views). A type's norm on a channel is
   its own median once 5 posts are ready, else the research benchmark, cited with its `benchSource` and `benchDate`.
   Report the human-typed and skill-typed posts apart (`bySource`). Rewrite `state.md` → Norms, per channel.
   - **Screenshot-only norms** (sends, saves, reach, skip 3 s, visits, counted follows), per type and channel, are the
     median over the posts of that type **that have a screenshot**. State n. Posts without one are left out, never
     counted as 0.
4. **The playbook** (`marketing/playbook.md`, read here only). Rules learned about making posts accumulate here. A rule
   enters when **two posts** show it. They share the variable (their records' Hypothesis), and each moves the metric
   the rule names the same way against its baseline: the type's norm, or the screen's own baseline (Instagram's
   "Typical skip rate"). The rule's evidence is that metric. A verdict on another metric is not needed. One row:
   - Rule: the variable and its effect;
   - Evidence: the count (2), the posts, their channels and their numbers;
   - Since: today;
   - Recheck: today + 30 d, or after 10 more posts of its type, whichever comes first.

   A rule that a recheck contradicts is struck through with the date and the numbers.

   What is learned about the look or the language (a device that held attention, a phrasing that did not, a caption
   form), from the numbers or from the person's Edit (`gate.md` → After the answer), is not a playbook rule: it goes to
   `brand/<slug>/style.md` → Observations as a dated observation, with the posts and numbers (or the Edit) that show
   it, under an `## Observations` heading at the file's end (made when missing). Never an edit to the style's own
   sections: those change only on a research refresh the person approves.
5. **The week,** when `memory.md` → The roll-up says it is due:
   - The roll-up (`memory.md`), and inside it the week's KPIs, what sold and the bets (`kpi.md`).
   - The weekly shift of the mix toward the types that beat their norm: proposed to the human as a
     `config set mix …` line, never written into `config.md` by you.
6. **The research trigger**, every run, not only Monday:
   - A type under its norm two weeks running triggers `research focus <type>`; the newest edition in
     `marketing/research/` being `research_every_weeks` old triggers `research refresh`; a changed fact in
     `brand/<slug>/brand-book.md`, `assets.md` or `accounts.md` since the newest edition (in their Facts, Claims, Legal,
     CTA, Segments, Material and Links sections) triggers `research refresh`. Never a new Observation, a recorded word
     for a source, a date line or the approval copy. In a git repository with `git_commit: on`:
     `git log -p --since <its date> --invert-grep --grep 'kit v1 approved' -- brand/<slug>/brand-book.md brand/<slug>/assets.md brand/<slug>/accounts.md`,
     each changed line judged by the section it is in; otherwise, one of the three files newer than the edition's folder
     (`find brand/<slug> -name '*.md' -newer marketing/research/<edition>`), unless the log since the edition names
     every change to it as none of those facts.
   - **The KPIs,** checked at the roll-up, where the tool runs (`kpi.md`): a KPI `below` at two roll-ups running
     (`run 2`) whose trend is `down` triggers `research focus <type>`, the type that feeds its stage (reach →
     `reach`; followers → `awareness`; conversion and sales → `sale`); no ` ```kpi ` block in `strategy.md`
     (`standards.block` is `false`) triggers `research focus kpi`.
   - **The weekly limit:** research runs at most once in 7 days from the newest edition's folder date, unless the
     human asks. Inside the limit the run is dated that edition + 7 days.
   - **Several due on one day merge into one edition:** a refresh when any trigger is a refresh; else one focus, and
     the other focuses are re-dated + 7 days and logged.
   - Due only outside the limit (7 days or more since the newest edition): hand it to
     `/boqount-research focus <type>` (or `refresh`), or name it "not built" when that skill is absent. Dated later: log
     `Next: research focus <type> <date> — the 7-day limit (last edition <date>)` once (a run that finds it in the
     log carries it), and the report's Plan line names it with its date.
7. **The review,** every run, from `state.md` → Today's `Review:` line (the research skill writes it when the person
   approves the date; when that approval arrives in a day run, the day run writes the line and the strategy's Review
   section, as `/boqount-research` would). On or after that date, read the rule, the one extra read of `marketing/strategy.md`:
   `awk '/^### Review/{p=1;next} /^##/{p=0} p' marketing/strategy.md`. For each figure the rule compares, name its
   command: `node <skill>/tools/account-state.mjs norms --channel <channel>` for the medians; the
   campaigns reply's `byDay` (The funnel, point 4) for sign-ups a week. Each figure carries its
   source and read time, and one that is `unavailable` stays so. Put the result to the person: the rule, the numbers,
   whether the rule holds. The run never changes the direction, the strategy or the mix. Log
   `Asked: review of <date>` once, and carry the question in `state.md` → Open questions until the person answers; their
   answer is a `Ruling:` line. With `Review: none`, nothing runs and nothing is reported.

## Bought views

An `Ad: yes` post's views are bought. When its record is marked `Ad: yes`, each of its ledger rows gets `ad: yes`; the
tools then keep it out on their own: of every type's norm (`norms`, and the norm a `verdict` is judged against), of the
reach-drop run in `stops` (its check catches still count), and of the reach and follower stages of `kpi`. `verdict`
gives it `no-data`, "an ad post: its views are bought". Its row is read like any other (Measurements), and the sign-ups
under its campaign count in the conversion and sales stages. The report lists the ad's own numbers from its record, on
their own line, labelled bought; `kpi`'s `adPosts` says how many the judged week held. The follower readings
(`account.csv`) are the account's, so a week's follower gain cannot tell an ad's followers apart: say so beside it
when `adPosts` is above 0.

## Attribution

No organic post carries a link of its own (`brand/<slug>/brand-book.md` → CTA), so **a sign-up is not tied to an
organic post.** A `product` or `offer` film asks for a comment with its rubric's code word; the campaign behind that
word is the rubric's own fixed one (`<rubric>`), shared by every post of the rubric, so a sign-up through it is tied to
a rubric and a period, never to one post. It is read for a period, three ways, never per post:
- **The profile link** (`brand/<slug>/accounts.md` → Links; the bio's words and its link are the person's to edit).
  When the link carries a tag, its sign-ups are read by that tag, from its entry in the campaigns reply's `byCampaign`
  (`signups_source`, The funnel point 4). Otherwise they stand in the untagged total (`-`), which is the profile link's
  and everything else's that carries no campaign: say so.
- **Each code word's campaign, and any campaign an ad post carries:** each campaign's entry in `byCampaign`. The
  rules in your DM automation (or your own replies, by hand) answer anyone who comments, whether a post asked or not.
- **The answers to "how did you hear about us?":** only the person can give them. Ask with the weekly sign-ups rows
  (Measurements 7), write the count by answer and its date into the week's `## Sales`, and in the log under Did. With no
  answer given since: `unavailable: nobody has read the answers`, with the last reading and its date beside it.

A `niche` record's `Link` is the profile link, and its ledger `code_word` and `utm_campaign` stay empty. A `product`
or `offer` record carries its rubric's code word, that code's link and the rubric's campaign. Only a `niche` post
marked `Ad: yes` has its own campaign and reads per post (Measurements 5). No number is ever moved to a post that did
not carry its own link: not the period's total, not the untagged bucket, not a campaign's.
- **An ad post's campaign** is `<rubric>-<YYYYMMDD>`, the post's rubric and date. It and the ad's own link are in the
  record's `Ad call` line; the link's form is `brand/<slug>/accounts.md` → Links. One rule in your DM automation per rubric (one code word) sends the link
  of the rubric's **newest** ad post, so a sign-up under `<rubric>-<date>` is credited to that post.
- **Your DM automation** (the person's own tool; ManyChat, for example). Nothing is repointed per post: the rules stay
  as they are, for anyone who comments and for ad posts. Only when an ad post reaches `scheduled` or `handed`, ask the
  human to point its rubric's rule at the post's link and text; no post waits for that, since only the campaign's date
  moves. If `brand/<slug>/accounts.md` records that buttons take a fixed link, attribution is per rubric only. The
  confirmation is the code word's row in `brand/<slug>/accounts.md` → DM automation (`check.md` item 3), once per code
  word: `funnel-check` tests a link, not what the automation sends. Changing a rule's link (its form, its path, its
  rubric) needs re-confirmation: empty the row's `confirmed` cell.
- **Whole-account figures.** Sign-ups, activations and buyers are the account's, not a channel's. A post on two
  channels carries one campaign, and that campaign counts once. Say so wherever they are reported.
- **Clicks and sends** come only from your DM automation's own screens (statistics, screenshots). They are never
  derived from sign-ups.

## Report

Each part goes into its slot of the morning report (`memory.md`).
- **Numbers**: followers per channel, the verdicts with `data`, the estimates marked, the per-film measures, an ad
  post's bought views on their own line (Bought views), and the period's sign-ups by Attribution's three reads (an ad
  post: its own campaign count), the whole account's, every one with its source and read time.
- **Funnel**: the colour and the red links.
- **Alarms**: a red funnel, zero sign-ups against live views (The funnel, point 4), stale analytics.
- **Auto**: each `cancel_post`.
- **Waits for you**, its `your steps` part: the request; on Monday the DM review and the account screens; the review's
  decision while it is open (Learning 7).
- **Plan**: a triggered research run, with its mode and date; the review's result, once, the run it is read.

## Red flags

| Thought | Reality |
|---|---|
| "measure.md is not built, so no verdicts" / "I'll read the screenshots by hand" | It is built. Run every step here |
| "All 6 links are blocked" | Print `state` per link and count. Name each red one |
| "The cause is unknown: the site or the tool" | A `blocked` link means the way in is closed. Draft the problem report with the hops; a doubt goes in the report, not in place of it |
| "The profile link is green, so the sale can go" | Any red link holds every sale post, an ad post's and a DM rule's included |
| "The offer ran this week and sign-ups rose: credit the sale post" / "0 sign-ups for the sale post" | An organic post has no link of its own: `unavailable: organic, no link of its own`, and its verdict is `no-data`, the expected answer. The period's sign-ups are reported beside it |
| "The profile link's tag is a post's campaign" | The profile link is read for the period, as the account's. It is never a post's or a path's |
| "Nobody answered 'how did you hear', so 0 from it" / "last time it was 13" | `unavailable: nobody has read the answers`, with the last reading and its date |
| "The DM rule should follow the newest post" | Nothing is repointed per post. Only an ad post's rule is |
| "The stop rule has fired, so I'll change the direction" | The run puts the rule and the numbers to the person. It never changes the direction itself |
| "This look finding is a playbook rule" / "I'll fix the style's rule" | A dated observation in `style.md`. Its rules change only on an approved research refresh |
| "It is already scheduled in boqo; I'll mark it held" | A label does not stop boqo. `cancel_post` it, after writing `held` |
| "Yellow is not red, so the sale can go" | A sale post goes out only on green |
| "No sign-ups source, so 0 sign-ups" | `unavailable`, with its why. Never a 0 nobody measured |
| "A 13-day view count fills `views_72h`" | A late main metric leaves its windowed column empty. The verdict is `no-data` |
| "No comment count, so 0" | `unavailable`, and trust is `no-data` with the reason |
| "The tool says `data: full`" | Without a screenshot it is `data: partial` |
| "Screenshots later: I'll ask again at each post" | One request per run, naming posts, channels and screens. Don't wait |
| "Only this week's posts need screenshots" | One line per post and channel due today that no tool read in full, each with its checkpoint |
| "A 4.5 d screenshot isn't a checkpoint" | It fills the row newest due at its taken time, with that age |
| "Two posts, one with a verdict: no rule yet" | The rule's evidence is the metric it names. Two posts agree: it enters, with its recheck |
| "This rule belongs in another file" | Rules learned about making posts accumulate in `playbook.md` |
| "I'll read the ledger to see the posts" | Filter it (Rows) |
| "Not Monday, so the research trigger waits" | The trigger is checked every run |
| "No industry standard in the repo, so I'll look one up" / "…so no target" | No ` ```kpi ` block triggers `research focus kpi`. Until it lands the target is our own median, from the tool |
| "The last edition is recent, so research is not due" | The 7-day limit dates the run, it does not drop it: log the `Next:` line with its date |
