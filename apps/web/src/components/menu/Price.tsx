import { PlaceholderToken } from '@/components/ui/Placeholder';
import { isPlaceholder, type Editable } from '@/content/placeholder';
import type { Locale } from '@/content/types';
import { formatPrice } from '@/lib/format';

/** Gross PLN price, or a visible placeholder token until the owner confirms it (AC-W-03). */
export function Price({ price, locale }: { price: Editable<number>; locale: Locale }) {
  if (isPlaceholder(price)) return <PlaceholderToken label={price.label} />;
  return <span className="tabular-nums">{formatPrice(price, locale)}</span>;
}
