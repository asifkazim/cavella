import { placeholder } from './placeholder';
import type { Location } from './types';

/**
 * ✏️ OWNER: replace every `placeholder(...)` with the confirmed value.
 * `geo` keeps an example point (central Warsaw) so the Directions links can
 * be tested; it MUST be replaced with the kiosk's real coordinates.
 */
export const location: Location = {
  streetAddress: placeholder('street address'),
  postalCode: placeholder('postal code'),
  city: placeholder('city'),
  tramStop: placeholder('tram stop name'),
  tramLines: placeholder('tram lines'),
  wayfinding: placeholder('wayfinding description', {
    pl: 'Kiosk stoi tuż przy przystanku tramwajowym — zobaczysz nas zaraz po wyjściu z tramwaju.',
    en: 'The kiosk is right next to the tram stop — you will see us as soon as you step off the tram.',
  }),
  geo: placeholder('GPS coordinates', { lat: 52.2297, lng: 21.0122 }),
};
