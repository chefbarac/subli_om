import { useRef, useState } from 'react';
import { stageTone } from '@/lib/colors';
import { useApp } from '@/state/AppProvider';
import { SIZE_PAIRINGS } from '@/lib/sizes';
import { Button, Field, Modal, Select, TextInput } from './ui';
import type { NameCase, Settings, Stage, TagCase } from '@/types';

let idCounter = Date.now();
function tempId(): number {
  idCounter += 1;
  return idCounter;
}

export function SettingsView({ onClose }: { onClose: () => void }) {
  const {
    data,
    updateSettings,
    saveStageList,
    saveLists,
    exportBackup,
    importBackup,
    loadDemoOrders,
    deleteAllOrders,
    resetAll,
  } = useApp();

  const [productTypes, setProductTypes] = useState(data.productTypes);
  const [cutTypes, setCutTypes] = useState(data.cutTypes);
  const [listsDirty, setListsDirty] = useState(false);

  // The two lists share one Save button, mirroring how Stages behaves.
  async function handleSaveLists() {
    await saveLists(productTypes, cutTypes);
    setListsDirty(false);
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleImport(file: File) {
    try {
      await importBackup(file);
      setMessage('Backup restored.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not read that backup file.');
    }
  }

  return (
    <Modal
      title="Settings"
      subtitle="Stages, receipt details, CSV rules and local data."
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {message ? (
          <p className="rounded-md bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
            {message}
          </p>
        ) : null}

        <StagesSection
          stages={data.stages}
          onSave={saveStageList}
          hasOrders={(stageId) => data.orders.some((order) => order.stageId === stageId)}
        />

        <SizePairingSection />

        <NameListSection
          title="Product types"
          description="What an order can be made of. Tick the ones an order includes; the job sheet prints one table per product type."
          rows={productTypes}
          onChange={(next) => {
            setProductTypes(next);
            setListsDirty(true);
          }}
        />

        <NameListSection
          title="Cut types"
          description="Offered as suggestions in the Cut Type column. The column stays free text, so a one-off style can still be typed."
          rows={cutTypes}
          onChange={(next) => {
            setCutTypes(next);
            setListsDirty(true);
          }}
        />

        {listsDirty ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={() => {
                setProductTypes(data.productTypes);
                setCutTypes(data.cutTypes);
                setListsDirty(false);
              }}
            >
              Discard changes
            </Button>
            <Button size="sm" variant="primary" onClick={() => void handleSaveLists()}>
              Save product types and cut types
            </Button>
          </div>
        ) : null}

        <KnownValuesSection />

        <ReceiptSection settings={data.settings} onSave={updateSettings} />

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Orders</h3>
          <p className="mb-2 text-xs text-slate-500">
            The app starts with demo orders so you can try every view. Clear them before you start
            real work — this keeps your stages, sizes and settings.
          </p>          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (
                  data.orders.length === 0 ||
                  window.confirm(
                    `Replace all ${data.orders.length} current order(s) with demo orders?`,
                  )
                ) {
                  void loadDemoOrders();
                  setMessage('Demo orders loaded.');
                }
              }}
            >
              Load demo orders
            </Button>
            <Button
              variant="danger"
              disabled={data.orders.length === 0}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete all ${data.orders.length} order(s) and their names? This cannot be undone.`,
                  )
                ) {
                  void deleteAllOrders();
                  setMessage('All orders deleted.');
                }
              }}
            >
              Delete all orders
            </Button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Data (this browser only)</h3>
          <p className="mb-2 text-xs text-slate-500">
            Orders live in this browser&apos;s IndexedDB on this device. Export a backup regularly,
            and keep it somewhere safe. Clearing site data will erase every order.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportBackup}>Download backup (JSON)</Button>
            <Button onClick={() => fileRef.current?.click()}>Restore from backup</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.target.value = '';
              }}
            />
            <Button
              variant="danger"
              onClick={() => {
                if (
                  window.confirm(
                    'Erase every order, name and setting and start fresh? This cannot be undone.',
                  )
                ) {
                  void resetAll();
                }
              }}
            >
              Reset all data
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function StagesSection({
  stages,
  onSave,
  hasOrders,
}: {
  stages: Stage[];
  onSave: (stages: Stage[]) => Promise<void>;
  hasOrders: (stageId: number) => boolean;
}) {
  const [draft, setDraft] = useState<Stage[]>(stages);

  function update(id: number, patch: Partial<Stage>) {
    setDraft((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function move(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((stage, i) => ({ ...stage, sortOrder: i }));
    });
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Stages</h3>
      <p className="mb-2 text-xs text-slate-500">
        Add, rename, reorder or hide stages. Hidden stages keep their orders but disappear from the
        board.
      </p>

      <div className="space-y-1.5">
        {draft.map((stage, index) => (
          <div key={stage.id} className="flex items-center gap-2">
            <span className={`h-3 w-3 shrink-0 rounded-full ${stageTone(stage.sortOrder).dot}`} />
            <TextInput
              value={stage.name}
              onChange={(event) => update(stage.id, { name: event.target.value })}
              className="flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={stage.isActive}
                onChange={(event) => update(stage.id, { isActive: event.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              Visible
            </label>
            <button
              type="button"
              onClick={() => move(index, -1)}
              className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100"
              aria-label="Move stage up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100"
              aria-label="Move stage down"
            >
              ↓
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (hasOrders(stage.id)) {
                  setDraft((current) =>
                    current.map((s) => (s.id === stage.id ? { ...s, isActive: false } : s)),
                  );
                } else {
                  setDraft((current) => current.filter((s) => s.id !== stage.id));
                }
              }}
              title={
                hasOrders(stage.id)
                  ? 'This stage has orders — it will be hidden instead of deleted'
                  : 'Delete stage'
              }
            >
              {hasOrders(stage.id) ? 'Hide' : '✕'}
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            setDraft((current) => [
              ...current,
              {
                id: tempId(),
                name: 'New stage',
                sortOrder: current.length,
                isActive: true,
              },
            ])
          }
        >
          + Add stage
        </Button>
        <Button size="sm" variant="primary" onClick={() => void onSave(draft)}>
          Save stages
        </Button>
      </div>
    </section>
  );
}

function SizePairingSection() {
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Sizes — tag and label</h3>
      <p className="mb-2 text-xs text-slate-500">
        Fixed pairing. The tag is the full size name you pick per name, and the label is filled in
        for you from this table. Tags are offered as suggestions on every row.
      </p>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {SIZE_PAIRINGS.map((size) => (
          <li
            key={size.tag}
            className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1"
          >
            <span className="text-sm text-slate-700">{size.tag}</span>
            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-slate-600 ring-1 ring-slate-200">
              {size.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface NameRow {
  id: number;
  name: string;
  sortOrder: number;
}

function NameListSection({
  title,
  description,
  rows,
  onChange,
}: {
  title: string;
  description: string;
  rows: NameRow[];
  onChange: (rows: NameRow[]) => void;
}) {
  const nextId = useRef(Math.max(0, ...rows.map((row) => row.id)) + 1);

  function rename(id: number, name: string) {
    onChange(rows.map((row) => (row.id === id ? { ...row, name } : row)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    onChange(next.map((entry, position) => ({ ...entry, sortOrder: position })));
  }

  function remove(id: number) {
    onChange(
      rows
        .filter((row) => row.id !== id)
        .map((entry, position) => ({ ...entry, sortOrder: position })),
    );
  }

  function add() {
    const id = nextId.current;
    nextId.current += 1;
    onChange([...rows, { id, name: '', sortOrder: rows.length }]);
  }

  return (
    <section>
      <h3 className="mb-1 text-sm font-bold text-slate-800">{title}</h3>
      <p className="mb-2 text-xs text-slate-500">{description}</p>

      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={row.id} className="flex items-center gap-1.5">
            <span className="flex shrink-0 flex-col">
              <button
                type="button"
                aria-label={`Move ${row.name || 'entry'} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={`Move ${row.name || 'entry'} down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                ▼
              </button>
            </span>

            <TextInput
              value={row.name}
              onChange={(event) => rename(row.id, event.target.value)}
              placeholder={`${title.replace(/s$/, '')} name`}
            />

            <Button size="sm" onClick={() => remove(row.id)} title="Remove">
              ✕
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <Button size="sm" onClick={add}>
          + Add {title.replace(/s$/, '').toLowerCase()}
        </Button>
      </div>
    </section>
  );
}

function KnownValuesSection() {
  const { known } = useApp();

  const groups: Array<[string, string[]]> = [
    ['Customers', known.customers],
    ['Positions', known.positions],
  ];

  const empty = groups.every(([, values]) => values.length === 0);

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Suggested values</h3>
      <p className="mb-2 text-xs text-slate-500">
        Collected automatically from the orders you have already saved. Each input offers these as
        suggestions while still letting you type anything new.
      </p>

      {empty ? (
        <p className="text-xs text-slate-400">Nothing suggested yet — save an order to build this up.</p>
      ) : (
        <div className="space-y-2">
          {groups.map(([title, values]) =>
            values.length === 0 ? null : (
              <div key={title}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {title}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {values.map((value) => (
                    <span
                      key={value}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

const TAG_CASES: TagCase[] = ['as-is', 'lower', 'title', 'upper'];
const NAME_CASES: NameCase[] = ['as-is', 'lower', 'upper'];

function ReceiptSection({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (settings: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Settings>(settings);

  function patch(next: Partial<Settings>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-800">Receipt and CSV</h3>
        <p className="mb-2 text-xs text-slate-500">
          Letter case rules are applied only when exporting CSV. Change the tag rule here once the
          client confirms whether it should be Title Case or UPPERCASE.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Company name">
          <TextInput
            value={draft.companyName}
            onChange={(event) => patch({ companyName: event.target.value })}
          />
        </Field>
        <Field label="Currency">
          <TextInput
            value={draft.currency}
            onChange={(event) => patch({ currency: event.target.value })}
          />
        </Field>
        <Field label="Receipt footer">
          <TextInput
            value={draft.receiptFooter}
            onChange={(event) => patch({ receiptFooter: event.target.value })}
          />
        </Field>

        <Field label="Export: name case">
          <Select
            value={draft.exportNameCase}
            onChange={(event) => patch({ exportNameCase: event.target.value as NameCase })}
          >
            {NAME_CASES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Export: label case">
          <Select
            value={draft.exportLabelCase}
            onChange={(event) => patch({ exportLabelCase: event.target.value as TagCase })}
          >
            {TAG_CASES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Export: tag case">
          <Select
            value={draft.exportTagCase}
            onChange={(event) => patch({ exportTagCase: event.target.value as TagCase })}
          >
            {TAG_CASES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Export: position case">
          <Select
            value={draft.exportPositionCase}
            onChange={(event) => patch({ exportPositionCase: event.target.value as TagCase })}
          >
            {TAG_CASES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Button variant="primary" onClick={() => void onSave(draft)}>
        Save receipt settings
      </Button>
    </section>
  );
}
