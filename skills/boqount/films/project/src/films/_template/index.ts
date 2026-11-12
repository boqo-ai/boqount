// The film's entry: its composition id (the slug in PascalCase) and its slug. In src/films/_template/, the skeleton
// `film.mjs new <slug>` copies (never registered itself), these two are placeholders the copy renames.
import {K} from '../../lib/cues';
import {Film} from './Film';
import {DURATION} from './timeline';

export const film = {id: 'Template', slug: '_template', component: Film, durationInFrames: DURATION * K};
