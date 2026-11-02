import { Fraunces, Inter } from 'next/font/google';

/*
 * Fonts are downloaded at build time and self-hosted from our own origin — no runtime
 * requests to Google (NFR-C-03). Both families are licensed under the SIL Open Font
 * License 1.1. `latin-ext` is required for Polish diacritics.
 */
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz'],
});

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const fontClassNames = `${fraunces.variable} ${inter.variable}`;
