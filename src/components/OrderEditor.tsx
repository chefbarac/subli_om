import { useMemo, useState } from 'react';
import { exportOrdersCsv } from '@/lib/csv';
import { parsePastedNames } from '@/lib/paste';
import { labelForTag } from '@/lib/sizes';
import { useApp, type EditableRow } from '@/state/AppProvider';
import { Button, Field, Modal, Select, TextArea, TextInput } from './ui';
import type { Order, OrderItem, SizeOption } from '@/types';

interface RowState extends EditableRow {
  key: string;
  labelManual: boolean;
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
    tag: '',
    label: '',
    labelManual: false,
  };
}

function toRowState(item: OrderItem): RowState {
  const { id, ...rest } = item;
  return { key: `db-${id}`, id, ...rest, labelManual: true };
}

function hasContent(row: RowState): boolean {
  return Boolean(row.name.trim() || row.jerseyNo.trim() || row.position.trim() || row.tag.trim());
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
  const { data, activeStages, itemsByOrder, itemCounts, suggestOrderNo, saveOrder } = useApp();

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

  const [rows, setRows] = useState<RowState[]>(() => {
    if (orderId === null) return [blankRow()];
    const items = itemsByOrder.get(orderId) ?? [];
    return items.length > 0 ? items.map(toRowState) : [blankRow()];
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const positionNames = useMemo(() => data.positions.map((p) => p.name), [data.positions]);
  const sizeNames = useMemo(() => data.sizes.map((s) => s.name), [data.sizes]);

  function updateRow(key: string, patch: Partial<RowState>) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.tag !== undefined && !next.labelManual) {
          next.label = labelForTag(next.tag, data.sizes);
        }
        return next;
      }),
    );
  }

  const draftOrder: Order = {
    id: existing?.id ?? 0,
    orderNo: orderNo.trim(),
    customerName: customerName.trim(),
    product: product.trim(),
    description: description.trim(),
    dueDate: dueDate || null,
    stageId,
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
          name: row.name.trim(),
          jerseyNo: row.jerseyNo.trim(),
          position: row.position.trim(),
          tag: row.tag.trim(),
          label: row.label.trim() || labelForTag(row.tag, data.sizes),
        })),
    [data.sizes, draftOrder.id, rows],
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
      tag: item.tag,
      label: item.label,
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
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="e.g. Muscat Sports Club"
            />
          </Field>

          <Field label="Product">
            <TextInput
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

        <PastePanel
          sizes={data.sizes}
          onAppend={(items) => {
            setRows((current) => {
              const tail = current[current.length - 1];
              const base = tail && !hasContent(tail) ? current.slice(0, -1) : current;
              const appended: RowState[] = items.map((item) => ({
                ...item,
                key: nextKey(),
                labelManual: false,
              }));
              return [...base, ...appended];
            });
          }}
        />

        <ItemTable
          rows={rows}
          sizeNames={sizeNames}
          positionNames={positionNames}
          onUpdate={updateRow}
          onRemove={(key) => setRows((current) => current.filter((row) => row.key !== key))}
          onMove={(key, direction) =>
            setRows((current) => {
              const index = current.findIndex((row) => row.key === key);
              const target = index + direction;
              if (index < 0 || target < 0 || target >= current.length) return current;
              const next = [...current];
              const [moved] = next.splice(index, 1);
              next.splice(target, 0, moved);
              return next;
            })
          }
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

function PastePanel({
  sizes,
  onAppend,
}: {
  sizes: SizeOption[];
  onAppend: (items: EditableRow[]) => void;
}) {
  const [text, setText] = useState('');

  const preview = useMemo(
    () => (text.trim() ? parsePastedNames(text, sizes) : null),
    [sizes, text],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Paste names from Excel or Sheets</h3>
          <p className="text-xs text-slate-500">
            Copy the cells and paste below. Columns are matched by header (name, jersey no,
            position, tag/size, label) or read in that order when no header is present.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {preview ? (
            <Button size="sm" onClick={() => setText('')}>
              Clear
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            disabled={!preview || preview.items.length === 0}
            onClick={() => {
              onAppend(preview?.items ?? []);
              setText('');
            }}
          >
            Add {preview?.items.length ?? 0} name(s)
          </Button>
        </div>
      </header>

      <TextArea
        rows={4}
        className="mt-2 font-mono text-xs"
        placeholder={'Ahmed\t10\tCaptain\tLarge\nBilal\t7\tPlayer\tMedium'}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {preview ? (
        <div className="mt-2 rounded border border-slate-200 bg-white p-2 text-xs">
          <p className="font-semibold text-slate-600">
            {preview.items.length} row(s) detected
            {preview.headerDetected ? ' · header row recognised' : ' · using default column order'}
          </p>
          {preview.items.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-slate-500">
              {preview.items.slice(0, 5).map((item, index) => (
                <li key={index} className="truncate">
                  {item.name || '—'} · {item.jerseyNo || '—'} · {item.position || '—'} ·{' '}
                  {item.tag || '—'} · {item.label || '—'}
                </li>
              ))}
              {preview.items.length > 5 ? <li>…and {preview.items.length - 5} more</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ItemTable({
  rows,
  sizeNames,
  positionNames,
  onUpdate,
  onRemove,
  onMove,
  onAdd,
}: {
  rows: RowState[];
  sizeNames: string[];
  positionNames: string[];
  onUpdate: (key: string, patch: Partial<RowState>) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onAdd: () => void;
}) {
  return (
    <section>
      <header className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">
          Names list ({rows.length} row{rows.length === 1 ? '' : 's'})
        </h3>
        <Button size="sm" onClick={onAdd}>
          + Add row
        </Button>
      </header>

      <datalist id="size-options">
        {sizeNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="position-options">
        {positionNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['#', 'Name', 'Jersey No', 'Position', 'Tag (size)', 'Label', ''].map(
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
              <tr key={row.key} className="align-middle">
                <td className="w-8 px-2 py-1 text-center text-xs text-slate-400">{index + 1}</td>
                <td>
                  <TextInput
                    value={row.name}
                    onChange={(event) => onUpdate(row.key, { name: event.target.value })}
                    placeholder="Full name"
                  />
                </td>
                <td className="w-24">
                  <TextInput
                    value={row.jerseyNo}
                    onChange={(event) => onUpdate(row.key, { jerseyNo: event.target.value })}
                    className="text-center font-mono"
                    placeholder="10"
                  />
                </td>
                <td className="w-40">
                  <TextInput
                    list="position-options"
                    value={row.position}
                    onChange={(event) => onUpdate(row.key, { position: event.target.value })}
                    placeholder="Player"
                  />
                </td>
                <td className="w-40">
                  <TextInput
                    list="size-options"
                    value={row.tag}
                    onChange={(event) => onUpdate(row.key, { tag: event.target.value })}
                    placeholder="Large"
                  />
                </td>
                <td className="w-24">
                  <TextInput
                    value={row.label}
                    onChange={(event) =>
                      onUpdate(row.key, { label: event.target.value, labelManual: true })
                    }
                    className="text-center font-semibold uppercase"
                    placeholder="L"
                  />
                </td>
                <td className="w-24 whitespace-nowrap px-1 text-right">
                  <button
                    type="button"
                    onClick={() => onMove(row.key, -1)}
                    className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Move row up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(row.key, 1)}
                    className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Move row down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(row.key)}
                    className="rounded px-1.5 py-1 text-xs text-rose-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
