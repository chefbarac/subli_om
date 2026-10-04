import type { AppData, Settings } from '@/types';

export const DB_NAME = 'subli_om';
export const DB_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'subli_om',
  receiptFooter: 'Thank you for your business.',
  currency: 'OMR',
  exportNameCase: 'lower',
  exportLabelCase: 'upper',
  exportTagCase: 'title',
  exportPositionCase: 'as-is',
};

export const DEFAULT_STAGES = [
  'For Designing',
  'For Approval',
  'For Printing',
  'For Heatpress',
];

export const DEFAULT_SIZES: Array<[string, string]> = [
  ['Extra Small', 'XS'],
  ['Small', 'S'],
  ['Medium', 'M'],
  ['Large', 'L'],
  ['Extra Large', 'XL'],
  ['2XL', '2XL'],
  ['3XL', '3XL'],
  ['4XL', '4XL'],
  ['5XL', '5XL'],
  ['Kids Small', 'KS'],
  ['Kids Medium', 'KM'],
  ['Kids Large', 'KL'],
  ['One Size', 'OS'],
];

export const DEFAULT_POSITIONS = [
  'Manager',
  'Coach',
  'Assistant Coach',
  'Captain',
  'Vice Captain',
  'Player',
  'Goalkeeper',
  'Staff',
  'Other',
];

export function buildSeedData(): AppData {
  const stages = DEFAULT_STAGES.map((name, index) => ({
    id: index + 1,
    name,
    sortOrder: index,
    isActive: true,
  }));

  const sizes = DEFAULT_SIZES.map(([name, label], index) => ({
    id: index + 1,
    name,
    label,
    sortOrder: index,
  }));

  const positions = DEFAULT_POSITIONS.map((name, index) => ({
    id: index + 1,
    name,
    sortOrder: index,
  }));

  return {
    orders: [],
    items: [],
    stages,
    sizes,
    positions,
    settings: { ...DEFAULT_SETTINGS },
  };
}
