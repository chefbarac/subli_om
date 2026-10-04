import { useRef, useState } from 'react';
import { stageTone } from '@/lib/colors';
import { useApp } from '@/state/AppProvider';
import { Button, Field, Modal, Select, TextInput } from './ui';
import type { NameCase, PositionOption, Settings, SizeOption, Stage, TagCase } from '@/types';

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
    saveSizeList,
    savePositionList,
    exportBackup,
    importBackup,
    resetAll,
  } = useApp();

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
      subtitle="Stages, sizes, positions, receipt details and local data."
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

        <SizesSection sizes={data.sizes} onSave={saveSizeList} />

        <PositionsSection positions={data.positions} onSave={savePositionList} />

        <ReceiptSection settings={data.settings} onSave={updateSettings} />

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

function SizesSection({
  sizes,
  onSave,
}: {
  sizes: SizeOption[];
  onSave: (sizes: SizeOption[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SizeOption[]>(sizes);

  function update(id: number, patch: Partial<SizeOption>) {
    setDraft((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function move(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((size, i) => ({ ...size, sortOrder: i }));
    });
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Sizes — tag and label</h3>
      <p className="mb-2 text-xs text-slate-500">
        The tag is the full size name you pick per name (e.g. Extra Large). The label is the short
        code printed on the job sheet and CSV (XL).
      </p>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {draft.map((size, index) => (
          <div key={size.id} className="flex items-center gap-2">
            <TextInput
              value={size.name}
              onChange={(event) => update(size.id, { name: event.target.value })}
              className="flex-1"
            />
            <TextInput
              value={size.label}
              onChange={(event) => update(size.id, { label: event.target.value })}
              className="w-20 text-center font-semibold uppercase"
            />
            <button
              type="button"
              onClick={() => move(index, -1)}
              className="rounded px-1 text-xs text-slate-400 hover:bg-slate-100"
              aria-label="Move size up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              className="rounded px-1 text-xs text-slate-400 hover:bg-slate-100"
              aria-label="Move size down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => setDraft((current) => current.filter((s) => s.id !== size.id))}
              className="rounded px-1 text-xs text-rose-400 hover:bg-rose-50"
              aria-label="Delete size"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            setDraft((current) => [
              ...current,
              { id: tempId(), name: 'New size', label: '', sortOrder: current.length },
            ])
          }
        >
          + Add size
        </Button>
        <Button size="sm" variant="primary" onClick={() => void onSave(draft)}>
          Save sizes
        </Button>
      </div>
    </section>
  );
}

function PositionsSection({
  positions,
  onSave,
}: {
  positions: PositionOption[];
  onSave: (positions: PositionOption[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PositionOption[]>(positions);

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-slate-800">Positions</h3>
      <p className="mb-2 text-xs text-slate-500">
        Offered in the position dropdown on each name, e.g. Manager, Captain, Player.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {draft.map((position) => (
          <div key={position.id} className="flex items-center gap-1">
            <TextInput
              value={position.name}
              onChange={(event) =>
                setDraft((current) =>
                  current.map((p) =>
                    p.id === position.id ? { ...p, name: event.target.value } : p,
                  ),
                )
              }
              className="w-36"
            />
            <button
              type="button"
              onClick={() => setDraft((current) => current.filter((p) => p.id !== position.id))}
              className="rounded px-1 text-xs text-rose-400 hover:bg-rose-50"
              aria-label="Delete position"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            setDraft((current) => [
              ...current,
              { id: tempId(), name: 'New position', sortOrder: current.length },
            ])
          }
        >
          + Add position
        </Button>
        <Button size="sm" variant="primary" onClick={() => void onSave(draft)}>
          Save positions
        </Button>
      </div>
    </section>
  );
}

const TAG_CASES: TagCase[] = ['as-is', 'title', 'upper'];
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
