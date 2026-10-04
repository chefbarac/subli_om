import {
  EXPORT_EXCLUDED_COLUMNS,
  ITEM_COLUMNS,
  SHEET_HIDDEN_COLUMNS,
  type ColumnKey,
  type CutType,
  type Order,
  type OrderItem,
  type ProductType,
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

/** Columns that get their own cell on the printed job sheet. */
export function sheetColumns(value: unknown): ColumnKey[] {
  return normalizeColumns(value).filter((key) => !SHEET_HIDDEN_COLUMNS.includes(key));
}

export function unionColumns(orders: Array<{ columns?: unknown }>): ColumnKey[] {
  const wanted = new Set<ColumnKey>();
  for (const order of orders) {
    for (const key of exportableColumns(order.columns)) wanted.add(key);
  }
  return ITEM_COLUMNS.filter((key) => wanted.has(key));
}

/**
 * Old rows were written before `neckType` was renamed to `cutType`, and before
 * orders had a product type list. IndexedDB stores whole objects, so there is no
 * migration to run: fix the shape on read instead.
 */
export type LegacyOrderItem = Partial<OrderItem> & { neckType?: unknown; productTypeId?: unknown };
export type LegacyOrder = Partial<Order> & { product?: unknown; productTypeIds?: unknown };

export function normalizeItemFields(item: LegacyOrderItem): {
  cutType: string;
  notes: string;
  productTypeId: number | null;
} {
  const cutType = item.cutType ?? item.neckType;
  const productTypeId = item.productTypeId;
  return {
    cutType: cleanText(typeof cutType === 'string' ? cutType : ''),
    notes: cleanText(item.notes ?? ''),
    productTypeId: typeof productTypeId === 'number' ? productTypeId : null,
  };
}

export function normalizeOrderFields(order: LegacyOrder): { productTypeIds: number[] } {
  const ids = order.productTypeIds;
  if (Array.isArray(ids)) {
    return { productTypeIds: [...new Set(ids.filter((id): id is number => typeof id === 'number'))] };
  }
  return { productTypeIds: [] };
}

export function cleanStageList(stages: Stage[]): Stage[] {
  return stages.map((stage) => ({
    ...stage,
    name: cleanText(stage.name) || 'Untitled stage',
  }));
}

export function cleanProductTypeList(types: ProductType[]): ProductType[] {
  return types
    .map((type, index) => ({ ...type, name: cleanText(type.name), sortOrder: index }))
    .filter((type) => type.name !== '');
}

export function cleanCutTypeList(types: CutType[]): CutType[] {
  return types
    .map((type, index) => ({ ...type, name: cleanText(type.name), sortOrder: index }))
    .filter((type) => type.name !== '');
}

export function cleanSettings(settings: Settings): Settings {
  return {
    ...settings,
    companyName: cleanText(settings.companyName),
    receiptFooter: cleanText(settings.receiptFooter),
    currency: cleanText(settings.currency),
  };
}

/** Order of first appearance, blank names dropped, case-insensitively unique. */
export function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/** The stage a brand new order should start in. */
export function defaultStageId(stages: Stage[], preferredName = 'For Designing'): number | null {
  const preferred = stages.find(
    (stage) => stage.name.trim().toLowerCase() === preferredName.toLowerCase(),
  );
  if (preferred) return preferred.id;
  return stages.find((stage) => stage.isActive)?.id ?? stages[0]?.id ?? null;
}
