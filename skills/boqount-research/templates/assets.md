# <brand> assets

<v1 draft <YYYY-MM-DD>, awaiting approval | v1, approved <YYYY-MM-DD> by the human>.

A manifest of paths: each path is read where it lives, with its source's commit when it is in a repository. A path
that does not resolve is not listed. Each entry names its source and the date read.

## Logo

- <the mark and the favicon in use: paths, colours, what never to use>

## Fonts

Font files live in `brand/<slug>/fonts/`. A font other than Inter in `style.md` → Tokens needs its files there.

- <file, family, licence and its source>

## Colour and look

- The films' tokens: `brand/<slug>/style.md` → Tokens.
- <the site's and the app's tokens: path and section>

## Characters

- <recurring characters: their folders and rules>

## Voice takes

- <approved voice takes: paths, what each says, approved when>

## Film templates

- <film templates and kits: paths>

## Sounds

- <approved sounds and their licences: paths>

## Product screen recordings

- <recordings of the product doing the work: paths, dates, what they show>

## Interface labels

Every label a film shows of the product's own screens, read at the product's page or app, never from memory or an
older film. Read again before a film shows that panel; a set the product no longer has holds the film.

| Screen | Labels, exactly as shown | Read at | Date |
|---|---|---|---|
| <the screen or panel> | <tabs, buttons, fields, placeholders> | <URL, or app and version> | <YYYY-MM-DD> |

## Product output

- <examples of results the product made, with the rights to show them: paths>

## Media

The brand's own media live in `brand/<slug>/media/` (used across films) or a film's `films/<slug>/media/` (that film
only). Each media folder has a `SOURCES.md`: file, where from, whose, the terms and when they were read.

## Material with rights

The brand's own: footage, stills and channels it may use.

- <what it is, its path, the permission's source and date>

## Outside material

Each source that is not the brand's and that the human allowed (`brand-book.md` → Do and don't, where their word is
recorded).

- <the source, what the word covers (picture only | picture and sound), the folder its files are in, and its
  `SOURCES.md`>

Its files are never committed: the folder is in `.gitignore`, its `SOURCES.md` excepted (`<skill>/film.md` → Outside
material).

## Stock

- <finished films not yet posted: slug, path, checked when>
