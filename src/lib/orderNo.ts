import type { Order } from '@/types';

const ORDER_NO_PREFIX = 'ORD-';

export function nextOrderNo(orders: Order[], year = new Date().getFullYear()): string {
  const pattern = new RegExp(`^${ORDER_NO_PREFIX}${year}-(\\d+)$`);
  let max = 0;
  for (const order of orders) {
    const match = pattern.exec(order.orderNo);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `${ORDER_NO_PREFIX}${year}-${String(max + 1).padStart(4, '0')}`;
}
