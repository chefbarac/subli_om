import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { exportOrdersCsv } from '@/lib/csv';
import { cleanText, normalizeColumns } from '@/lib/normalize';
import { suggestionsFor, type KnownValues } from '@/lib/known';

import { SIZE_TAGS, labelForTag } from '@/lib/sizes';
import { useApp, type EditableRow } from '@/state/AppProvider';
import { Button, Field, Modal, Select, TextArea, TextInput } from './ui';
import {
  COLUMN_LABELS,
  EXPORT_EXCLUDED_COLUMNS,
  ITEM_COLUMNS,
  TOGGLEABLE_COLUMNS,
  type ColumnKey,
  type Order,
  type OrderItem,
} from '@/types';

interface RowState extends EditableRow {
  key: string;
}

let rowCounter = 0;
function nextKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function blankRow(): RowState {
  return {
    key: nextKey(),
    name: '',
    jerseyNo: '',
    position: '',
    neckType: '',
    tag: '',
    label: '',
    notes: '',
  };
}

function toRowState(item: OrderItem): RowState {
  return {
    key: `db-${item.id}`,
    id: item.id,
    name: item.name ?? '',
    jerseyNo: item.jerseyNo ?? '',
    position: item.position ?? '',
    neckType: item.neckType ?? '',
    tag: item.tag ?? '',
    label: item.label ?? '',
    notes: item.notes ?? '',
  };
}

function hasContent(row: RowState): boolean {
  return Boolean(
    cleanText(row.name) || cleanText(row.jerseyNo) || cleanText(row.position) || cleanText(row.tag),
  );
}

function Options({ id, values }: { id: string; values: string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  );
}

export function OrderEditor({
  orderId,
  initialStageId,
  onClose,
  onPrintSheet,
  onDelete,
}: {
  orderId: number | null;
  initialStageId: number;
  onClose: () => void;
  onPrintSheet: (order: Order, items: OrderItem[]) => void;
  onDelete: (orderId: number) => void;
}) {
  const { data, known, activeStages, itemsByOrder, itemCounts, suggestOrderNo, saveOrder } =
    useApp();

  const existing =
    orderId === null ? null : data.orders.find((order) => order.id === orderId) ?? null;

  const [orderNo, setOrderNo] = useState(existing?.orderNo ?? suggestOrderNo());
  const [customerName, setCustomerName] = useState(existing?.customerName ?? '');
  const [product, setProduct] = useState(existing?.product ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '');
  const [stageId, setStageId] = useState(() => {
    if (existing) return existing.stageId;
    if (data.stages.some((stage) => stage.id === initialStageId)) return initialStageId;
    return activeStages[0]?.id ?? data.stages[0]?.id ?? 0;
  });
  const [isCompleted, setIsCompleted] = useState(existing?.isCompleted ?? false);
  const [columns, setColumns] = useState<ColumnKey[]>(
    () => normalizeColumns(existing?.columns),
  );

  const [rows, setRows] = useState<RowState[]>(() => {
    if (orderId === null) return [blankRow()];
    const items = itemsByOrder.get(orderId) ?? [];
    return items.length > 0 ? items.map(toRowState) : [blankRow()];
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const customerOptions = useMemo(
    () => suggestionsFor(known, 'customers', customerName),
    [customerName, known],
  );
  const productOptions = useMemo(
    () => suggestionsFor(known, 'products', product),
    [known, product],
  );

  function updateRow(key: string, patch: Partial<RowState>) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.tag !== undefined) {
          next.label = labelForTag(next.tag);
        }
        return next;
      }),
    );
  }

  function toggleColumn(key: ColumnKey) {
    setColumns((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : normalizeColumns([...current, key]),
    );
  }

  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((current) => {
      const from = current.findIndex((row) => row.key === active.id);
      const to = current.findIndex((row) => row.key === over.id);
      if (from < 0 || to < 0) return current;
      return arrayMove(current, from, to);
    });
  }

  const draftOrder: Order = {
    id: existing?.id ?? 0,
    orderNo: cleanText(orderNo),
    customerName: cleanText(customerName),
    product: cleanText(product),
    description: cleanText(description),
    dueDate: dueDate || null,
    stageId,
    columns,
    isCompleted,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const draftItems: OrderItem[] = useMemo(
    () =>
      rows
        .filter(hasContent)
        .map((row, index) => ({
          id: row.id ?? -(index + 1),
          orderId: draftOrder.id,
          seq: index,
          name: cleanText(row.name),
          jerseyNo: cleanText(row.jerseyNo),
          position: cleanText(row.position),
          neckType: cleanText(row.neckType),
          tag: cleanText(row.tag),
          label: cleanText(row.label) || labelForTag(cleanText(row.tag)),
          notes: cleanText(row.notes),
        })),
    [draftOrder.id, rows],
  );

  function handleSave() {
    if (!draftOrder.orderNo) {
      setError('Order number is required.');
      return;
    }
    if (!draftOrder.customerName && !draftOrder.description) {
      setError('Add a customer name or an order description.');
      return;
    }
    if (draftItems.length === 0) {
      setError('Add at least one name to the list.');
      return;
    }

    setSaving(true);
    setError(null);

    const editable: EditableRow[] = draftItems.map((item) => ({
      id: item.id > 0 ? item.id : undefined,
      name: item.name,
      jerseyNo: item.jerseyNo,
      position: item.position,
      neckType: item.neckType,
      tag: item.tag,
      label: item.label,
      notes: item.notes,
    }));

    saveOrder(draftOrder, editable, existing?.id)
      .then(() => onClose())
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not save the order.');
        setSaving(false);
      });
  }

  function handleExport() {
    exportOrdersCsv([draftOrder], draftItems, data.settings, `${draftOrder.orderNo}.csv`);
  }

  return (
    <Modal
      title={existing ? `Edit ${existing.orderNo}` : 'New order'}
      subtitle={
        existing
          ? `Created ${existing.createdAt.slice(0, 10)}`
          : 'Order number is generated automatically and stays editable.'
      }
      size="xl"
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(`Delete ${existing.orderNo} and all its names?`)) {
                  onDelete(existing.id);
                  onClose();
                }
              }}
            >
              Delete order
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button onClick={handleExport}>Export CSV</Button>
          <Button onClick={() => onPrintSheet(draftOrder, draftItems)}>Print job sheet</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save order'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Order number">
            <div className="flex gap-1.5">
              <TextInput
                value={orderNo}
                onChange={(event) => setOrderNo(event.target.value)}
                className="font-mono"
              />
              <Button onClick={() => setOrderNo(suggestOrderNo())} title="Regenerate">
                ↻
              </Button>
            </div>
          </Field>

          <Field label="Customer name">
            <TextInput
              list="known-customers"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="e.g. Muscat Sports Club"
            />
          </Field>

          <Field label="Product">
            <TextInput
              list="known-products"
              value={product}
              onChange={(event) => setProduct(event.target.value)}
              placeholder="e.g. Navy jersey, full sublimation"
            />
          </Field>

          <Field label="Due date">
            <TextInput
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>

          <Field label="Stage">
            <Select value={stageId} onChange={(event) => setStageId(Number(event.target.value))}>
              {data.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                  {stage.isActive ? '' : ' (hidden)'}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status">
            <label className="flex h-[34px] items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(event) => setIsCompleted(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              Mark as completed
            </label>
          </Field>

          <Field label="Order description" className="md:col-span-3">
            <TextArea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. 22 players + 2 coaches, name and number only, deliver before match day"
            />
          </Field>
        </div>

        <ItemTable
          rows={rows}
          columns={columns}
          known={known}
          customerOptions={customerOptions}
          productOptions={productOptions}
          sensors={sensors}
          onDragEnd={handleRowDragEnd}
          onUpdate={updateRow}
          onToggleColumn={toggleColumn}
          onRemove={(key) => setRows((current) => current.filter((row) => row.key !== key))}
          onAdd={() => setRows((current) => [...current, blankRow()])}
        />

        <p className="text-xs text-slate-500">
          {draftItems.length} name{draftItems.length === 1 ? '' : 's'} in this order
          {existing ? ` · ${itemCounts.get(existing.id) ?? 0} currently saved` : ''}
        </p>
      </div>
    </Modal>
  );
}

function ItemTable({
  rows,
  columns,
  known,
  customerOptions,
  productOptions,
  sensors,
  onDragEnd,
  onUpdate,
  onToggleColumn,
  onRemove,
  onAdd,
}: {
  rows: RowState[];
  columns: ColumnKey[];
  known: KnownValues;
  customerOptions: string[];
  productOptions: string[];
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  onUpdate: (key: string, patch: Partial<RowState>) => void;
  onToggleColumn: (key: ColumnKey) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  const visible = ITEM_COLUMNS.filter((key) => columns.includes(key));

  return (
    <section>
      <header className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-700">
          Names list ({rows.length} row{rows.length === 1 ? '' : 's'})
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Columns
          </span>
          {TOGGLEABLE_COLUMNS.map((key) => (
            <label
              key={key}
              className="flex items-center gap-1.5 text-xs text-slate-600"
              title={
                EXPORT_EXCLUDED_COLUMNS.includes(key)
                  ? `${COLUMN_LABELS[key]} is never included in the CSV export`
                  : undefined
              }
            >
              <input
                type="checkbox"
                checked={columns.includes(key)}
                onChange={() => onToggleColumn(key)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              {COLUMN_LABELS[key]}
              {EXPORT_EXCLUDED_COLUMNS.includes(key) ? (
                <span className="rounded bg-slate-100 px-1 text-[10px] font-bold uppercase text-slate-500">
                  no csv
                </span>
              ) : null}
            </label>
          ))}
          <span className="text-xs text-slate-400">Name always shown</span>
        </div>
        <Button size="sm" onClick={onAdd}>
          + Add row
        </Button>
      </header>

      <Options id="known-customers" values={customerOptions} />
      <Options id="known-products" values={productOptions} />
      <Options id="known-positions" values={known.positions} />
      <Options id="known-neck-types" values={known.neckTypes} />
      <Options id="size-tags" values={SIZE_TAGS} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={rows.map((row) => row.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['#', ...visible.map((key) => COLUMN_LABELS[key]), ''].map(
                    (heading, index) => (
                      <th
                        key={`${heading}-${index}`}
                        className="border-b border-slate-200 px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <SortableRow key={row.key} id={row.key} index={index}>
                    {visible.includes('name') ? (
                      <td>
                        <TextInput
                          value={row.name}
                          onChange={(event) => onUpdate(row.key, { name: event.target.value })}
                          placeholder="Full name"
                        />
                      </td>
                    ) : null}
                    {visible.includes('jerseyNo') ? (
                      <td className="w-24">
                        <TextInput
                          value={row.jerseyNo}
                          onChange={(event) => onUpdate(row.key, { jerseyNo: event.target.value })}
                          className="text-center font-mono"
                          placeholder="10"
                        />
                      </td>
                    ) : null}
                    {visible.includes('position') ? (
                      <td className="w-40">
                        <TextInput
                          list="known-positions"
                          value={row.position}
                          onChange={(event) => onUpdate(row.key, { position: event.target.value })}
                          placeholder="Player"
                        />
                      </td>
                    ) : null}
                    {visible.includes('neckType') ? (
                      <td className="w-40">
                        <TextInput
                          list="known-neck-types"
                          value={row.neckType}
                          onChange={(event) => onUpdate(row.key, { neckType: event.target.value })}
                          placeholder="Round Neck"
                        />
                      </td>
                    ) : null}
                    {visible.includes('tag') ? (
                      <td className="w-36">
                        <TextInput
                          list="size-tags"
                          value={row.tag}
                          onChange={(event) => onUpdate(row.key, { tag: event.target.value })}
                          placeholder="Large"
                        />
                      </td>
                    ) : null}
                    {visible.includes('label') ? (
                      <td className="w-24">
                        <TextInput
                          value={row.label}
                          onChange={(event) => onUpdate(row.key, { label: event.target.value })}
                          title="Auto-filled from the tag, and refreshed whenever the tag changes."
                          className="text-center font-semibold uppercase"
                          placeholder="L"
                        />
                      </td>
                    ) : null}
                    {visible.includes('notes') ? (
                      <td className="w-44">
                        <TextInput
                          value={row.notes}
                          onChange={(event) => onUpdate(row.key, { notes: event.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                    ) : null}
                    <td className="w-10 whitespace-nowrap px-1 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(row.key)}
                        className="rounded px-1.5 py-1 text-xs text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </SortableRow>
                ))}
              </tbody>
            </table>
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableRow({
  id,
  index,
  children,
}: {
  id: string;
  index: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`align-middle ${isDragging ? 'relative z-10 bg-brand-50 opacity-80 shadow-lg' : ''}`}
    >
      <td className="w-12 whitespace-nowrap px-2 py-1">
        <span className="flex items-center gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder row ${index + 1}`}
            className="cursor-grab touch-none rounded px-0.5 text-sm leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
          >
            ⠿
          </button>
          <span className="text-xs text-slate-400">{index + 1}</span>
        </span>
      </td>
      {children}
    </tr>
  );
}
