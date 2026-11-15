# Quillfern assets

v1, approved 2026-11-11 by the human. Every asset here is invented for the boqount example.

A manifest of paths: each path is read where it lives, with its source's commit when it is in a repository. A path
that does not resolve is not listed. Each entry names its source and the date read.

## Logo

- `brand/quillfern/logo.svg`: a fern leaf drawn as a quill, leaf green (#6CC59A) on nothing; never recoloured, never
  on a photograph. Source: the person, 2026-11-09.

## Fonts

Font files live in `brand/quillfern/fonts/`. A font other than Inter in `style.md` → Tokens needs its files there.

- None: the style uses Inter, which the film project ships (`films/project/shared/fonts/Inter.ttf`, SIL Open Font
  License). Source: `style.md` → Tokens, 2026-11-11.

## Colour and look

- The films' tokens: `brand/quillfern/style.md` → Tokens.
- The site's colours: https://quillfern.example, read 2026-11-09 (soil brown, paper white, leaf green).

## Characters

- None.

## Voice takes

- None: the films are voice-free.

## Film templates

- The starter film (`films/starter/`), a worked example for Quillfern: read, never posted.

## Sounds

- The synthesized sound kit, `films/sfx/` (made by `film.mjs init`; no licence needed). No music saved.

## Product screen recordings

- None yet: the films draw the phone and its reminder (the person, 2026-11-09).

## Interface labels

| Screen | Labels, exactly as shown | Read at | Date |
|---|---|---|---|
| Lock-screen widget | "Days since water", with the count | the Quillfern app on the person's phone, read with them at onboarding | 2026-11-09 |
| The reminder | "Water your plant · Today, 9:00", the Done disc | the same | 2026-11-09 |

## Product output

- None.

## Media

The brand's own media live in `brand/quillfern/media/` (used across films) or a film's `films/<slug>/media/` (that
film only). Each media folder has a `SOURCES.md`: file, where from, whose, the terms and when they were read.

## Material with rights

The brand's own: footage, stills and channels it may use.

- None yet (the person, 2026-11-09: "no footage, no photos we own").

## Outside material

Each source that is not the brand's and that the human allowed (`brand-book.md` → Do and don't, where their word is
recorded).

- None.

Its files are never committed: the folder is in `.gitignore`, its `SOURCES.md` excepted (`<skill>/film.md` → Outside
material).

## Stock

- None.
