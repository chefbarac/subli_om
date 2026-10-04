import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { DueBadge } from './ui';
import { formatDate } from '@/lib/dates';
import type { Order, Stage } from '@/types';

const STAGE_PREFIX = 'stage:';
const ORDER_PREFIX = 'order:';

interface BoardViewProps {
  stages: Stage[];
  orders: Order[];
  itemCounts: Map<number, number>;
  onOpenOrder: (orderId: number) => void;
  onMoveStage: (orderId: number, stageId: number) => void;
  onNewOrder: (stageId: number) => void;
}

export function BoardView({
  stages,
  orders,
  itemCounts,
  onOpenOrder,
  onMoveStage,
  onNewOrder,
}: BoardViewProps) {
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const ordersByStage = useMemo(() => {
    const map = new Map<number, Order[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const order of orders) {
      const list = map.get(order.stageId);
      if (list) list.push(order);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    return map;
  }, [orders, stages]);

  const activeOrder = activeOrderId === null ? null : orders.find((o) => o.id === activeOrderId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith(ORDER_PREFIX)) {
      setActiveOrderId(Number(id.slice(ORDER_PREFIX.length)));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOrderId(null);
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!activeId.startsWith(ORDER_PREFIX) || !overId?.startsWith(STAGE_PREFIX)) return;
    onMoveStage(Number(activeId.slice(ORDER_PREFIX.length)), Number(overId.slice(STAGE_PREFIX.length)));
  }

  if (stages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-sm text-slate-500">
        No active stages. Add one in Settings to start using the board.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveOrderId(null)}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-3">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            orders={ordersByStage.get(stage.id) ?? []}
            itemCounts={itemCounts}
            onOpenOrder={onOpenOrder}
            onNewOrder={onNewOrder}
          />
        ))}
      </div>

      <DragOverlay>
        {activeOrder ? (
          <OrderCardContent order={activeOrder} itemCount={itemCounts.get(activeOrder.id) ?? 0} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage,
  orders,
  itemCounts,
  onOpenOrder,
  onNewOrder,
}: {
  stage: Stage;
  orders: Order[];
  itemCounts: Map<number, number>;
  onOpenOrder: (orderId: number) => void;
  onNewOrder: (stageId: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${STAGE_PREFIX}${stage.id}` });

  return (
    <section
      ref={setNodeRef}
      className={`flex h-full w-80 shrink-0 flex-col rounded-lg border transition ${
        isOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <h3 className="truncate text-sm font-bold text-slate-700">{stage.name}</h3>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
          {orders.length}
        </span>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {orders.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-400">Drag orders here</p>
        ) : (
          orders.map((order) => (
            <DraggableCard
              key={order.id}
              order={order}
              itemCount={itemCounts.get(order.id) ?? 0}
              onOpen={() => onOpenOrder(order.id)}
            />
          ))
        )}
      </div>

      <footer className="border-t border-slate-200 p-2">
        <button
          type="button"
          onClick={() => onNewOrder(stage.id)}
          className="w-full rounded-md border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-brand-400 hover:text-brand-600"
        >
          + New order
        </button>
      </footer>
    </section>
  );
}

function DraggableCard({
  order,
  itemCount,
  onOpen,
}: {
  order: Order;
  itemCount: number;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${ORDER_PREFIX}${order.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={isDragging ? 'opacity-40' : undefined}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        onClick={onOpen}
        className={`block w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-400 hover:shadow ${
          order.isCompleted ? 'opacity-60' : ''
        }`}
      >
        <OrderCardContent order={order} itemCount={itemCount} />
      </button>
    </div>
  );
}

function OrderCardContent({
  order,
  itemCount,
  overlay = false,
}: {
  order: Order;
  itemCount: number;
  overlay?: boolean;
}) {
  return (
    <div className={overlay ? 'w-72 rotate-2 rounded-lg border border-brand-400 bg-white p-3 shadow-xl' : ''}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-bold text-brand-700">{order.orderNo}</span>
        <DueBadge dueDate={order.dueDate} isCompleted={order.isCompleted} />
      </div>

      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
        {order.customerName || 'Unnamed customer'}
      </p>

      {order.product ? (
        <p className="truncate text-xs text-slate-500">{order.product}</p>
      ) : null}

      {order.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{order.description}</p>
      ) : null}

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          {itemCount} name{itemCount === 1 ? '' : 's'}
        </span>
        {order.dueDate ? <span>{formatDate(order.dueDate, 'dd MMM')}</span> : null}
      </div>
    </div>
  );
}
