import { applyCase } from './caseRules';
import { formatDate } from './dates';
import type { Order, OrderItem, Settings } from '@/types';

const BOM = '\uFEFF';

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
  const header = [
    'Order No',
    'Customer',
    'Due Date',
    'Product',
    'Stage',
    'Name',
    'Jersey No',
    'Position',
    'Tag',
    'Label',
  ];

  const rows: string[][] = [header];

  const sorted = [...orders].sort((a, b) => a.orderNo.localeCompare(b.orderNo));

  for (const order of sorted) {
    const items = itemsByOrder.get(order.id) ?? [];
    if (items.length === 0) {
      rows.push([
        order.orderNo,
        order.customerName,
        order.dueDate ?? '',
        order.product,
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      continue;
    }

    for (const item of items) {
      rows.push([
        order.orderNo,
        order.customerName,
        order.dueDate ? formatDate(order.dueDate, 'yyyy-MM-dd') : '',
        order.product,
        '',
        applyCase(item.name, settings.exportNameCase),
        item.jerseyNo,
        applyCase(item.position, settings.exportPositionCase),
        applyCase(item.tag, settings.exportTagCase),
        applyCase(item.label, settings.exportLabelCase),
      ]);
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
