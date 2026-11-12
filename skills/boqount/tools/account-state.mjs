#!/usr/bin/env node
// The state arithmetic of /boqount (skills/boqount).
//
//   node <skill>/tools/account-state.mjs mode     [--dir <repo>]                           calibration count and whether autopost should switch
//   node <skill>/tools/account-state.mjs budget   [--dir <repo>] [--now <ISO>]             today's and this month's spend against the caps
//   node <skill>/tools/account-state.mjs slot     [--dir <repo>] [--now <ISO>] [--taken <list_schedule.json>] [--day <YYYY-MM-DD>]   the next posting-window start (on or after --day, the account's clock)
//   node <skill>/tools/account-state.mjs queue    [--dir <repo>] [--now <ISO>] [--taken <list_schedule.json>]   days scheduled ahead, queue.md stages
//   node <skill>/tools/account-state.mjs norms    [--dir <repo>] [--now <ISO>]             per type: the norm (own median of the newest 10 once 5 exist, else research, else null)
//   node <skill>/tools/account-state.mjs due      [--dir <repo>] [--now <ISO>]             unread +24h/+72h/+7d/+28d checkpoints with the post's real age
//   node <skill>/tools/account-state.mjs verdict <slug>   [--dir <repo>] [--now <ISO>]    above | within | below | no-data against the norm (the post is left out of its own norm)
//   node <skill>/tools/account-state.mjs streak --from <date> --to <date> [--dir <repo>]   days in the range and days with a post, on the account's clock
//   node <skill>/tools/account-state.mjs followers <slug> [--dir <repo>]                   the follower-gain estimate around a post, per 1,000 views at 7 d
//   node <skill>/tools/account-state.mjs stops --funnel <green|yellow|red> --restricted <yes|no> [--since <ISO>] [--dir <repo>] [--now <ISO>]   whether auto-posting stops itself, why, and the drop run (--since defaults to config resumed_at)
//   node <skill>/tools/account-state.mjs kpi --from <date> --to <date> [--campaigns <campaigns.json>] [--dir <repo>] [--now <ISO>]   the closed week's KPIs against the strategy's targets, what sold, the constraint (kpi.md)
//   node <skill>/tools/account-state.mjs campaigns [--days <1-3650>] [--dir <repo>] [--now <ISO>]   marketing/signups.csv (typed by hand) as the campaigns reply kpi --campaigns reads; --days defaults to 90
//
// --channel <name>: the channel (config `channels`) that slot, queue, norms, verdict, streak, followers, stops and kpi
// work on; optional when the config lists one channel. due without it lists every channel's checkpoints, each with its
// channel. mode, budget and campaigns count the whole account and take no --channel.
// --dir defaults to the current folder: the account's files live where the agent was started, not beside this tool.
// Prints one JSON line and exits 0, or exits 1 with {"error": …}. The logic: tools/account-state-lib.mjs.
import { readFile } from "node:fs/promises";
import { run } from "./account-state-lib.mjs";

const root = process.cwd();
const { code, line } = await run(process.argv.slice(2), { readFile, now: () => new Date(), root });
console.log(line);
process.exit(code);
