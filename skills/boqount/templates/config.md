# Account config

Read by every run, edited only by the human or by `config set|pause|resume`. Parsed by `tools/account-state-lib.mjs` (`parseConfig`): keep the block's `key: value` lines, one per line. An empty value means not set. A line starting with `#` is a comment.

```config
brand: <slug of brand/<slug>/>
channels: instagram, tiktok, youtube
account_id:
boqo_server:
timezone:
windows:
# windows@youtube: 12:00-14:00
max_posts_per_day: 2
budget_usd_day: 10
budget_usd_month:
credits_day: 0
calibration_posts: 10
autopost: calibration
paused_by:
resumed_at:
mix: reach 70, awareness 20, sale 5, trust 5
verdict_band: 0.8-1.25
research_every_weeks: 4
seed_research:
caption_via_filename: ask
live_page:
tracker:
language:
sales_goal_28d:
publish_via: auto
git_commit: off
git_push: off
issues_repo:
issues_label:
signups_source: none
signups_command:
dm_command:
link_must_have:
link_must_not_have:
```

- `channels`: where the account posts, from `instagram`, `tiktok` and `youtube`, in the order written. Empty means
  `instagram` alone. A ledger or `account.csv` row with an empty `channel` belongs to the first one.
- `<key>@<channel>`: a value for one channel only, for `account_id`, `windows` and `max_posts_per_day`; a channel
  without one takes the plain key. Each channel is its own boqo account, so with several channels set
  `account_id@<channel>` for every one but the first (the plain `account_id`), for example `account_id@tiktok: <its id>`,
  only for a listed channel that has an id. A line with an empty value is not read. With several channels the tools'
  per-channel commands take `--channel <name>`.
- `boqo_server`: the name of the MCP server whose boqo tools this skill may use (`posting.md` → Start).
- `windows`: `HH:MM-HH:MM` ranges on the account's clock, for example `09:00-11:00, 18:00-20:00`.
- `budget_usd_month`: empty means days in the month times `budget_usd_day`.
- `credits_day`: `0` until the human sets it.
- `mix`: each type's share of the posts; it must sum to 100. The starting value is a proposal, and the mix is the
  person's. A `niche` film (the viewer's world, no product) counts as `reach`; the product at work as `awareness`;
  honest arithmetic about the product as `trust`; a real offer with its real date as `sale`.
- `max_posts_per_day` may not exceed 2, per channel.
- `language`: the reports' language (`en`, `ru`, …). Empty means the language the person writes in.
- `sales_goal_28d`: how many buyers the account should bring in 28 days, set by the human. Empty means not set: the
  skill asks once, at the first roll-up, and never assumes one (`<skill>/kpi.md`).
- `verdict_band`, the month rule and `credits_day: 0` are proposed defaults; each is a `Ruling:` the human can change.
- `publish_via`: `auto` (also empty), `manual` or `boqo-only`: how a post goes out, through boqo or handed to the person.
- `git_commit`: `on` or `off` (also empty): whether Save commits the account's files, set by onboarding's answer; the
  tools do not read it.
- `git_push`: `on` or `off` (also empty): whether the skill may push the account's repository.
- `issues_repo`: the GitHub repository (`owner/name`) that tracks the account; empty means none.
- `issues_label`: the label a filed problem report gets; empty means none.
- `tracker`: an issue reference the week's roll-up is commented on; empty means the week's file is the record.
- `signups_source`: `manual`, `command` or `none` (also empty): where sign-ups are read from.
- `signups_command`: the command that prints the sign-ups, for `signups_source: command`.
- `dm_command`: optional, the command that points one code word's rule in the person's DM automation at a link, with
  `{code}`, `{channel}` and `{link}` filled in (for example `node tools/dm.mjs set {code} {channel} {link}`). Empty
  means the person points each rule by hand (`measure.md` → Your DM automation).
- `link_must_have`: a text the page the link ends on must hold (for example the page's headline).
- `link_must_not_have`: a text that means the way in is closed (for example a sign-in wall's words).
