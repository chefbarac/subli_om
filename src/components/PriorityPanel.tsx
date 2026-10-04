import { useMemo } from 'react';
import {
  DUE_BUCKET_ORDER,
  DUE_BUCKET_TITLES,
  dueBucket,
  dueLabel,
} from '@/lib/dates';
import type { DueBucket } from '@/lib/dates';
import type { Order } from '@/types';

const BUCKET_TONE: Record<DueBucket, string> = {
  overdue: 'bg-rose-500',
  today: 'bg-amber-500',
  week: 'bg-brand-500',
  later: 'bg-slate-300',
  none: 'bg-slate-200',
};

export function PriorityPanel({
  orders,
  itemCounts,
  selectedOrderId,
  onOpenOrder,
}: {
  orders: Order[];
  itemCounts: Map<number, number>;
  selectedOrderId: number | null;
  onOpenOrder: (orderId: number) => void;
}) {
  const grouped = useMemo(() => {
    const buckets = new Map<DueBucket, Order[]>();
    for (const bucket of DUE_BUCKET_ORDER) buckets.set(bucket, []);
    for (const order of orders) {
      buckets.get(dueBucket(order))?.push(order);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    return buckets;
  }, [orders]);

  const total = orders.length;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white no-print">
      <header className="border-b border-slate-200 px-3 py-3">
        <h2 className="text-sm font-bold text-slate-800">Priority by due date</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {total} order{total === 1 ? '' : 's'} in view
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {total === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">
            Nothing scheduled. Create an order or clear the filters.
          </p>
        ) : (
          DUE_BUCKET_ORDER.map((bucket) => {
            const list = grouped.get(bucket) ?? [];
            if (list.length === 0) return null;

            return (
              <section key={bucket} className="border-b border-slate-100 py-2 last:border-0">
                <h3 className="flex items-center gap-2 px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${BUCKET_TONE[bucket]}`} />
                  {DUE_BUCKET_TITLES[bucket]}
                  <span className="ml-auto">{list.length}</span>
                </h3>

                <ul>
                  {list.map((order) => {
                    const active = order.id === selectedOrderId;
                    return (
                      <li key={order.id}>
                        <button
                          type="button"
                          onClick={() => onOpenOrder(order.id)}
                          className={`block w-full px-3 py-2 text-left transition hover:bg-slate-50 ${
                            active ? 'bg-brand-50 ring-inset ring-2 ring-brand-300' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-slate-800">
                              {order.customerName || 'Unnamed customer'}
                            </span>
                            <span className="shrink-0 text-xs text-slate-400">
                              {itemCounts.get(order.id) ?? 0}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-brand-700">
                              {order.orderNo}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                bucket === 'overdue' ? 'text-rose-600' : 'text-slate-500'
                              }`}
                            >
                              {dueLabel(order.dueDate)}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}
