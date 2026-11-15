This is a dry run, and the clock is not today's: it is now {{NOW}} (UTC). Give every tool that takes `--now` the value
{{NOW}}. Work only in this folder.

Outside calls are simulated. When you would call a boqo tool, `funnel-check.mjs`, your DM automation, `signups_command`
or `boqo-upload.mjs put`, do not make the call: write the exact call under ACTIONS, then read its reply from
`.sim/<name>.json`, where `<name>` is the tool's name (`list_schedule`) or the script and its command (`funnel-check`,
`boqo-upload.put`). When `.sim/<name>.<slug>.json` exists for the post the call is about, read that one instead. The
second time you make the same call, read `.sim/<name>.2.json` if it exists, the third time `.3`, and so on. With no
such file, the call failed as unavailable. You must NOT publish, schedule, post, send or reply to anything, run any
`gh` write, push, render video, call ElevenLabs or any paid service, or spend money or credits: where you would, write
the exact call or command under ACTIONS. Every other command (the skill's tools, `boqo-upload.mjs probe` and `name`,
`git` in this folder, reading files) really runs.

End with two sections:
MESSAGE TO THE USER: exactly what you would send.
ACTIONS: every file you read or wrote, every command you ran, and every outward call you would have made, in order.
