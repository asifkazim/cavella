import type { Editable } from './placeholder';

export type Locale = 'pl' | 'en';

/** Text that must exist in every supported language. */
export type LocalizedText = Readonly<Record<Locale, string>>;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Local Europe/Warsaw times, 24-hour `HH:MM`. Intervals never cross midnight. */
export interface TimeInterval {
  readonly open: string;
  readonly close: string;
}

/** Empty array = closed all day. */
export type WeeklyHours = Readonly<Record<Weekday, readonly TimeInterval[]>>;

export interface HoursException {
  /** ISO local date `YYYY-MM-DD` in Europe/Warsaw. */
  readonly date: string;
  /** Empty array = closed that day. */
  readonly intervals: readonly TimeInterval[];
  readonly note?: LocalizedText;
}

export interface OpeningHours {
  readonly weekly: Editable<WeeklyHours>;
  readonly exceptions: readonly HoursException[];
}

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface Location {
  readonly streetAddress: Editable<string>;
  readonly postalCode: Editable<string>;
  readonly city: Editable<string>;
  readonly tramStop: Editable<string>;
  readonly tramLines: Editable<string>;
  readonly wayfinding: Editable<LocalizedText>;
  readonly geo: Editable<GeoPoint>;
}

export interface MenuVariant {
  /** Size label such as "250 ml". `null` when the item has a single size. */
  readonly size: string | null;
  /** Gross price in PLN (VAT included, PRD A-05). */
  readonly price: Editable<number>;
}

export type MenuTag = 'vegan' | 'vegetarian' | 'seasonal' | 'new';

export interface MenuItem {
  readonly id: string;
  readonly name: LocalizedText;
  readonly description?: LocalizedText;
  readonly variants: readonly MenuVariant[];
  readonly tags?: readonly MenuTag[];
  /** Temporarily sold out / unavailable (FR-W-05). */
  readonly unavailable?: boolean;
  /** Shown in the homepage highlights. */
  readonly featured?: boolean;
}

export interface MenuCategory {
  /** URL fragment and stable id, e.g. "coffee". */
  readonly id: string;
  readonly name: LocalizedText;
  readonly intro?: LocalizedText;
  readonly items: readonly MenuItem[];
}

export type SocialNetwork = 'instagram' | 'facebook' | 'tiktok';

export interface SocialLink {
  readonly network: SocialNetwork;
  readonly url: Editable<string>;
}

export interface BusinessInfo {
  readonly name: string;
  readonly legalName: Editable<string>;
  readonly taxId: Editable<string>;
  readonly email: Editable<string>;
  readonly phone: Editable<string>;
  readonly social: readonly SocialLink[];
}
