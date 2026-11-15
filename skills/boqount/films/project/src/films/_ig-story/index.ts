// The story's entry: its composition id (the slug in PascalCase) and its slug. In src/films/_ig-story/, the skeleton
// `film.mjs new <slug> --ig-story` copies (never registered itself), these two are placeholders the copy renames.
import {K} from '../../lib/cues';
import {Film, DURATION} from './Story';

export const film = {id: 'IgStory', slug: '_ig-story', component: Film, durationInFrames: DURATION * K};
