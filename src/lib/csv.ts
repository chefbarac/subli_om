import { applyCase } from './caseRules';
import { cleanText, unionColumns } from './normalize';
import { type ColumnKey, type Order, type OrderItem, type Settings } from '@/types';

const BOM = '\uFEFF';

const CSV_HEADERS: Partial<Record<ColumnKey, string>> = {
  name: 'name',
  jerseyNo: 'num',
  position: 'position',
  tag: 'tag',
  label: 'label',
  cutType: 'cuttype',
};

type CaseSetting =
  | 'exportNameCase'
  | 'exportPositionCase'
  | 'exportTagCase'
  | 'exportLabelCase';

const COLUMN_CASES: Partial<Record<ColumnKey, CaseSetting>> = {
  name: 'exportNameCase',
  position: 'exportPositionCase',
  tag: 'exportTagCase',
  label: 'exportLabelCase',
};

function escapeCell(value: string): string {
  const cleaned = cleanText(value);
  if (/[",\n\r]/.test(cleaned)) {
    return `"${cleaned.replace(/"/g, '""')}"`;
  }
  return cleaned;
}

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([BOM, content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildRows(
  orders: Order[],
  itemsByOrder: Map<number, OrderItem[]>,
  settings: Settings,
): string[][] {
  // The per-order export is the names list and nothing else: no order number,
  // customer, dates or stage. `unionColumns` still spans orders so a merged
  // export keeps one consistent header.
  const active = unionColumns(orders);
  const rows: string[][] = [active.map((key) => CSV_HEADERS[key] ?? key)];

  const sorted = [...orders].sort((a, b) => a.orderNo.localeCompare(b.orderNo));

  for (const order of sorted) {
    const visible = unionColumns([order]);
    const items = itemsByOrder.get(order.id) ?? [];

    const cellFor = (item: OrderItem, key: ColumnKey): string => {
      const rule = COLUMN_CASES[key];
      return rule ? applyCase(item[key], settings[rule]) : cleanText(item[key]);
    };

    if (items.length === 0) {
      rows.push(active.map(() => ''));
      continue;
    }

    for (const item of items) {
      rows.push(active.map((key) => (visible.includes(key) ? cellFor(item, key) : '')));
    }
  }

  return rows;
}

export function buildOrdersCsv(
  orders: Order[],
  items: OrderItem[],
  settings: Settings,
): string {
  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId);
    if (list) list.push(item);
    else itemsByOrder.set(item.orderId, [item]);
  }

  return toCsv(buildRows(orders, itemsByOrder, settings));
}

export function exportOrdersCsv(
  orders: Order[],
  items: OrderItem[],
  settings: Settings,
  filename: string,
): void {
  downloadTextFile(filename, buildOrdersCsv(orders, items, settings), 'text/csv;charset=utf-8');
}
