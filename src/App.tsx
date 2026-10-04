import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { BoardView } from '@/components/BoardView';
import { CalendarView } from '@/components/CalendarView';
import { JobSheet } from '@/components/JobSheet';
import { OrderEditor } from '@/components/OrderEditor';
import { PriorityPanel } from '@/components/PriorityPanel';
import { SettingsView } from '@/components/SettingsView';
import { Button, TextInput } from '@/components/ui';
import { exportOrdersCsv } from '@/lib/csv';
import { todayISO } from '@/lib/dates';
import { useApp } from '@/state/AppProvider';
import type { Order, OrderItem, ViewMode } from '@/types';

interface SheetTarget {
  order: Order;
  items: OrderItem[];
}

export function App() {
  const {
    loading,
    error,
    data,
    activeStages,
    itemCounts,
    itemsByOrder,
    moveOrderStage,
    deleteOrderById,
  } = useApp();

  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [hiddenStageIds, setHiddenStageIds] = useState<Set<number>>(new Set());

  const [editor, setEditor] = useState<{ orderId: number | null; stageId: number } | null>(null);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = todayISO();

    return data.orders.filter((order) => {
      if (!includeCompleted && order.isCompleted) return false;
      if (overdueOnly && !order.isCompleted) {
        if (!order.dueDate || order.dueDate >= today) return false;
      }
      if (term === '') return true;

      if (
        order.customerName.toLowerCase().includes(term) ||
        order.orderNo.toLowerCase().includes(term) ||
        order.description.toLowerCase().includes(term) ||
        order.product.toLowerCase().includes(term)
      ) {
        return true;
      }

      return (itemsByOrder.get(order.id) ?? []).some(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.jerseyNo.toLowerCase().includes(term) ||
          item.position.toLowerCase().includes(term),
      );
    });
  }, [data.orders, includeCompleted, itemsByOrder, overdueOnly, search]);

  const stats = useMemo(() => {
    const today = todayISO();
    let overdue = 0;
    let dueSoon = 0;
    let active = 0;
    for (const order of data.orders) {
      if (order.isCompleted) continue;
      active += 1;
      if (!order.dueDate) continue;
      if (order.dueDate < today) overdue += 1;
      else if (order.dueDate <= format(addDays(new Date(), 7), 'yyyy-MM-dd')) dueSoon += 1;
    }
    return { overdue, dueSoon, active };
  }, [data.orders]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Opening local database…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-lg font-bold text-rose-700">Could not open local storage</h1>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <p className="mt-3 text-xs text-slate-500">
            Private browsing windows can block IndexedDB. Try a normal window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 no-print">
        <h1 className="text-base font-black tracking-tight text-brand-700">subli_om</h1>

        <nav className="flex rounded-md bg-slate-100 p-0.5">
          {(['board', 'calendar'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded px-3 py-1 text-sm font-semibold capitalize transition ${
                view === mode ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              {mode}
            </button>
          ))}
        </nav>

        <TextInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer, order no, or a name…"
          className="w-64"
        />

        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          Overdue only
        </label>

        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={includeCompleted}
            onChange={(event) => setIncludeCompleted(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          Show completed
        </label>

        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold">
              {stats.active} active
            </span>
            {stats.overdue > 0 ? (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                {stats.overdue} overdue
              </span>
            ) : null}
            {stats.dueSoon > 0 ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                {stats.dueSoon} this week
              </span>
            ) : null}
          </span>

          <Button
            onClick={() =>
              exportOrdersCsv(
                visibleOrders,
                data.items,
                data.settings,
                `subli_om-orders-${todayISO()}.csv`,
              )
            }
            disabled={visibleOrders.length === 0}
          >
            Export CSV
          </Button>

          <Button onClick={() => setSettingsOpen(true)}>Settings</Button>

          <Button
            variant="primary"
            onClick={() =>
              setEditor({ orderId: null, stageId: activeStages[0]?.id ?? data.stages[0]?.id ?? 0 })
            }
          >
            + New order
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <PriorityPanel
          orders={visibleOrders}
          itemCounts={itemCounts}
          selectedOrderId={editor?.orderId ?? null}
          onOpenOrder={(orderId) => setEditor({ orderId, stageId: 0 })}
        />

        <main className="min-w-0 flex-1 overflow-hidden">
          {view === 'board' ? (
            <BoardView
              stages={activeStages}
              orders={visibleOrders}
              itemCounts={itemCounts}
              onOpenOrder={(orderId) => setEditor({ orderId, stageId: 0 })}
              onMoveStage={(orderId, stageId) => void moveOrderStage(orderId, stageId)}
              onNewOrder={(stageId) => setEditor({ orderId: null, stageId })}
            />
          ) : (
            <CalendarView
              orders={visibleOrders}
              stages={activeStages}
              hiddenStageIds={hiddenStageIds}
              onToggleStageVisible={(stageId) =>
                setHiddenStageIds((current) => {
                  const next = new Set(current);
                  if (next.has(stageId)) next.delete(stageId);
                  else next.add(stageId);
                  return next;
                })
              }
              onOpenOrder={(orderId) => setEditor({ orderId, stageId: 0 })}
            />
          )}
        </main>
      </div>

      {editor ? (
        <OrderEditor
          orderId={editor.orderId}
          initialStageId={editor.stageId}
          onClose={() => setEditor(null)}
          onPrintSheet={(order, items) => setSheet({ order, items })}
          onDelete={(orderId) => void deleteOrderById(orderId)}
        />
      ) : null}

      {sheet ? (
        <JobSheet
          order={sheet.order}
          items={sheet.items}
          settings={data.settings}
          stageName={data.stages.find((stage) => stage.id === sheet.order.stageId)?.name ?? ''}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {settingsOpen ? <SettingsView onClose={() => setSettingsOpen(false)} /> : null}

      {data.orders.length === 0 && view === 'board' ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          No orders yet — click <span className="text-brand-300">+ New order</span> to create the
          first one. Everything is saved in this browser.
        </div>
      ) : null}

      </div>
  );
}
