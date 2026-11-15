```
Install the boqount skill: read https://raw.githubusercontent.com/boqo-ai/boqount/main/INSTALL.md and follow it.
```

Paste that line into your AI agent's chat (Claude Code, or another agent that runs skills). The agent installs the
skill and starts setting up your account in the same chat.

# boqount

boqount is a skill for an AI agent that runs a brand's social accounts on Instagram, TikTok and YouTube, day by day.
It plans posts, makes them, checks them, asks you to approve them, publishes them or hands them to you, and measures
how they did. It works from your project's own files, and every fact and number it uses carries its source.

## What happens after you paste the line

The agent copies the skill to your machine and starts onboarding in the folder you opened it in:

1. It asks once whether its files may be created in this folder, and whether to commit them.
2. It reads your project: the README and docs, the site's pages, prices, the product's own words, the logo and
   colours, earlier marketing, recent changes, and your public profiles.
3. It says back what it understood, with a source for each point, and asks what is wrong.
4. It asks only what no file could tell it: what the account sells and to whom, what is off limits, which channels,
   the budget, how many posts you want to approve before it may post alone, how you count sign-ups, who answers a
   comment that asks for the link (a DM automation you run, or you by hand), your time zone and when to post.
5. It drafts a brand kit from all that for your approval.
6. It researches a strategy with you: the account's goal, named series, a twelve-week calendar, benchmarks from
   sources. It shows you two or three style directions on real examples and asks which one, and what in it.
7. It asks whether you want films made here. Only on your yes does it set up the film project and run
   `npm install`.
8. It drafts your profile's bio, link and pins for you to set, and proposes a first week of three posts. Nothing is
   posted during onboarding.

Onboarding and research may start several helper agents at once, which uses more of your plan.

## What it does every day

Run `/boqount`. It reads its config and state, checks that your links still open, reads the numbers of posts that
are due, learns from them, plans the next two or three days, makes the posts that are missing, checks each one
against your brand book and its own rules, sends you each post for approval (caption, time and file together), and
publishes it or hands it to you. It ends with a list of comments to answer and a short report.

It posts at most twice a day on a channel, only in the time windows you set, within your budget.

## What it makes

- **Films from scratch,** drawn in code in a Remotion project in your folder, in your brand's style, with on-screen
  words and a synthesized sound kit, in two shapes:
  - **episodes of your niche series,** 27 to 30 seconds, that loop and never show the product: one travelling camera
    through one world, each step shown happening rather than labelled, something new for the eye about every second;
  - **films that show your product,** 60 to 85 seconds, in the "opportunity story" format: a sourced number about
    something everyone knows on the first frame, an opening the viewer can step into, the product named only near the
    end, scenes that change on their words, captions that carry it with the sound off, and one last line, "Comment
    <code>, and I'll send you the link." This format comes from a single reference film, so the skill treats it as a
    test until two of your own films in it have been measured.

  The agent judges a film from its stills and the file's own words; it does not watch it at speed or listen to it,
  and every approval message says so.
- **Clips** cut from your own long video (needs the optional account below).
- **Your own files**, checked and captioned.
- **Slideshows** made from stills you already have.

The skill ships a starter film for an invented plant-care app, made in the opportunity-story format: a
demonstration of the project, never a post. It opens on a number already counting, changes world on its words, keeps
its captions in one band, names the app only near the end, and closes on the comment arriving and its reply:
"Comment FERN, and I'll send you the link." A niche episode starts from the project's looping template instead.

## What it needs

- An agent that runs skills, such as Claude Code.
- Node 20 or newer (the film project needs 20.19, 22.13 or newer) and ffmpeg.
- About 1 GB of disk, only if you want films made here.
- For films, Remotion, which is free for individuals and for companies of up to three people and needs a company
  licence otherwise ([Remotion's licence](https://www.remotion.dev/docs/license)).

The agent checks these and tells you what is missing. It installs nothing without your yes.

## Optional

- **A boqo account** is optional, and recommended for the full experience. boqo is a service that publishes and
  schedules posts to your connected Instagram, TikTok and YouTube accounts and cuts clips from long videos. It is
  connected to the agent through its MCP server, `https://mcp.boqo.ai/mcp` (in Claude Code:
  `claude mcp add --transport http boqo https://mcp.boqo.ai/mcp`). With it, the agent publishes and schedules, reads
  the numbers without you, and cuts clips from a long video. Without one, the skill prepares every post and hands you
  the file, the caption and the time; you publish it and send back the link, and the numbers come from your
  screenshots or the figures you type.
- **An ElevenLabs key**, for a synthetic voice in films. Without one, films are voice-free: the words are on screen.

## Commands

| Command | What it does |
|---|---|
| `/boqount` | The day's run |
| `/boqount status` | A report of where things stand; changes nothing |
| `/boqount screens` | Reads the screenshots of your posts' numbers |
| `/boqount post <file or idea>` | Checks a file you made, or turns an idea into a planned post |
| `/boqount week` | The weekly roll-up: KPIs against their targets, what sold, the bets for next week |
| `/boqount research` | Hands over to `/boqount-research` |
| `/boqount config` | Shows the settings; `set <key> <value>`, `pause`, `resume` |
| `/boqount onboard` | Runs onboarding, or resumes it where it stopped |
| `/boqount-research` | `launch`, `refresh` or `focus <topic>`: the strategy, the benchmarks and the style |

## What it never does

- Post without your approval while it is calibrating. After the number of approved posts you set, it may post alone,
  with the same checks, and it stops itself when the numbers drop or a link breaks. You can pause it at any time.
- Buy ads or views.
- Ask for anything in a post beyond one comment call: a film that shows your product ends on "Comment <code>, and
  I'll send you the link.", and only once you have confirmed who sends that link (your DM automation, or you by
  hand). Niche episodes ask for nothing; one you mark as promoted with bought views carries your brand book's call
  line. Never "follow", never "link in bio". Every other call lives on your profile.
- Write to GitHub, push, or install anything without your word.
- Print a key.

## The files it creates in your folder

- `marketing/`: the config, the state, the log, the queue, the ledger of posts, the strategy, one record per post.
- `brand/<your-brand>/`: the brand book, the accounts, the assets, the style.
- `films/`: the film project and one folder per film, when you want films made here.
- `.boqo-upload/`: working files, git-ignored.

Your keys are never stored in these folders. `examples/quillfern/` shows the files after onboarding, for an invented
brand.

## Installing by hand, for Claude Code

```sh
git clone --depth 1 https://github.com/boqo-ai/boqount ~/.boqount
mkdir -p ~/.claude/skills
ls -ld ~/.claude/skills/boqount ~/.claude/skills/boqount-research
```

If either name already exists, leave it: a link to `~/.boqount/skills/` is installed already, and anything else is
yours to move first. Then link the names that do not exist (`-n`, so an existing folder is never entered):

```sh
ln -sn ~/.boqount/skills/boqount ~/.claude/skills/boqount
ln -sn ~/.boqount/skills/boqount-research ~/.claude/skills/boqount-research
```

Then open Claude Code in your project's folder and run `/boqount onboard`.

## Updating

```sh
git -C ~/.boqount pull --ff-only
```

Your account's files are not touched by an update.

## Removing

```sh
rm ~/.claude/skills/boqount ~/.claude/skills/boqount-research
rm -rf ~/.boqount
```

Use the skills folder you installed into, if it was another. This leaves your project's `marketing/`, `brand/` and
`films/` folders as they are; delete them yourself if you no longer want them. A key you saved is in
`~/.config/boqount/`.

## Licence

The code is MIT; see [LICENSE](LICENSE). The bundled Inter font is under the SIL Open Font License 1.1; its text is
beside the font, in
[`skills/boqount/films/project/shared/fonts/OFL-Inter.txt`](skills/boqount/films/project/shared/fonts/OFL-Inter.txt).
