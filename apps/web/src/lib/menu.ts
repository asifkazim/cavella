import type { MenuCategory, MenuItem } from '@/content/types';

export interface FeaturedItem {
  readonly categoryId: string;
  readonly item: MenuItem;
}

/** Featured, currently available items for the homepage, in menu order. */
export function featuredItems(categories: readonly MenuCategory[], limit = 4): FeaturedItem[] {
  return categories
    .flatMap((category) =>
      category.items
        .filter((item) => item.featured === true && item.unavailable !== true)
        .map((item) => ({ categoryId: category.id, item })),
    )
    .slice(0, limit);
}

/** Problems with menu data (duplicate ids, missing variants, invalid prices); empty when valid. */
export function validateMenu(categories: readonly MenuCategory[]): string[] {
  const problems: string[] = [];
  const categoryIds = new Set<string>();
  const itemIds = new Set<string>();
  const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  for (const category of categories) {
    if (!ID_RE.test(category.id)) problems.push(`category "${category.id}": id must be kebab-case`);
    if (categoryIds.has(category.id)) problems.push(`category "${category.id}": duplicate id`);
    categoryIds.add(category.id);

    for (const item of category.items) {
      if (!ID_RE.test(item.id)) problems.push(`item "${item.id}": id must be kebab-case`);
      if (itemIds.has(item.id)) problems.push(`item "${item.id}": duplicate id`);
      itemIds.add(item.id);
      if (item.variants.length === 0) problems.push(`item "${item.id}": needs at least one variant`);
      for (const variant of item.variants) {
        const { price } = variant;
        if (typeof price === 'number' && (!Number.isFinite(price) || price <= 0)) {
          problems.push(`item "${item.id}": price must be a positive number`);
        }
      }
    }
  }
  return problems;
}
