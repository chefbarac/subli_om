import { cleanText, uniqueNames } from './normalize';
import type { Order, OrderItem } from '@/types';

export interface KnownValues {
  customers: string[];
  positions: string[];
  cutTypes: string[];
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

export function collectKnownValues(
  orders: Order[],
  items: OrderItem[],
  configuredCutTypes: string[] = [],
): KnownValues {
  return {
    customers: tally(orders.map((order) => order.customerName)),
    positions: tally(items.map((item) => item.position)),
    // The Settings list comes first because those are the sanctioned values;
    // anything typed by hand since is appended so it still gets offered.
    cutTypes: uniqueNames([
      ...configuredCutTypes,
      ...tally(items.map((item) => item.cutType)),
    ]),
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
