import {K} from '../../lib/cues';
import {DURATION, Film} from './Film';

// The first look (onboarding.md → 2. Say it back, and show it): drawn from spec.json, which the sync copies from
// films/glimpse/glimpse.json. Not a film made with `film.mjs new`, and never posted.
export const film = {id: "Glimpse", slug: "glimpse", component: Film, durationInFrames: DURATION * K};
