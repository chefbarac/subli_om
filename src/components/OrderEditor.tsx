import { useEffect, useMemo, useRef, useState } from 'react';
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
import { csvFileRejection, decodeCsvBytes } from '@/lib/csvFile';
import { cleanText, defaultStageId, normalizeColumns } from '@/lib/normalize';
import { suggestionsFor, type KnownValues } from '@/lib/known';
import { mergePastedRows, nameKey, parsePastedNames, type PasteMerge } from '@/lib/paste';

import { SIZE_LABELS, SIZE_TAGS, labelForTag } from '@/lib/sizes';
import { useApp, type EditableRow } from '@/state/AppProvider';
import { Button, Field, Modal, Select, TextArea, TextInput } from './ui';
import {
  COLUMN_LABELS,
  EXPORT_EXCLUDED_COLUMNS,
  ITEM_COLUMNS,
  TOGGLEABLE_COLUMNS,
  type ColumnKey,
  type ItemDraft,
  type Order,
  type OrderItem,
  type ProductType,
} from '@/types';

interface RowState extends EditableRow {
  key: string;
}

let rowCounter = 0;
function nextKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function blankRow(productTypeId: number | null): RowState {
  return {
    key: nextKey(),
    name: '',
    jerseyNo: '',
    position: '',
    cutType: '',
    tag: '',
    label: '',
    notes: '',
    productTypeId,
  };
}

function toRowState(item: OrderItem): RowState {
  return {
    key: `db-${item.id}`,
    id: item.id,
    name: item.name ?? '',
    jerseyNo: item.jerseyNo ?? '',
    position: item.position ?? '',
    cutType: item.cutType ?? '',
    tag: item.tag ?? '',
    label: item.label ?? '',
    notes: item.notes ?? '',
    productTypeId: item.productTypeId ?? null,
  };
}

function hasContent(row: RowState): boolean {
  return Boolean(
    cleanText(row.name) || cleanText(row.jerseyNo) || cleanText(row.position) || cleanText(row.tag),
  );
}

/** A pasted row joins the order's first product type, same as "+ Add row". */
function rowFromDraft(item: ItemDraft, productTypeId: number | null): RowState {
  return {
    key: nextKey(),
    name: item.name,
    jerseyNo: item.jerseyNo,
    position: item.position,
    cutType: item.cutType,
    tag: item.tag,
    label: item.label,
    notes: item.notes,
    productTypeId,
  };
}

/**
 * Tag and Label are strict dropdowns. An order saved before the size table was
 * fixed can still hold a legacy spelling, so keep it selectable rather than
 * silently blanking the row when it is opened.
 */
function tagOptions(current: string): string[] {
  const value = cleanText(current);
  return value && !SIZE_TAGS.includes(value) ? [value, ...SIZE_TAGS] : SIZE_TAGS;
}

function labelOptions(current: string): string[] {
  const value = cleanText(current);
  return value && !SIZE_LABELS.includes(value) ? [value, ...SIZE_LABELS] : SIZE_LABELS;
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
  const { data, known, itemsByOrder, itemCounts, suggestOrderNo, saveOrder } = useApp();

  const existing =
    orderId === null ? null : data.orders.find((order) => order.id === orderId) ?? null;

  const productTypes = data.productTypes;

  const [orderNo, setOrderNo] = useState(existing?.orderNo ?? suggestOrderNo());
  const [customerName, setCustomerName] = useState(existing?.customerName ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '');
  const [stageId, setStageId] = useState(() => {
    // A new order always starts at "For Designing", whatever column it was
    // created from, so it lands in the design queue.
    if (existing) return existing.stageId;
    return defaultStageId(data.stages) ?? initialStageId;
  });
  const [isCompleted, setIsCompleted] = useState(existing?.isCompleted ?? false);
  const [columns, setColumns] = useState<ColumnKey[]>(
    () => normalizeColumns(existing?.columns),
  );
  const [productTypeIds, setProductTypeIds] = useState<number[]>(
    () => existing?.productTypeIds ?? productTypes.map((t) => t.id),
  );

  const [rows, setRows] = useState<RowState[]>(() => {
    const fallbackType = existing?.productTypeIds[0] ?? productTypes[0]?.id ?? null;
    if (orderId === null) return [blankRow(fallbackType)];
    const items = itemsByOrder.get(orderId) ?? [];
    return items.length > 0 ? items.map(toRowState) : [blankRow(fallbackType)];
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const customerOptions = useMemo(
    () => suggestionsFor(known, 'customers', customerName),
    [customerName, known],
  );

  /** New rows join the first type so nothing starts out unassigned. */
  const newRowType = productTypeIds[0] ?? productTypes[0]?.id ?? null;
  const showTypeColumn = productTypes.length > 0;

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

  function toggleProductType(id: number) {
    setProductTypeIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function setAllRowsToType(id: number) {
    setRows((current) => current.map((row) => ({ ...row, productTypeId: id })));
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
    description: cleanText(description),
    dueDate: dueDate || null,
    stageId,
    productTypeIds,
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
          cutType: cleanText(row.cutType),
          tag: cleanText(row.tag),
          label: cleanText(row.label) || labelForTag(cleanText(row.tag)),
          notes: cleanText(row.notes),
          productTypeId: row.productTypeId ?? null,
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
      cutType: item.cutType,
      tag: item.tag,
      label: item.label,
      notes: item.notes,
      productTypeId: item.productTypeId,
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

  function applyPastedRows(merged: PasteMerge<RowState>) {
    setRows(merged.rows);
    setPasteOpen(false);
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

        <ProductTypePicker
          types={productTypes}
          selected={productTypeIds}
          rowCount={rows.length}
          onToggle={toggleProductType}
          onSetAll={setAllRowsToType}
        />

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

          <Field label="Status" as="div">
            <span className="flex h-[34px] items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(event) => setIsCompleted(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              Mark as completed
            </span>
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
          productTypes={productTypes}
          showTypeColumn={showTypeColumn}
          sensors={sensors}
          onDragEnd={handleRowDragEnd}
          onUpdate={updateRow}
          onToggleColumn={toggleColumn}
          onRemove={(key) => setRows((current) => current.filter((row) => row.key !== key))}
          onAdd={() => setRows((current) => [...current, blankRow(newRowType)])}
          onPaste={() => setPasteOpen(true)}
        />

        {pasteOpen ? (
          <PasteCsvModal
            rows={rows}
            productTypeId={newRowType}
            onApply={applyPastedRows}
            onClose={() => setPasteOpen(false)}
          />
        ) : null}

        <p className="text-xs text-slate-500">
          {draftItems.length} name{draftItems.length === 1 ? '' : 's'} in this order
          {existing ? ` · ${itemCounts.get(existing.id) ?? 0} currently saved` : ''}
        </p>
      </div>
    </Modal>
  );
}

const PASTE_COLUMNS: Partial<Record<ColumnKey, string>> = {
  name: 'Name',
  jerseyNo: 'Number',
  position: 'Position',
  cutType: 'Cut Type',
  tag: 'Tag',
  label: 'Label',
  notes: 'Notes',
};

function PasteCsvModal({
  rows,
  productTypeId,
  onApply,
  onClose,
}: {
  rows: RowState[];
  productTypeId: number | null;
  onApply: (merged: PasteMerge<RowState>) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parsePastedNames(text), [text]);

  const merged = useMemo(
    () => mergePastedRows(rows, parsed.items, (item) => rowFromDraft(item, productTypeId)),
    [productTypeId, parsed.items, rows],
  );

  // Name of every row already in the table, so the preview can flag a pasted
  // row as an update rather than a new one. Built from the table, not from the
  // merge, so a name repeated in the pasted block still reads as "new" twice.
  const existingNames = useMemo(() => new Set(rows.map((row) => nameKey(row.name))), [rows]);

  /**
   * Load the first file in a list, replacing whatever is in the box so the
   * preview always shows exactly the file that was dropped.
   */
  function loadFiles(files: FileList | null | undefined) {
    const file = files?.[0];
    if (!file) return;

    const rejection = csvFileRejection(file);
    if (rejection) {
      setFileError(rejection);
      return;
    }

    setFileError(null);
    void file
      .arrayBuffer()
      .then((buffer) => {
        setText(decodeCsvBytes(new Uint8Array(buffer)));
        setLoadedFile(file.name);
      })
      .catch(() => setFileError(`Could not read ${file.name}.`));
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDropping(false);
    loadFiles(event.dataTransfer.files);
  }

  // A file dropped anywhere else in the window would make the browser navigate
  // to it, discarding the draft order. Swallow those drops while the modal is
  // open; the zone above has already handled its own.
  useEffect(() => {
    const swallow = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', swallow);
    window.addEventListener('drop', swallow);
    return () => {
      window.removeEventListener('dragover', swallow);
      window.removeEventListener('drop', swallow);
    };
  }, []);

  const empty = parsed.items.length === 0;

  // Columns we could not map are dropped from the preview too — their cells
  // never reach the parsed items, so showing them would just be blank noise.
  const shownColumns = parsed.columns.filter((key): key is ColumnKey =>
    key !== undefined && ITEM_COLUMNS.includes(key),
  );
  const headers = shownColumns.map((key) => PASTE_COLUMNS[key] ?? key);

  return (
    <Modal
      title="Paste rows from CSV"
      subtitle={
        parsed.headerDetected
          ? `Header row recognised: ${headers.join(', ')}`
          : 'No header row found — columns are read as name, number, position, tag, label.'
      }
      size="xl"
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-xs text-slate-500">
            {empty
              ? 'Nothing to add yet'
              : `${merged.added} new, ${merged.updated} updated`}
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={empty} onClick={() => onApply(merged)}>
            Apply rows
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* The whole input block is a drop target — dropping on the textarea
            alone would fall through to the browser, which inserts the file
            path as text. */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={(event) => {
            // The child elements fire dragleave too; only reset when the
            // pointer actually left the zone.
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setDropping(false);
          }}
          onDrop={handleDrop}
          className={`space-y-3 rounded-lg p-2 transition ${
            dropping ? 'bg-brand-50 ring-2 ring-brand-400' : ''
          }`}
        >
          <Field label="Paste a block of rows" hint="Comma or tab separated. A header row is optional.">
            <TextArea
              rows={8}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setLoadedFile(null);
              }}
              placeholder={'name,num,pos,tag\nAhmed Ali,10,Captain,XLarge\nBilal,7,Player,Large'}
              className="font-mono text-xs"
            />
          </Field>

          <div
            className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed px-3 py-3 transition ${
              dropping ? 'border-brand-500 bg-white/60' : 'border-slate-300 bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Drop a CSV file here</span>
              <span className="text-slate-500"> — .csv, .txt or .tsv, up to 5 MB</span>
              {loadedFile ? (
                <span className="mt-0.5 block text-emerald-700">Loaded {loadedFile}</span>
              ) : null}
            </div>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
              className="hidden"
              onChange={(event) => {
                loadFiles(event.target.files);
                // Allow re-picking the same file later.
                event.target.value = '';
              }}
            />
          </div>
        </div>

        {fileError ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
            {fileError}
          </p>
        ) : null}

        {empty ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Drop a CSV file above, or paste a block of rows in the box, to see how they will be
            applied.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
              <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">
                {merged.added} new row{merged.added === 1 ? '' : 's'}
              </span>
              <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                {merged.updated} matching row{merged.updated === 1 ? '' : 's'} updated
              </span>
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="border-b border-slate-200 px-2 py-1.5 text-left font-bold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                    {headers.map((header, index) => (
                      <th
                        key={`${header}-${index}`}
                        className="border-b border-slate-200 px-2 py-1.5 text-left font-bold uppercase tracking-wide text-slate-500"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.items.map((item, index) => {
                    const isUpdate = existingNames.has(nameKey(item.name));
                    return (
                      <tr key={`${nameKey(item.name)}-${index}`} className="even:bg-slate-50/60">
                        <td className="border-b border-slate-100 px-2 py-1">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              isUpdate ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {isUpdate ? 'update' : 'new'}
                          </span>
                        </td>
                        {shownColumns.map((key, index) => (
                          <td
                            key={`${key}-${index}`}
                            className="border-b border-slate-100 px-2 py-1 text-slate-700"
                          >
                            {item[key] || <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500">
              Rows that match an existing name update it in place and leave blank cells untouched.
              Everything else is appended as a new row. Nothing is saved until you press{' '}
              <span className="font-semibold text-slate-700">Save order</span>.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ProductTypePicker({
  types,
  selected,
  rowCount,
  onToggle,
  onSetAll,
}: {
  types: ProductType[];
  selected: number[];
  rowCount: number;
  onToggle: (id: number) => void;
  onSetAll: (id: number) => void;
}) {
  if (types.length === 0) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
        No product types yet — add them in Settings before creating orders.
      </p>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <header className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Product types in this order
        </h3>
        {selected.length > 1 ? (
          <span className="text-xs text-slate-500">
            Printed on the job sheet as one table each
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {types.map((type) => {
          const isOn = selected.includes(type.id);
          return (
            <label
              key={type.id}
              className="flex items-center gap-1.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => onToggle(type.id)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              {type.name}
              {selected.length > 1 && isOn && rowCount > 0 ? (
                <button
                  type="button"
                  title={`Put all ${rowCount} rows on ${type.name}`}
                  onClick={() => onSetAll(type.id)}
                  className="rounded bg-white px-1 text-[10px] font-bold uppercase text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
                >
                  all
                </button>
              ) : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}

function ItemTable({
  rows,
  columns,
  known,
  customerOptions,
  productTypes,
  showTypeColumn,
  sensors,
  onDragEnd,
  onUpdate,
  onToggleColumn,
  onRemove,
  onAdd,
  onPaste,
}: {
  rows: RowState[];
  columns: ColumnKey[];
  known: KnownValues;
  customerOptions: string[];
  productTypes: ProductType[];
  showTypeColumn: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  onUpdate: (key: string, patch: Partial<RowState>) => void;
  onToggleColumn: (key: ColumnKey) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onPaste: () => void;
}) {
  const visible = ITEM_COLUMNS.filter((key) => columns.includes(key));
  const headings = showTypeColumn ? ['Product', ...visible.map((key) => COLUMN_LABELS[key])] : visible.map((key) => COLUMN_LABELS[key]);

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
        <div className="flex gap-2">
          <Button size="sm" onClick={onPaste}>
            Paste CSV
          </Button>
          <Button size="sm" onClick={onAdd}>
            + Add row
          </Button>
        </div>
      </header>

      <Options id="known-customers" values={customerOptions} />
      <Options id="known-positions" values={known.positions} />
      <Options id="known-cut-types" values={known.cutTypes} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={rows.map((row) => row.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['#', ...headings, ''].map((heading, index) => (
                      <th
                        key={`${heading}-${index}`}
                        className="border-b border-slate-200 px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <SortableRow key={row.key} id={row.key} index={index}>
                    {showTypeColumn ? (
                      <td className="w-40">
                        <Select
                          value={row.productTypeId === null ? '' : String(row.productTypeId)}
                          onChange={(event) =>
                            onUpdate(row.key, {
                              productTypeId: event.target.value === '' ? null : Number(event.target.value),
                            })
                          }
                        >
                          <option value="">— none —</option>
                          {productTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                    ) : null}
                    {visible.includes('name') ? (
                      <td className="min-w-[320px]">
                        <TextInput
                          value={row.name}
                          onChange={(event) => onUpdate(row.key, { name: event.target.value })}
                          placeholder="Full name"
                        />
                      </td>
                    ) : null}
                    {visible.includes('jerseyNo') ? (
                      <td className="w-28">
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
                    {visible.includes('cutType') ? (
                      <td className="w-44">
                        <TextInput
                          list="known-cut-types"
                          value={row.cutType}
                          onChange={(event) => onUpdate(row.key, { cutType: event.target.value })}
                          placeholder="Jersey Standard"
                        />
                      </td>
                    ) : null}
                    {visible.includes('tag') ? (
                      <td className="w-36">
                        <Select
                          value={row.tag}
                          onChange={(event) => onUpdate(row.key, { tag: event.target.value })}
                        >
                          <option value="">—</option>
                          {tagOptions(row.tag).map((tag) => (
                            <option key={tag} value={tag}>
                              {tag}
                            </option>
                          ))}
                        </Select>
                      </td>
                    ) : null}
                    {visible.includes('label') ? (
                      <td className="w-24">
                        <Select
                          value={row.label}
                          onChange={(event) => onUpdate(row.key, { label: event.target.value })}
                          title="Filled in from the tag, and refreshed whenever the tag changes."
                          className="text-center font-semibold uppercase"
                        >
                          <option value="">—</option>
                          {labelOptions(row.label).map((label) => (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          ))}
                        </Select>
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
