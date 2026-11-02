import type { GeoPoint } from '@/content/types';

function assertValidPoint({ lat, lng }: GeoPoint): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError(`Invalid coordinates: ${lat},${lng}`);
  }
}

/**
 * Google Maps universal directions link. Opens the Google Maps app on Android/iOS when
 * installed, the website otherwise (PRD FR-W-07, AC-W-04). No API key, no embed.
 */
export function googleDirectionsUrl(point: GeoPoint): string {
  assertValidPoint(point);
  const params = new URLSearchParams({ api: '1', destination: `${point.lat},${point.lng}` });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Apple Maps directions link (opens the Maps app on iOS/macOS). */
export function appleDirectionsUrl(point: GeoPoint): string {
  assertValidPoint(point);
  const params = new URLSearchParams({ daddr: `${point.lat},${point.lng}` });
  return `https://maps.apple.com/?${params.toString()}`;
}
