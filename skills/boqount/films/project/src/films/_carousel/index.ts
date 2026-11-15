// The carousel's entry: its composition id (the slug in PascalCase) and its slug. In src/films/_carousel/, the skeleton
// `film.mjs new <slug> --carousel` copies (never registered itself), these two are placeholders the copy renames.
// One frame per slide, 1080×1440 (3:4): `npm run slides -- <Id>` renders them (carousel.md → Render).
import {Carousel} from './Carousel';
import {SLIDES} from './slides';

export const film = {id: 'Carousel', slug: '_carousel', component: Carousel, durationInFrames: SLIDES.length, width: 1080, height: 1440};
