import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary-dark' | 'secondary-light';

// Horizontal padding in px: it must not double with the user's text size, or buttons
// overflow narrow cards at 200% text (NFR-A-04). Radius in px for the same reason.
const base =
  'inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-[24px] px-[22px] py-2 text-center text-base font-semibold transition-colors [&>svg]:shrink-0 duration-200 focus-visible:outline-offset-4';

const variants: Record<Variant, string> = {
  // Espresso text on caramel: ≈ 5.4:1.
  primary: 'bg-caramel-400 text-espresso-950 hover:bg-caramel-300',
  // For dark (espresso) backgrounds.
  'secondary-dark': 'border border-cream-100/40 text-cream-50 hover:border-cream-50 hover:bg-cream-50/10',
  // For light (cream) backgrounds.
  'secondary-light': 'border border-espresso-900/25 text-espresso-900 hover:border-espresso-900 hover:bg-espresso-900/5',
};

interface ButtonLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly variant?: Variant;
  /** Opens in a new tab; appends a visually hidden notice for screen readers. */
  readonly external?: boolean;
  readonly newTabLabel?: string;
  readonly className?: string;
}

/** Link styled as a button. Internal links use Next.js client navigation. */
export function ButtonLink({
  href,
  children,
  variant = 'primary',
  external = false,
  newTabLabel,
  className = '',
}: ButtonLinkProps) {
  const classes = `${base} ${variants[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {children}
        {newTabLabel ? <span className="sr-only"> {newTabLabel}</span> : null}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
