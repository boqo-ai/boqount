# The check before publishing

Runs once on every post at `planned`, and again when its file or its caption changes; its caption and label items
(3 and 4) run once for each channel the post goes to. A record at `checked` or later keeps its check.

**An answered hold comes back.** At step 9, and as soon as the human answers, a `held` record whose rule now has its
answer goes back to `planned`, its queue row to `ready`, and the whole check runs again: `cta` once a new cut or a new
caption meets item 3 (a `niche` post with no call, or, on an ad post, exactly the brand book's call line with its code
word's row confirmed; a `product` or `offer` film with its one call and its code word's row confirmed); `layer` once a new cut or caption no longer names the product (item 2); `material` once every still and shot
is named and sourced, a source's sound plays only under its own shot on the person's word for it, no run of someone else's footage is over 5 s and the caption
credits the source (item 6); `ai-label` once the `Instagram AI label` line reads `present` (item 4); `AI label test
owed` once the human confirms the platform shows its AI label on the test post, or names this post the test post;
`ai-label by hand` once the human says how the label is set on that channel; `probe` once the human rules (item 11);
`claims` or `hook` once a new cut exists.

## What it reads, and nothing more

- the post's record, and the film's script (brand-book → Facts, "What a film says"), from **the file's own checkout**,
  read-only, whichever repository holds the film. A copy outside a checkout (a Desktop file) goes by its film's name.
  - **No script there:** write one to `marketing/media/<slug>/script.txt` from the file itself: its words by Whisper
    (`production.md` → The file's words), its on-screen text from the stills (`gate.md` → The pictures), and a first
    line `# written from the file <date>: frames and Whisper`. It is checked like any other, and the gate shows it. Write
    `- Script: written from the file` under the record's Posting: in auto it needs a human Publish, like `GO with edits`
    (`auto.md`);
- for a film made here, its `STORYBOARD.md`; for one that carries stills or shots that are not drawn, the `SOURCES.md`
  of each media folder they come from (`brand/<slug>/media/`, the film's `media/`);
- `brand/<slug>/brand-book.md`, the sections Positioning, Facts, Claims, Legal, CTA (an ad post's call line) and Do
  and don't (the person's word for material that is not the brand's);
- `brand/<slug>/style.md` → Look and → Language, for the look and the language of a post made here (kind `film`,
  `slideshow` or `story`);
- **two kinds read as others are:** a `recording` is checked as a `file` is, in every item. A `story` has no hook
  formula and no arc: item 2 reads only its language, its extra details and its lists; item 3 holds any ask in its
  words or pictures, the link sticker the person adds excepted; every other item holds as for a film
  (`production.md` → A story);
- `hooks.md`: the hook's rules and `hooks.md` → The arc;
- for a `product` or `offer` post, and an ad post whose call line carries a code word, its code word's DM rule:
  `awk '/^## DM automation/{p=1;next} /^## /{p=0} p' brand/<slug>/accounts.md`;
- each fact's source, read now, the way brand-book → Facts says ("Before reading facts");
- one look for duplicates: the titles of `get_analytics {period: 0, accountId}` for each boqo channel (unwrapped,
  `posting.md` → Start), and the ledger's other rows, once for the film's name (a legacy post has it in `note`, and
  posts published by hand are not in `get_analytics`) and once for caption line 1. A count, not a read, and the post's
  own rows are left out:
  `awk -F, -v s="<slug>" 'NR>1 && $1!=s && $3 !~ /^(planned|checked|held|skipped|failed|canceled|abandoned)$/' marketing/ledger.csv | grep -ciF -- "<film name, or caption line 1>"`;
- `node <skill>/tools/account-state.mjs budget`;
- for a `sale` post, the funnel state (`state.md`).

## The checks, in order

1. **Claims.** Every claim (a price, a limit, a count, "live", a deadline) against its source in brand-book →
   Facts, read now. A function still in preview is "soon". A claim is false when its source says otherwise, and
   unsourced when no source says it.
   - **In the film itself** (the voice, on-screen text, a UI shown): a false or unsourced claim is `HOLD: claims`.
     The check never edits a film; the fix is a new cut, which comes back through the check.
   - **In the caption only:** a false or unsourced claim is cut, or replaced by the strongest true one, as
     `GO with edits`. A replacement that would contradict what the film says is `HOLD: claims` instead.
   - **No stronger than its source:** an outside fact is said as its source says it ("announced" where the source
     announces; an estimate called one, with its date). A line about what other people do or will do is softened
     ("plenty", "many", "can"), never a count nobody holds. A stronger line is a false claim.
   - **The product's labels on screen** are claims too: each against `brand/<slug>/assets.md` → Interface labels, whose
     row was read again for this film. A label set the product no longer shows is `HOLD: claims (outdated labels)`.
   - **A fact that can move** (an estimate, a release date, a "no date yet"): the record's Posting has
     `- Re-read before it posts:` naming each one and where it is read (`posting.md` → The buffer). A film that states
     one with no such line is `HOLD: claims (no re-read line)`.
2. **The hook and the structure** (`hooks.md`). The layer is the record's `Layer` field, and the script's one
   `Structure:` line (`Structure: Layer: <niche | product | offer> — <part> <lines>, …`; for `niche`, the series and
   episode on the line above it) says the same layer; a record with no layer, or a script that says another, is
   `HOLD: hook`. The
   hook: no product in the hook, second person, one real number, and no request for a comment (an opportunity story's
   hook reads its own rule, below). Then the arc (`hooks.md` → The arc), the `Structure:` line read against the
   script's lines:
   - **`product` or `offer`:** the opportunity story's ten parts in order (hook · proof · catch · who is left · where
     you come in · what most do · turn · the product at work · payoff · call), and no seam (`story.md`). Its hook is a
     real number about an event everyone knows, with its source on screen by 0.5 s (an estimate named as one, with its
     date), no product and no request; it need not say "you", which is heard in part 5 at the latest. The product is
     first named in part 8; the call is the last line. The film is 60 to 85 s and does not loop. An `offer` film has
     the offer and its real date at the payoff.
   - **`niche`:** its format's parts in order (the chain explainer, dated news or the data story), then the seam, as
     one episode of its series (`marketing/strategy.md` → Rubrics), opening on the series' fixed line. Its first
     sentence says "you" or "your". Its one real number is the date in dated news and the number in a data story; a
     chain explainer's hook is its fixed opening line, and has the other three. The product is named nowhere: in no
     line of the script, on no still, in no caption. A product found is `HOLD: layer (a niche film names the
     product)`.

   A part missing or out of order is `HOLD: hook` on every kind but `file` and `clips`; a line that states an amount
   of money or says the viewer will earn is item 1's `HOLD: claims`. Outside a chain explainer and the opportunity
   story, every hook has all four, whichever formula it follows: on every kind but `file` and `clips`, a miss is `HOLD: hook`.
   - **No extra details, no numbered list** (a post made here, every layer): on screen only the thing the line is
     about (`film.md` → Overview). A source plate, a disclaimer, a feature chip, a kicker label or fine print the
     story does not need is `HOLD: hook (extra detail)`; what a rule puts on screen on purpose stays (an opportunity
     story's source line, a series mark, the credit's own place). "One:, Two:" in the voice, or numbered chips on
     screen, is `HOLD: hook (numbered list)`, unless the rubric is a numbered how-to (`script.md` rule 12).
   - **A post made here** also keeps `style.md` → Language: its one form of address, the series' fixed opening line,
     and its ending (the payoff, or its first picture again). A miss in the film is `HOLD: hook`; in a caption it is
     fixed as `GO with edits`. A still that departs from `style.md` → Look holds nothing: the approval message's Check
     line names it, for the person.
   - **Kind `file` or `clips`:** a finished video cannot be re-hooked without a new cut, and has no `Structure:` line:
     its layer is the record's, and a `niche` one that names the product is still `HOLD: layer`. A product in the hook
     or a request for a comment is still `HOLD: hook`. A missing second person or real number is the human's to rule:
     write `- Hook ruling: lacks <second person | a real number>` under the record's Posting. The gate shows it and its
     Publish accepts it; in auto it needs a human Publish, like `GO with edits` (`auto.md`).
3. **The caption and the call,** for each channel: its "As it will appear" block in the record. Line 1 restates the
   hook as a loss (a `niche` post's line 1 restates its hook).

   Read three places for a line that asks for a comment, a code word, a follow, a click or a visit, and for a last
   second that is a logo or a link: the film's words (`production.md` → The file's words), its stills (`gate.md` → The
   pictures), and each channel's caption. The check never edits a film: a call to add to, or take out of, the voice
   or a still needs a new cut. The urgency line and the seam are not a call: they name a moment, and no action on the
   post or the profile. An `offer` line that says where the offer is passes only on the person's word for that post,
   logged as a `Ruling:`; without it, it is a call.
   - **A `niche` post asks for nothing.** One ask found is `HOLD: cta (a call in <the voice | a still at <t> s | the
     caption>)`. Its record's Link is the profile link (`brand/<slug>/accounts.md` → Links). No post shows it, on any
     channel: it is kept for the funnel check and the measured path. The ledger's `code_word` and `utm_campaign` stay
     empty.
   - **A `product` or `offer` film carries exactly one call,** in two places: the voice's last line (in a voice-free
     film, the last on-screen line), `Comment <code>, and I'll send you the link.`, and each channel's caption, `Comment
     <CODE> and I'll send you the link.`, as the last sentence of its own words (only source lines, the credit line and
     the hashtags may follow it). The call missing from either place, the call anywhere in the film but its last line,
     a second ask in the film (a follow, a click, a visit, "link in bio"), or a logo card or a link on screen is `HOLD:
     cta (<what>)`. The reply shown in the last scene may carry the brand's small mark as its sender: that is not a
     logo card. A second ask in a caption only is cut, as `GO with edits`. CODE is the code word of the film's rubric
     (`marketing/strategy.md` → Rubrics), with its row confirmed in `brand/<slug>/accounts.md` → DM automation (The DM
     rule, below): no confirmed row is `HOLD: cta (no DM rule for <CODE>)`. The record's Code word and Link are that
     row's, and each ledger row's `code_word` and `utm_campaign` carry them. A `product` or `offer` film of kind `file`
     or `clips` that cannot be re-cut is the human's to rule: the call in its caption only, or held.
   - **An ad post** is the one exception for a `niche` post: a post the person will promote with bought views, marked
     in the record as `Ad: yes (<the person's words, date>)` on their word for that post, never by you. It carries
     exactly the call line of `brand/<slug>/brand-book.md` → CTA, where that section puts it, and no other call;
     anything else is `HOLD: cta (not the brand book's call line)`, and an ad post with no call line is `HOLD: cta (an
     ad with no call)`. A `product` or `offer` post marked `Ad: yes` keeps its one call as it is.
   - **A post that becomes an ad.** Marking a record `Ad: yes` sets `ad: yes` on each of its ledger rows (`measure.md` →
     Bought views) and changes nothing else by itself: the call line is a new cut and a new caption, and the post starts
     over. A planned, held, scheduled or handed post's earlier approval is void. In this order: a scheduled post is
     first taken out (`posting.md` → A canceled post), and for a handed one the person is told not to publish it; every
     channel's row returns to `planned` with `approval: none`, its `canceled:` note keeping what was canceled and why;
     the post is cut again with the brand book's call line after the payoff and before the seam (`hooks.md` → The arc);
     the record gets its `Ad call` line and its own campaign; each outside source in it is put to the person again for
     ad use (item 6); the whole check runs again; and it goes out only on a human Publish, whatever the mode (`gate.md`).
     No rule that returns a held post to `approved` or to `uploaded` applies to it. A post already `posted` is never
     turned into an ad cut: the ad is a new post with its own record (slug `<slug>-ad`), and the posted one stays as
     it is. All of this is a `niche` post's. A `product` or `offer` post that becomes an ad keeps its cut and its
     call: only `ad: yes` on its rows, and each outside source in it put to the person again for ad use (item 6).
   - **The DM rule** of a code word is confirmed once per code word, not per post: a row in
     `brand/<slug>/accounts.md` → DM automation, `code | rubric | channel | link | who replies | confirmed <date> by the human`,
     for the channel the post goes to. Who replies is the person's DM automation on that channel, or `the person, by
     hand` when they have said they will answer each comment themselves. No tool can say it: `funnel-check` walks a
     link, not what a reply sends. No
     row, or one with its `confirmed` cell empty (its link changed), is `HOLD: cta (no DM rule for <CODE>)` on that
     channel, and Open questions gets `confirm the DM rule <CODE> → <link>`. Only the human's answer writes the row; it
     clears every post held on that code word.

   Then, for the channel's path and the branch in force (`posting.md` → The caption):
   - **by hand, or the field branch** (through boqo, `caption field: present`, setting `on`): the block itself, inside
     the platform's limit (`posting.md` → How a post goes out → Per platform; YouTube: the title and the description),
     carrying its own hashtags, at most 5, in the caption grammar of `style.md` → Language for a post made here;
   - **file-name branch** (through boqo, anything else): judge what will appear, which is the name's words (at most 200
     characters, no `-`, `_` or `/`: `node <skill>/tools/boqo-upload.mjs name` refuses them) plus the account's Defaults
     tags (none are added when the name holds a `#tag`, so it carries at most 5 of its own). With
     `caption_via_filename: yes`, the name carries the approved caption on its one line. With `hook` (or `ask` until
     answered: the gate message asks it, `posting.md` → The caption), it carries only line 1. A `niche` post's name
     asks for nothing. A name that cannot hold a `product` or `offer` film's call leaves it to the film's last line,
     which every such film has.
4. **The AI label.** A synthetic voice or a realistic AI picture needs the platform's AI-content label (brand-book →
   Legal; `posting.md` → The AI label). Write `- AI label: yes (<why>)` or `- AI label: no` under the record's Posting.
   With `yes`, each channel is judged by the path it goes, and held here, never first at post time:
   - **by hand:** no hold; the hand-over tells the person to set it;
   - **Instagram through boqo:** label `absent` or `unread` is `HOLD: ai-label`; while `state.md`'s `AI label test
     post` line is not `confirmed` (`posting.md` → The AI label), any record other than the one that line names is
     `HOLD: AI label test owed` (only the human names it). The
     first such hold opens `AI label test: name the test post` in `state.md` → Open questions;
   - **TikTok or YouTube through boqo:** `HOLD: ai-label by hand` until the human says how it goes; the question goes
     into `state.md` → Open questions.

   Otherwise a label line is no reason to hold.
5. **Music:** a source's own sound under its own shot is judged by item 6's rule, and is the one exception. Any other
   music is licensed, or the platform's own library.
6. **Other people and outside material** (`film.md` → Outside material). Never, whatever the person says: another
   person's face, name or channel without their written permission; leaked or pre-release material. Either, in the
   film, on a still or in a caption, is `HOLD: material`.

   A film that carries stills or moving shots that are not drawn: read its `STORYBOARD.md` against the `SOURCES.md` of
   its media folders and against its stills (`gate.md` → The pictures).
   - Every still is named by its file and every shot as `<file> <from>–<to> s`, and every file has its `SOURCES.md`
     row: where from, whose, the terms and when they were read.
   - The brand's own material is listed in `brand/<slug>/assets.md` → Material. Material that is not the brand's has
     the person's word for that source, with the terms read and the date, in `brand/<slug>/brand-book.md` → Do and
     don't.
   - Each channel's caption has, as its last line of words, a line that credits each outside source; a hashtag line
     may follow it. The file-name branch with `hook` carries line 1 only, so it cannot: that channel is held, and one
     question goes to the person, into `state.md` → Open questions: "Switch <slug> on <channel> to a caption written
     by the agent, or drop its outside material?"
   - **An ad post:** each outside source also needs the person's word for ad use, given after what the terms of whoever
     holds its rights say about advertising was put to them (`brand/<slug>/brand-book.md` → Do and don't, its `Ad use` column). Without
     it, the ad cut carries none of that source.
   - The sound is the film's own (`films/<slug>/audio/`). A shot is picture only, unless the storyboard plays its
     source's own sound under it: then only under that shot of that same source, for that shot's length, under the
     film's voice or text, and only when the person's word for that source names its sound too. A source's song is
     never the film's bed. Each such shot is on the record's `Outside sound:` line and named in the storyboard; a
     source's sound that is on neither is `HOLD: material`.
   - No unbroken run of someone else's footage is longer than 5 s (a production limit; the person's to change).

   A still or a shot the storyboard does not name, a file with no `SOURCES.md` row or no word for its source, a caption
   without the credit, a source's sound the person's word does not cover, that runs beyond its own shot or that is the
   film's bed, or a longer run is `HOLD: material`.
7. **Positioning:** the post sells what brand-book → Positioning says the brand sells, and promotes nothing that
   section says is not promoted.
8. **Duplicates:** not already posted, by title or by film. A count above 0 is `HOLD: duplicate`.
9. **A sale post** needs a green funnel.
10. **The budget** for this post: its cost fits what `budget` leaves today and this month, in dollars and credits.
11. **The file and the probe.** A post is a video file: a carousel goes out only as a slideshow video (kind
    `slideshow`), checked like any other video. Then, when any of its channels goes through boqo, the probe:
    `node <skill>/tools/boqo-upload.mjs probe <file>` reads `passthrough` and `loopSafe`. A file Post would re-encode
    (`passthrough: false`), or one with B-frames (`loopSafe: false`), is `HOLD: probe`. Only the human can accept
    such a file; that answer is a `Ruling:`, and the check is run again. Over 300 MB there is no such answer: boqo
    refuses the file at posting, so it needs a smaller encode.

## The output

One of:
- `GO` (a `Hook ruling:` or `Script:` line alone leaves it `GO`, with `check: pass`: nothing was caught, and the human
  rules);
- `GO with edits`, each edit listed (`<what> → <to what> — <rule>`); the gate shows the edited post;
- `HOLD: <rule>` (the first rule that fails).

A hold found only in one channel's caption, or one from item 4, holds only that channel; any other hold holds every
channel of the post.

Then write:
- each channel's ledger `check`, and the record's Check field: `pass` for `GO`, `caught:<rule>` for `GO with edits`
  (the first edit's rule) and for `HOLD: <rule>`. A hold that waits only for the human's word (`AI label test owed`,
  `ai-label by hand`) writes `pass`: nothing was caught;
- each channel's status: `checked`, or `held` with the rule in the ledger's `note`; the queue row's `stage` and `note`
  follow.

A question the check cannot answer goes to `state.md` → Open questions, with the date first asked.
