import { describe, expect, it } from 'vitest';
import { appleDirectionsUrl, googleDirectionsUrl } from './maps';

describe('directions links', () => {
  const point = { lat: 52.2297, lng: 21.0122 };

  it('builds a Google Maps universal directions URL', () => {
    expect(googleDirectionsUrl(point)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=52.2297%2C21.0122',
    );
  });

  it('builds an Apple Maps directions URL', () => {
    expect(appleDirectionsUrl(point)).toBe('https://maps.apple.com/?daddr=52.2297%2C21.0122');
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => googleDirectionsUrl({ lat: 91, lng: 0 })).toThrow(RangeError);
    expect(() => appleDirectionsUrl({ lat: 0, lng: Number.NaN })).toThrow(RangeError);
  });
});
