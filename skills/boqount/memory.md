# Memory: state.md, the week's roll-up, and the reports

SKILL.md step 6's roll-up, step 13 (the close, morning and evening) and the `week` mode. What a run remembers lives in
four places: `state.md` (today, at most 80 lines), `log.md` (the last 7 days), `weekly/<YYYY-Www>.md` (each week's
summary and, once folded, its log entries) and the ledger. The morning read stays SKILL.md's six; anything else is read
only by the step that names it.

## state.md, every run

Rewritten by every run that writes, the evening close included, from `templates/state.md`: its sections, in its
order, and nothing else. It is a summary of now, not a history.
- **Today:** the template's lines. One line per channel says how its posts go: `<channel>: boqo | by hand (<why>)`
  (`posting.md` → How a post goes out). The dated boqo lines (`caption field`, `agent captions setting`,
  `Instagram AI label`, `AI label test post`, worded as `posting.md` → Start has them) are kept only for the boqo
  channels. Every product-state line (those, each channel's account-status line, `Analytics`) is carried with its date,
  and changed only by the step that reads it. The `KPI` and `Bets` lines are carried the same way, and rewritten only by
  the roll-up (`kpi.md`); the `Review:` line too, written only on the person's approval (`measure.md` → Learning 7),
  and the `Timer:` line (`auto.md` → Timers).
- **Last 7 days:** one row per post and channel planned from today − 7 days through the last scheduled day. Older rows
  go: the ledger has them.
- **Norms:** from this run's `node <skill>/tools/account-state.mjs norms --channel <channel> --now <now>`, after this
  run's reads (ad posts are left out: `measure.md` → Bought views). Run it for each channel in `channels`;
  with one channel the flag may be left out.
- **Queue, next 3 days** and **Budget:** from `queue.md` and `account-state budget`.
- **Open questions:** the ones still open, each with the date first asked. An answered one goes (the log has the answer).
- **Notes for tomorrow:** at most 5 lines, written today. Earlier notes are not carried: the log holds them.

**At most 80 lines.** Check with `wc -l marketing/state.md` before the save. Over 80, cut in this order until it
fits:
1. the notes;
2. the open questions' wording;
3. the "Last 7 days" rows scheduled past tomorrow;
4. recurring human items among the open questions (screenshots, reviews, screens), merged into one line that keeps the
   earliest date;
5. the queue rows past tomorrow.

Never drop an open question, a product-state line (the `KPI`, `Bets` and `Review` lines among them) or a section. 81 is over.

## The log entry

From `templates/log-entry.md`. Its heading ends with the run's tag: `— day run` (the day's step 13), `— evening close`,
or the mode that wrote it (`— post`, `— week`, `— screens`, `— config`). Only `day run` and `evening close` are runs: the
evening close (SKILL.md → Modes) looks for today's `day run`, and the gap (`auto.md`) for the newest of the two. Any
other heading, a build session or an entry written by hand, counts for neither.

## The roll-up

**When** (this is the one home for it; every other file points here): the last ISO week's file has no `## Posts`
section. With `<today>` on the account's clock (YYYY-MM-DD):

```bash
W=$(node -e 'const t=new Date(process.argv[1]+"T00:00:00Z");t.setUTCDate(t.getUTCDate()-4-(t.getUTCDay()+6)%7);const y=t.getUTCFullYear();console.log(y+"-W"+String(Math.floor((t-Date.UTC(y,0,1))/864e5/7)+1).padStart(2,"0"))' <today>)
grep -q '^## Posts' "marketing/weekly/$W.md" 2>/dev/null || echo "roll-up due: $W"
```

So it is due on Monday, on the first run after a Monday with no run, and after a run that was killed once it had
folded (the file then holds only a Log). **The first one** waits for the account's first full week of posts: the
first Monday on or after its first `posted_at`
(`awk -F, 'NR==1{for(i=1;i<=NF;i++)if($i=="posted_at")c=i} NR>1 && $c!=""{print substr($c,1,10)}' marketing/ledger.csv | sort | head -1`)
starts that week, and until it has ended the roll-up is not due. `week` runs it whatever this says. It runs after Learning (step 6), so today's
reads and verdicts are in.

1. **Fold the log** with this one command, from the account's folder. Every
   entry older than 7 days moves, verbatim, to its own ISO week's file under `## Log` (the file is made when it does
   not exist), and `log.md` keeps one pointer line per folded week. It prints one JSON line: `week`, `from` and `to`
   (the ISO week that ended: the report's week), `folded` (entries per week) and `kept`. It never prints an entry. Do
   not read `log.md` whole to fold it.

   ```bash
   node -e '
   const fs=require("fs"),today=process.argv[1],day=864e5,at=d=>Date.parse(d+"T00:00:00Z"),iso=t=>new Date(t).toISOString().slice(0,10);
   fs.mkdirSync("marketing/weekly",{recursive:true});
   const wk=d=>{const t=new Date(at(d));t.setUTCDate(t.getUTCDate()+3-(t.getUTCDay()+6)%7);const y=t.getUTCFullYear();return y+"-W"+String(Math.floor((t-Date.UTC(y,0,1))/day/7)+1).padStart(2,"0")};
   const cut=iso(at(today)-7*day),mon=iso(at(today)-((new Date(at(today)).getUTCDay()+6)%7+7)*day);
   const parts=fs.readFileSync("marketing/log.md","utf8").split(/^(?=## 20\d\d-\d\d-\d\d(?:[ \t]|$))/m),lines=/^## 20/.test(parts[0])?[]:parts.shift().trimEnd().split("\n");
   const ptr=lines.filter(l=>/^- \d{4}-W\d\d: \d+ entries/.test(l)),rest=lines.filter(l=>!ptr.includes(l)),keep=[],old={};
   for(const e of parts){const d=e.slice(3,13);if(d<cut)(old[wk(d)]??=[]).push(e.replace(/\n*$/,"\n"));else keep.push(e)}
   for(const [w,es] of Object.entries(old)){
     const f="marketing/weekly/"+w+".md";let s=fs.existsSync(f)?fs.readFileSync(f,"utf8"):"# Week "+w+"\n";
     if(!/^## Log$/m.test(s))s=s.trimEnd()+"\n\n## Log\n\nThe log entries of the week, verbatim, moved out of log.md.\n";
     fs.writeFileSync(f,s.trimEnd()+"\n\n"+es.join("\n"));
     const i=ptr.findIndex(l=>l.startsWith("- "+w+":")),n=es.length+(i<0?0:+ptr[i].split(" ")[2]),line="- "+w+": "+n+" entries → weekly/"+w+".md, under Log";
     if(i<0)ptr.push(line);else ptr[i]=line;
   }
   const top=[rest.join("\n").trimEnd(),ptr.sort().join("\n")].filter(Boolean).join("\n\n");
   fs.writeFileSync("marketing/log.md",(top?top+"\n\n":"")+keep.join(""));
   console.log(JSON.stringify({week:wk(mon),from:mon,to:iso(at(mon)+6*day),folded:Object.fromEntries(Object.entries(old).map(([w,es])=>[w,es.length])),kept:keep.length}));
   ' <today>
   ```

   Check it by counts, never by reading: `grep -c '^## 20' marketing/log.md marketing/weekly/*.md`. Each folded week's
   file gains its `folded` count, and `log.md` holds `kept` entries. The command is safe to run twice: the second run
   folds nothing.
2. **The KPIs:** `kpi.md` → The weekly read, with the printed `from` and `to`. Reach and followers are read for each
   channel in `channels`; sign-ups, activation, buyers and sales once, for the account (`kpi.md`). Under
   `signups_source: manual` it reads `marketing/signups.csv` as it stands: a week the file does not reach is
   `unavailable: not typed yet`, the missing rows are asked for in the run's one request, and nothing waits. At the
   first roll-up, the sales goal is asked (`kpi.md` → Targets). It leaves the saved
   KPI output, the bets in `queue.md`, and the values of the `KPI:` and `Bets:` lines for this run's rewrite of
   `state.md`.
3. **Write the week's summary** for the printed `week` (never this week's), from `templates/weekly.md`, by the rules
   below. It replaces only what is above `## Log` in the week's file, and it never overwrites the Log. Write it to
   `.boqo-upload/week-summary.md`, then put it in place:

   ```bash
   touch marketing/weekly/<week>.md
   { cat .boqo-upload/week-summary.md; echo; sed -n '/^## Log$/,$p' marketing/weekly/<week>.md; } > .boqo-upload/week.md && mv .boqo-upload/week.md marketing/weekly/<week>.md
   ```

   The file's `grep -c '^## 20'` is the same before and after.
4. **Save, locally:** `log.md`, `queue.md` and every weekly file the command printed (SKILL.md → Save, locally).
5. **The tracker comment** (below), only with `tracker` set and for a week with posts:
   `awk -F, -v a=<from> -v b=<to> 'NR>1 && $4>=a && $4<=b' marketing/ledger.csv | grep -c .`. At 0, the week's file still
   gets its `## Posts` ("none"), so the trigger does not fire again; no comment goes out, and Numbers says `comment: not
   sent: no posts`. With `tracker` empty, the week's file is the record: Numbers says `comment: not sent: no tracker`.

### The summary's rules

Every number carries its source: the ledger column, `account-state`, or the campaigns reply (from `marketing/signups.csv`
or the config's `signups_command`), with its read time.
- **The headings stay as the template has them, in English:** the trigger greps `## Posts`, the fold `## Log`. The
  text under them follows `language:`.
- **KPI:** every cell from this roll-up's KPI output (`kpi.md`): the value, the target with its basis, source and
  date, the ratio, the verdict, the trend. The nine rows are the judged week's. Reach and followers rows are each
  channel's (one row per channel); sign-ups, activation and buyers rows are the account's, once. A `no-data` row keeps its
  value when it has one, and its why goes on the No data line. The week that ended gets its one line, with no verdict.
- **Sales:** from the tool's `sales` and the campaigns reply only, as `kpi.md` → What sold, to whom, and how has it:
  the account's sign-ups by the three reads, the paths by series and product function (a `niche` post adds posts and views and no sign-ups
  of its own; a product function's path reads its code word's campaign), and on a month's first roll-up its month line; then the bets this run wrote, each by its slug (a profile
  bet as `profile`). No number moves from the account's line into a path or a post.
- **Posts:** the ledger rows planned in `from`..`to`, by filter:
  `awk -F, -v a=<from> -v b=<to> 'NR==1 || ($4>=a && $4<=b)' marketing/ledger.csv`. Name each post with its channels
  and its layer (and series and episode for `niche`; from its record). Name also the older posts whose verdict was
  written this week (`verdict_at` in the week). Where the table lists posts, each has its per-film measures (views at
  72 h, sends per reach, follows per 1,000 views; `measure.md` → Learning 1), `unavailable` where not read.
- **Metric against norm,** per type, and per channel (norms are a channel's):
  - each post with a verdict: its value, its verdict, and the norm it was written against (its record's Verdict line,
    not today's);
  - then today's norm once: value, n and source copied together from one `account-state norms` call for the channel,
    made after this run's reads, never from `state.md` (yesterday's) or a call made before the reads;
  - a window still open: "open, closes <date>". It gets no verdict, and an interim count is never written as the
    metric.
- **Best and worst,** per type: by the main metric among the verdicts, else by the newest checkpoint read for all of
  them (name it). Each line is `<slug> (<channel>) — <numbers, checkpoint, source> — <reason>`. The reason is the post's
  Hypothesis (the ledger's `variable`), stated as what was tried. With one post or none that has a number, write `—`
  and why.
- **Playbook changes:** every `playbook.md` row whose Since date is in `from`..`to`, the Monday included, is a rule
  that entered this week: list it with its evidence. Add the rechecks and strikes dated in the week. New evidence on an
  older rule is not a change. Write "none" only when no row carries a date in the week.
- **The week's plan:** next week's posts by type and channel, from the queue and the mix. Add the mix proposal (a `config set mix …`
  line, measure.md → Learning 5) or "none", and any dated research run.
- **Spend:** `awk -F, -v a=<from> -v b=<to> 'NR>1 && $1>=a && $1<=b {u+=$4; c+=$5} END {print u+0, c+0}' marketing/budget.csv`,
  against 7 × `budget_usd_day` and 7 × `credits_day`.

### The tracker comment

Only when `config.md`'s `tracker:` is set; it names the issue (`<owner>/<repo>#<n>`). The comment's body is the week's
file above `## Log`, never its Log. Immediately before the `gh` call, as its own text, the line SKILL.md → Rules gives:
`Filing the week's comment on <owner>/<repo> as <login>.` (the login: `gh api user -q .login`).

```bash
sed '/^## Log$/,$d' marketing/weekly/<week>.md > .boqo-upload/week-comment.md
gh issue comment <n> --repo <owner>/<repo> --body-file .boqo-upload/week-comment.md
```

The `sed` is local, so it runs whenever the call is made. Never `--body` with the text inline. Write the comment's
URL into the log under Did. With no reply, or a failure, write it under Owed and comment at the next run.

## Reports

**The language** is `config.md`'s `language:` key: every report and message of the run, the weekly file and the
tracker comment, whatever language the message or the skill's own text is in. With no key, it is the language of the
human's own words: this run's message, or for a bare command their quoted words in the last 7 days of the log. With
neither, it is the language of the brand kit's Voice section. One run, one language; only the GitHub and push lines
below stay verbatim.

### The morning report

**The message is, in this order:** the GitHub and push lines, repeated; any one-line declines (`production.md`, `auto.md` →
The gap), which stand above the report and are not counted; the report; the blocks. Approval messages (`gate.md`) are
separate messages.

**The report** has ten slots, all present, in this order, each one line. It starts at the first label and ends on the
Auto line. At most 300 words over that span. The labels here are English; when the report's language is not English,
they are translated. "The Auto line", "Waits for you" and the like, anywhere in this skill, mean these slots in whatever
language. Slugs, tool names and ids stay as they are.

| Slot | What it holds | With nothing to say |
|---|---|---|
| `Numbers:` | See Numbers, below | during an MCP failure, `unavailable: <why>` for what it can't read |
| `Funnel:` | The colour, then why: `<n> of <m> links open (funnel-check, <time>)`. Red names the link | never empty |
| `Alarms:` | Each alarm. For an MCP failure, the human's step and the next queue rows by name and stage | `none` |
| `Reconciled:` | `posting.md` → Reconcile's two lines | `nothing in flight` |
| `Waits for you:` | See Waits for you, below | always both parts |
| `Plan:` | Today and the next 2 days: slug, type, layer (and series and episode for `niche`), channels, slot or held + rule. A dated research run. The review's result on the day it is read (`measure.md` → Learning 7). The voice branch in force, one line (`production.md`) | a day with nothing says so |
| `Budget:` | `$<spent>/<day cap> today, $<spent>/<month cap> this month; credits <spent>/<cap>` | never empty |
| `Mode:` | `calibration <approved>/<needed>`, `auto`, or `paused (<paused_by>)` | never empty |
| `Not built:` | The steps that ran a fallback | `none` |
| `Auto:` | See The Auto line, below | `none` only when the run wrote nothing |

Where numbers differ by channel, a slot holds one line per channel in `channels`; the account's sign-ups, sales and
budget are given once.

**Numbers,** in this order. Every figure carries its tool and read time.
1. Followers and the week's gain, one line per channel (`get_analytics` or the person's figures, `<time>`).
2. Each checkpoint read today: slug, channel, checkpoint, value, real age (`get_analytics` or the person's figures,
   `<time>`); an ad post's views on their own line, as bought (`measure.md` → Bought views).
3. Each verdict written today: `<slug> <channel> <verdict>: <value> against <source> <norm>, n <n>, data <partial|full>`. **A
   verdict cites the norm it was written against:** the norm `account-state verdict <slug>` printed, which leaves the
   post out, and which its record's Verdict line holds.
4. `Norm today`, for a channel and type whose norm this run's reads moved: value, n and source copied together from
   the one `account-state norms` call for that channel, made after this run's reads. Never the morning's `state.md`, and never one norm's value
   with the other's n. So a verdict and norm today can differ in value and in n, and each keeps its own.
5. Sign-ups on the two days before today, on the account's clock (the campaigns reply, `<time>`; `unavailable: no sign-ups source` with
   `signups_source: none`, never 0), then the period's sign-ups by `measure.md` → Attribution's three reads (the
   profile link, the campaigns, the "how did you hear" answers: `unavailable: nobody has read the answers`, with the
   last reading and its date), then an ad post's own campaign count. No other post has a count of its own: a code
   word's campaign is its rubric's.
6. On a gap day, `Days with a post: <withPost>/<days> since <date>`, each missed day named (`auto.md` → The gap).
7. On the roll-up's day, last, two items:
   `KPI <judged week>: <on>/<judged> on target; constraint <kpi> at <ratio> | none; buyers_28d <n> (goal <goal> | no goal); best path <segment> via <rubric>: <sign-ups> sign-ups, <buyers> buyers | no path with a sign-up (account-state kpi, <time>)`,
   then `week: weekly/<week>.md; comment: <its URL | not sent: <why>>` (the comment only with `tracker` set).

**Waits for you** has two parts, always both, in this form. Approvals are never mixed with human steps.

```
Waits for you: approvals: <slugs whose approval message went out> | none (auto) | none (nothing at the gate); your steps: <names only> | none
```

`your steps` names the human's items and no more: the screenshots, on Monday the DM review, the account screens and the
"how did you hear" answers, a DM-automation rule to repoint (an ad post's), profile steps when a run drafted them (the
bio's words, what to pin: the drafted words are in the log entry under Asked, and the slot only names them), the review's decision while it is open, on
the roll-up's day the sales goal while `sales_goal_28d` is empty, and every `handed` post not yet confirmed (slug,
channel, the time it was for; `posting.md` → By hand). How to do each is in a block, or was said before. No slot
holds a code word or a per-post link. Two items stand here in full, because the human acts on their text: an Edit's diff (`gate.md`) and the mix proposal (a `config set mix …` line).

**The Auto line** lists every act done without asking, in this run, in the order done: a post, through boqo or handed
over, in `auto.md`'s format (`<slug> <channel>: <type> (skill), <date> <time>, <kind>, $<cost>`), a cancel, the switch of mode,
the fold (the count per week), the week's file, the rewrite of `state.md`, the bets written to the queue, the tracker
comment (only with `tracker` set), a filed issue (only with `issues_repo` set), the push (only with `git_push: on`). **An outward call goes on the
line only when its reply shows it went through.** A call that was drafted, refused or failed, or that has no reply, is
not on the line: it goes in the log under Owed. So `none` fits only a run that wrote nothing.

**The GitHub and push lines:** each GitHub write's line and each push's line (SKILL.md → Rules) is said as its own text
immediately before its tool call, verbatim. It may be repeated above the report, in the order of the acts, where it is
not counted; it is never put inside a slot. A comment that then has no reply keeps its line, and Numbers says `not sent`.

**The blocks** come after the Auto line, each under its name, in this order, and are **not counted in the 300 words**.
A block with nothing in it is left out.
- `Screenshots`: the screenshot request (`measure.md`).
- `Community`: step 12's comments to answer and story ideas.

Nothing else follows the report. A slip, a "what next" or an explanation goes in the log.

### The other reports

- **The evening close:** its report is the log entry and `state.md`. The reply to the user is at most four lines:
  what was read (or "nothing due"), what changed, every `handed` post not yet confirmed (slug, channel, the time it
  was for; with none, no line), and the Auto line.
- **`week`:** the file, the comment (with `tracker` set), and `state.md` rewritten as every run that writes rewrites it. The reply is
  these six lines, in this order, with nothing after the last:
  1. `<week>: weekly/<week>.md`;
  2. the `KPI <judged week>: …` item of Numbers, alone (the `week:` item is lines 1 and 4 here);
  3. `Bets: <slug> (<kpi>), … | none`;
  4. `comment: <its URL | not sent: <why>>`;
  5. the `Waits for you:` line, as in the morning report;
  6. the `Auto:` line.

**Every report ends with the `Auto:` line,** blocks aside.

## Red flags

| Thought | Reality |
|---|---|
| "The last two weeks have files, so the roll-up is done" | The summary is one half. The log keeps 7 days; the fold moves the rest |
| "I'll read log.md to cut the old entries out" | The command folds it and prints counts. Check with `grep -c` |
| "It's Monday, so the report is this week's" | The week that ended: the command's `week` |
| "The week's file exists, so the roll-up ran" | The trigger is `## Posts`. A file holding only a Log still gets its summary and its comment |
| "I'll write the summary straight into the week's file" | It replaces only what is above `## Log`. Use the two commands, and the entry count stays the same |
| "The whole file is the comment" | The body stops above `## Log` |
| "The week's file is Posts, Playbook, plan and Spend" | And `## KPI` and `## Sales`, from the roll-up's KPI step (`kpi.md`), with their English headings |
| "The numbers speak; best needs no reason" | The reason is the post's Hypothesis, on every Best and Worst line |
| "The rule was already in the playbook, so nothing changed this week" | Its Since date is in the week: it entered this week, and the summary lists it |
| "state.md already has the norm" | state.md is yesterday's. Today's norm, value and n together, is the `norms` call after today's reads |
| "One norm for the whole type is simpler" | Each verdict cites the norm it was written against; today's norm is given apart |
| "state.md was over 80 lines before this run; I only added my lines" | Every run that writes rewrites it whole: today's date, the template's sections, at most 80 lines. `week` too |
| "State says about 80 lines; 81 is about 80" | At most 80, by `wc -l`. Cut the notes first |
| "Old notes might matter tomorrow" | The log has them. Notes for tomorrow are today's, at most 5 |
| "To reach 80 I'll drop an open question" | Merge the recurring human items into one line, and cut the queue rows past tomorrow. Every question stays |
| "The message is only a command, so English" | `language:` in config.md sets it; empty, the person's own language |
| "The labels are the template's, so they stay English" | The labels follow the report's language too: translated, from `Numbers:` to `Auto:` |
| "Nothing waits in auto, so the slot can hold my list" | `approvals: none (auto)`, then `your steps`. Both parts, always |
| "The verdict was against today's norm" | A verdict cites the norm it was written against. Norm today is a separate figure, from the one `norms` call after the reads |
| "The comment is drafted, so it goes on the Auto line" | Only a call whose reply shows it went through. The rest goes under Owed, and Numbers says `not sent` |
| "The fold and the state file aren't really acts" | The Auto line lists them, with the week's file |
| "One more note after the report will help" | Only the two named blocks follow it. The rest goes in the log |
| "A comment is a GitHub write; skip it" | With `tracker` set, the weekly comment is the tracker's record: its line right before the call, then `--body-file` |
| "The plan line only needs slug and type" | A planned post's line names its layer too, and series and episode for `niche` |
| "A code word or the post's link belongs in the plan or Waits for you" | No slot holds one. A product post's code word is in its record, a `niche` post has neither, and an ad post is named by its slug |
| "The sale post's sign-ups go in Numbers" | No post has its own: an `offer` post's code word counts for its rubric. The period's sign-ups, by the three reads, are the account's line |
| "I'll say it once, above the report" | The line comes right before the tool call. The copy above the report is extra |
