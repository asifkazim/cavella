import type { ReactNode } from 'react';
import '../globals.css';

/** Root layout for `/` only; every real page lives under `/[locale]/`. */
export default function RootRedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
