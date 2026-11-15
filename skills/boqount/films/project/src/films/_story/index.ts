// The film's entry: its composition id (the slug in PascalCase) and its slug. In src/films/_story/, the skeleton
// `film.mjs new <slug> --story` copies (never registered itself), these two are placeholders the copy renames.
import {K} from '../../lib/cues';
import {Film} from './Film';
import {DURATION} from './timeline';

export const film = {id: 'Story', slug: '_story', component: Film, durationInFrames: DURATION * K};
