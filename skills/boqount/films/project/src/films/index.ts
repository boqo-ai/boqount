// Every film in this project. `film.mjs new <slug>` adds its import and its entry between the marker lines.
// films:start
import {film as starter} from './starter';
import {film as glimpse} from './glimpse';
// films:end

export const FILMS = [
  // films:list:start
  starter,
  glimpse,
  // films:list:end
];
