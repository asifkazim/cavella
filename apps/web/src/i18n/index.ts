import type { Locale, LocalizedText } from '@/content/types';
import { en } from './dictionaries/en';
import { pl, type Dictionary } from './dictionaries/pl';

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { pl, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replaces `{name}` tokens. Unknown tokens are left intact so mistakes stay visible. */
export function interpolate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);
}

export function localized(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
