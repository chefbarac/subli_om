import { useMemo, useState } from 'react';
import { format, isSameMonth, isToday } from 'date-fns';
import { stageTone } from '@/lib/colors';
import { formatDate, monthMatrix, shiftMonth } from '@/lib/dates';
import { Button } from './ui';
import type { Order, Stage } from '@/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView({
  orders,
  stages,
  hiddenStageIds,
  onToggleStageVisible,
  onOpenOrder,
}: {
  orders: Order[];
  stages: Stage[];
  hiddenStageIds: Set<number>;
  onToggleStageVisible: (stageId: number) => void;
  onOpenOrder: (orderId: number) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const visibleOrders = useMemo(
    () => orders.filter((order) => !hiddenStageIds.has(order.stageId)),
    [hiddenStageIds, orders],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of visibleOrders) {
      if (!order.dueDate) continue;
      const list = map.get(order.dueDate);
      if (list) list.push(order);
      else map.set(order.dueDate, [order]);
    }
    return map;
  }, [visibleOrders]);

  const noDateOrders = useMemo(
    () => visibleOrders.filter((order) => !order.dueDate),
    [visibleOrders],
  );

  const days = useMemo(() => monthMatrix(anchor), [anchor]);
  const selectedOrders = byDate.get(selectedDate) ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden p-3">
      <div className="flex flex-wrap items-center gap-3 pb-3">
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={() => setAnchor((d) => shiftMonth(d, -1))} aria-label="Previous month">
            ‹
          </Button>
          <span className="w-40 text-center text-sm font-bold text-slate-800">
            {format(anchor, 'MMMM yyyy')}
          </span>
          <Button size="sm" onClick={() => setAnchor((d) => shiftMonth(d, 1))} aria-label="Next month">
            ›
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAnchor(new Date());
              setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
            }}
          >
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-l border-slate-200 pl-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Show stages
          </span>
          {stages.map((stage) => {
            const checked = !hiddenStageIds.has(stage.id);
            return (
              <label
                key={stage.id}
                className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleStageVisible(stage.id)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                />
                <span className={`h-2.5 w-2.5 rounded-full ${stageTone(stage.sortOrder).dot}`} />
                {stage.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid flex-1 auto-rows-fr grid-cols-7">
            {days.map((day) => {
              const iso = format(day, 'yyyy-MM-dd');
              const dayOrders = byDate.get(iso) ?? [];
              const selected = iso === selectedDate;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDate(iso)}
                  className={`flex min-h-0 flex-col items-stretch gap-1 border-b border-r border-slate-100 p-1.5 text-left align-top transition hover:bg-slate-50 ${
                    selected ? 'bg-brand-50 ring-inset ring-2 ring-brand-300' : ''
                  } ${isSameMonth(day, anchor) ? '' : 'bg-slate-50/60'}`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      isToday(day)
                        ? 'bg-brand-600 text-white'
                        : isSameMonth(day, anchor)
                          ? 'text-slate-600'
                          : 'text-slate-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  <div className="min-h-0 space-y-0.5 overflow-hidden">
                    {dayOrders.slice(0, 3).map((order) => {
                      const stage = stageById.get(order.stageId);
                      const tone = stageTone(stage?.sortOrder ?? 0);
                      return (
                        <span
                          key={order.id}
                          className={`block truncate rounded px-1 py-0.5 text-[10px] font-semibold ring-1 ${tone.chip}`}
                        >
                          {order.customerName || order.orderNo}
                        </span>
                      );
                    })}
                    {dayOrders.length > 3 ? (
                      <span className="block px-1 text-[10px] font-semibold text-slate-400">
                        +{dayOrders.length - 3} more
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-3 py-2">
            <h3 className="text-sm font-bold text-slate-800">
              {formatDate(selectedDate, 'EEEE, dd MMMM yyyy')}
            </h3>
            <p className="text-xs text-slate-500">
              {selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'} due
            </p>
          </header>

          <div className="flex-1 overflow-y-auto">
            {selectedOrders.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">Nothing due on this day.</p>
            ) : (
              <ul>
                {selectedOrders.map((order) => {
                  const stage = stageById.get(order.stageId);
                  const tone = stageTone(stage?.sortOrder ?? 0);
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        onClick={() => onOpenOrder(order.id)}
                        className="block w-full px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
                          <span className="truncate text-sm font-semibold text-slate-800">
                            {order.customerName || 'Unnamed customer'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono text-brand-700">{order.orderNo}</span>
                          <span className="text-slate-400">{stage?.name ?? ''}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {noDateOrders.length > 0 ? (
              <div className="border-t border-slate-200 p-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Unscheduled ({noDateOrders.length})
                </h4>
                <ul className="mt-1 space-y-1">
                  {noDateOrders.slice(0, 12).map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        onClick={() => onOpenOrder(order.id)}
                        className="w-full truncate rounded px-1 py-0.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                      >
                        {order.customerName || 'Unnamed customer'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
