import { location } from '@/content/location';
import { isPlaceholder, resolveEditable } from '@/content/placeholder';
import { appleDirectionsUrl, googleDirectionsUrl } from './maps';

export interface DirectionsLinks {
  readonly google: string;
  readonly apple: string;
  /** True while the coordinates are still a placeholder example. */
  readonly isExample: boolean;
}

/** Directions links for the kiosk, or `null` if there are no coordinates (not even an example). */
export function getDirectionsLinks(): DirectionsLinks | null {
  const geo = resolveEditable(location.geo);
  if (!geo) return null;
  return {
    google: googleDirectionsUrl(geo),
    apple: appleDirectionsUrl(geo),
    isExample: isPlaceholder(location.geo),
  };
}
