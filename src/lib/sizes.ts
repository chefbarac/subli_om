import { cleanText } from './normalize';

export interface SizePairing {
  tag: string;
  label: string;
}

export const SIZE_PAIRINGS: readonly SizePairing[] = [
  { tag: 'XSmall', label: 'XS' },
  { tag: 'Small', label: 'S' },
  { tag: 'Medium', label: 'M' },
  { tag: 'Large', label: 'L' },
  { tag: 'XLarge', label: 'XL' },
  { tag: '2XLarge', label: '2XL' },
  { tag: '3XLarge', label: '3XL' },
  { tag: '4XLarge', label: '4XL' },
  { tag: '5XLarge', label: '5XL' },
  { tag: 'B', label: 'B' },
];

export const SIZE_TAGS: string[] = SIZE_PAIRINGS.map((size) => size.tag);
export const SIZE_LABELS: string[] = SIZE_PAIRINGS.map((size) => size.label);

/**
 * Tag spellings used before the pairing was fixed, kept so older orders keep
 * resolving to a label instead of silently going blank.
 */
const LEGACY_TAG_ALIASES: Record<string, string> = {
  'extra small': 'XS',
  xs: 'XS',
  xsmall: 'XS',
  s: 'S',
  small: 'S',
  m: 'M',
  medium: 'M',
  l: 'L',
  large: 'L',
  xl: 'XL',
  xlarge: 'XL',
  'extra large': 'XL',
  '2xl': '2XL',
  '2x': '2XL',
  '3xl': '3XL',
  '3x': '3XL',
  '4xl': '4XL',
  '4x': '4XL',
  '5xl': '5XL',
  '5x': '5XL',
  b: 'B',
};

const LABEL_BY_KEY = new Map<string, string>();
for (const size of SIZE_PAIRINGS) {
  LABEL_BY_KEY.set(cleanText(size.tag).toLowerCase(), size.label);
  LABEL_BY_KEY.set(size.label.toLowerCase(), size.label);
}
for (const [alias, label] of Object.entries(LEGACY_TAG_ALIASES)) {
  if (!LABEL_BY_KEY.has(alias)) LABEL_BY_KEY.set(alias, label);
}

export function labelForTag(tag: string): string {
  const key = cleanText(tag).toLowerCase();
  if (!key) return '';
  return LABEL_BY_KEY.get(key) ?? '';
}
