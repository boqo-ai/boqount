# Queue

One table; the stage is `idea`, `script`, `ready`, `scheduled` or `held`, and `for` is a date on the account's clock. `tier` holds the kind (`film`, `clips`, `file`, `slideshow`), as the ledger's column does. `layer` is `niche, episode <n>`, `product` or `offer`; for `niche` the `rubric` is the series' slug. `note` names the channels when the post does not go to all of them. Rows are removed when every channel's row is `posted`.

| slug | stage | type | rubric | tier | for | file | note | layer |
|---|---|---|---|---|---|---|---|---|
