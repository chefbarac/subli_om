import {
  EXPORT_EXCLUDED_COLUMNS,
  ITEM_COLUMNS,
  type ColumnKey,
  type OrderItem,
  type Settings,
  type Stage,
} from '@/types';

const TRAILING_LINE_SPACE = /[ \t]+$/gm;

export function cleanText(value: string): string {
  return value.replace(TRAILING_LINE_SPACE, '').trim();
}

export function normalizeColumns(value: unknown): ColumnKey[] {
  if (!Array.isArray(value)) return [...ITEM_COLUMNS];
  const wanted = new Set(value.filter((key): key is ColumnKey =>
    (ITEM_COLUMNS as readonly string[]).includes(key as string),
  ));
  wanted.add('name');
  return ITEM_COLUMNS.filter((key) => wanted.has(key));
}

/** Columns that are never written to the CSV, whatever the order shows. */
export function exportableColumns(value: unknown): ColumnKey[] {
  return normalizeColumns(value).filter(
    (key) => !EXPORT_EXCLUDED_COLUMNS.includes(key),
  );
}

export function unionColumns(orders: Array<{ columns?: unknown }>): ColumnKey[] {
  const wanted = new Set<ColumnKey>();
  for (const order of orders) {
    for (const key of exportableColumns(order.columns)) wanted.add(key);
  }
  return ITEM_COLUMNS.filter((key) => wanted.has(key));
}

export function normalizeItemFields(item: Partial<OrderItem>): {
  neckType: string;
  notes: string;
} {
  return {
    neckType: cleanText(item.neckType ?? ''),
    notes: cleanText(item.notes ?? ''),
  };
}

export function cleanStageList(stages: Stage[]): Stage[] {
  return stages.map((stage) => ({
    ...stage,
    name: cleanText(stage.name) || 'Untitled stage',
  }));
}

export function cleanSettings(settings: Settings): Settings {
  return {
    ...settings,
    companyName: cleanText(settings.companyName),
    receiptFooter: cleanText(settings.receiptFooter),
    currency: cleanText(settings.currency),
  };
}
