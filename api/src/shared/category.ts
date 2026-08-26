export const CATEGORIES = [
  'Pedals',
  'Amps',
  'Accessories',
] as const;

export type Category = (typeof CATEGORIES)[number];

export default CATEGORIES;
