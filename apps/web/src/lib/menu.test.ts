import { describe, expect, it } from 'vitest';
import { placeholder } from '@/content/placeholder';
import type { MenuCategory } from '@/content/types';
import { featuredItems, validateMenu } from './menu';

const name = { pl: 'x', en: 'x' };
const variants = [{ size: null, price: placeholder<number>('price') }];

const sample: MenuCategory[] = [
  {
    id: 'coffee',
    name,
    items: [
      { id: 'a', name, variants, featured: true },
      { id: 'b', name, variants, featured: true, unavailable: true },
      { id: 'c', name, variants },
    ],
  },
  { id: 'sweets', name, items: [{ id: 'd', name, variants, featured: true }] },
];

describe('featuredItems', () => {
  it('returns available featured items in menu order', () => {
    expect(featuredItems(sample).map((f) => f.item.id)).toEqual(['a', 'd']);
  });

  it('respects the limit', () => {
    expect(featuredItems(sample, 1).map((f) => f.item.id)).toEqual(['a']);
  });
});

describe('validateMenu', () => {
  it('accepts valid data', () => {
    expect(validateMenu(sample)).toEqual([]);
  });

  it('reports duplicate ids, bad ids, missing variants and invalid prices', () => {
    const bad: MenuCategory[] = [
      {
        id: 'Coffee',
        name,
        items: [
          { id: 'a', name, variants: [] },
          { id: 'a', name, variants: [{ size: null, price: 0 }] },
        ],
      },
    ];
    expect(validateMenu(bad)).toEqual([
      'category "Coffee": id must be kebab-case',
      'item "a": needs at least one variant',
      'item "a": duplicate id',
      'item "a": price must be a positive number',
    ]);
  });
});
