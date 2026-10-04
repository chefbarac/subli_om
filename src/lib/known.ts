import { cleanText } from './normalize';
import type { Order, OrderItem } from '@/types';

export interface KnownValues {
  customers: string[];
  products: string[];
  positions: string[];
  neckTypes: string[];
}

const MAX_SUGGESTIONS = 40;

function tally(values: string[]): string[] {
  const counts = new Map<string, { count: number; label: string }>();

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, label: cleaned });
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.label);
}

export function collectKnownValues(orders: Order[], items: OrderItem[]): KnownValues {
  return {
    customers: tally(orders.map((order) => order.customerName)),
    products: tally(orders.map((order) => order.product)),
    positions: tally(items.map((item) => item.position)),
    neckTypes: tally(items.map((item) => item.neckType)),
  };
}

export function suggestionsFor(
  known: KnownValues,
  field: keyof KnownValues,
  current: string,
): string[] {
  const cleaned = cleanText(current).toLowerCase();
  if (!cleaned) return known[field];
  const prefix = known[field].filter((value) => value.toLowerCase().startsWith(cleaned));
  const contains = known[field].filter(
    (value) =>
      !value.toLowerCase().startsWith(cleaned) && value.toLowerCase().includes(cleaned),
  );
  return [...prefix, ...contains];
}
