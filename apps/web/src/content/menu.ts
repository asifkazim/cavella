import { placeholder } from './placeholder';
import type { MenuCategory } from './types';

/**
 * Menu content (FR-W-04).
 *
 * ✏️ OWNER: confirm items and sizes, and replace every `price` placeholder with a
 * gross PLN amount as a number, e.g. `price: 12` → "12,00 zł".
 * Mark sold-out items with `unavailable: true`; `featured: true` shows an item
 * on the homepage.
 */
const PRICE = 'price';

export const menu: readonly MenuCategory[] = [
  {
    id: 'coffee',
    name: { pl: 'Kawa', en: 'Coffee' },
    intro: {
      pl: 'Świeżo mielona, parzona na zamówienie.',
      en: 'Freshly ground and brewed to order.',
    },
    items: [
      {
        id: 'espresso',
        name: { pl: 'Espresso', en: 'Espresso' },
        description: { pl: 'Krótkie, intensywne, z gęstą cremą.', en: 'Short and intense, with a thick crema.' },
        variants: [
          { size: '30 ml', price: placeholder(PRICE) },
          { size: '60 ml', price: placeholder(PRICE) },
        ],
      },
      {
        id: 'americano',
        name: { pl: 'Americano', en: 'Americano' },
        description: { pl: 'Espresso dopełnione gorącą wodą.', en: 'Espresso topped up with hot water.' },
        variants: [
          { size: '250 ml', price: placeholder(PRICE) },
          { size: '350 ml', price: placeholder(PRICE) },
        ],
      },
      {
        id: 'cappuccino',
        name: { pl: 'Cappuccino', en: 'Cappuccino' },
        description: { pl: 'Espresso z aksamitną mleczną pianką.', en: 'Espresso with velvety milk foam.' },
        variants: [
          { size: '250 ml', price: placeholder(PRICE) },
          { size: '350 ml', price: placeholder(PRICE) },
        ],
        featured: true,
      },
      {
        id: 'flat-white',
        name: { pl: 'Flat white', en: 'Flat white' },
        description: { pl: 'Podwójne espresso, cienka warstwa mikropianki.', en: 'Double espresso with a thin layer of microfoam.' },
        variants: [{ size: '200 ml', price: placeholder(PRICE) }],
        featured: true,
      },
      {
        id: 'latte',
        name: { pl: 'Caffè latte', en: 'Caffè latte' },
        description: { pl: 'Łagodne espresso z dużą ilością mleka.', en: 'Mellow espresso with plenty of steamed milk.' },
        variants: [
          { size: '350 ml', price: placeholder(PRICE) },
          { size: '450 ml', price: placeholder(PRICE) },
        ],
      },
      {
        id: 'iced-latte',
        name: { pl: 'Latte na zimno', en: 'Iced latte' },
        description: { pl: 'Espresso, zimne mleko i lód.', en: 'Espresso, cold milk and ice.' },
        variants: [{ size: '400 ml', price: placeholder(PRICE) }],
        tags: ['seasonal'],
      },
    ],
  },
  {
    id: 'toast',
    name: { pl: 'Tosty', en: 'Toast' },
    intro: {
      pl: 'Gorące, chrupiące, gotowe w kilka minut.',
      en: 'Hot, crispy and ready in a few minutes.',
    },
    items: [
      {
        id: 'toast-ham-cheese',
        name: { pl: 'Tost z szynką i serem', en: 'Ham & cheese toast' },
        description: { pl: 'Klasyka na szybkie śniadanie.', en: 'A classic quick breakfast.' },
        variants: [{ size: null, price: placeholder(PRICE) }],
        featured: true,
      },
      {
        id: 'toast-caprese',
        name: { pl: 'Tost caprese', en: 'Caprese toast' },
        description: { pl: 'Mozzarella, pomidor, pesto bazyliowe.', en: 'Mozzarella, tomato, basil pesto.' },
        variants: [{ size: null, price: placeholder(PRICE) }],
        tags: ['vegetarian'],
      },
      {
        id: 'toast-hummus',
        name: { pl: 'Tost z hummusem i warzywami', en: 'Hummus & vegetable toast' },
        description: { pl: 'Hummus, grillowana papryka, rukola.', en: 'Hummus, grilled pepper, rocket.' },
        variants: [{ size: null, price: placeholder(PRICE) }],
        tags: ['vegan'],
      },
    ],
  },
  {
    id: 'sweets',
    name: { pl: 'Słodkości', en: 'Sweets' },
    intro: {
      pl: 'Coś słodkiego do kawy.',
      en: 'Something sweet to go with your coffee.',
    },
    items: [
      {
        id: 'croissant',
        name: { pl: 'Croissant maślany', en: 'Butter croissant' },
        variants: [{ size: null, price: placeholder(PRICE) }],
        tags: ['vegetarian'],
        featured: true,
      },
      {
        id: 'cinnamon-roll',
        name: { pl: 'Cynamonka', en: 'Cinnamon roll' },
        variants: [{ size: null, price: placeholder(PRICE) }],
        tags: ['vegetarian'],
      },
      {
        id: 'brownie',
        name: { pl: 'Brownie czekoladowe', en: 'Chocolate brownie' },
        variants: [{ size: null, price: placeholder(PRICE) }],
        tags: ['vegetarian'],
      },
      {
        id: 'cookie',
        name: { pl: 'Ciastko owsiane', en: 'Oat cookie' },
        variants: [{ size: null, price: placeholder(PRICE) }],
        tags: ['vegan'],
      },
    ],
  },
  {
    id: 'drinks',
    name: { pl: 'Napoje', en: 'Drinks' },
    intro: {
      pl: 'Schłodzone napoje w butelkach.',
      en: 'Chilled bottled drinks.',
    },
    items: [
      {
        id: 'water-still',
        name: { pl: 'Woda niegazowana', en: 'Still water' },
        variants: [{ size: '500 ml', price: placeholder(PRICE) }],
      },
      {
        id: 'water-sparkling',
        name: { pl: 'Woda gazowana', en: 'Sparkling water' },
        variants: [{ size: '500 ml', price: placeholder(PRICE) }],
      },
      {
        id: 'orange-juice',
        name: { pl: 'Sok pomarańczowy', en: 'Orange juice' },
        variants: [{ size: '330 ml', price: placeholder(PRICE) }],
      },
      {
        id: 'lemonade',
        name: { pl: 'Lemoniada', en: 'Lemonade' },
        variants: [{ size: '330 ml', price: placeholder(PRICE) }],
      },
    ],
  },
];
