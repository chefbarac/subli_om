import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { dueLabel } from '@/lib/dates';
import { normalizeColumns } from '@/lib/normalize';
import { Button } from './ui';
import { ITEM_COLUMNS, type ColumnKey, type Order, type OrderItem, type Settings } from '@/types';

const SHEET_HEADERS: Record<ColumnKey, string> = {
  name: 'Name',
  jerseyNo: 'Jersey No',
  position: 'Position',
  neckType: 'Neck',
  tag: 'Tag',
  label: 'Label',
  notes: 'Notes',
};

const COLUMN_ALIGN: Record<ColumnKey, string> = {
  name: 'font-semibold uppercase',
  jerseyNo: 'text-center font-mono font-bold',
  position: '',
  neckType: '',
  tag: '',
  label: 'text-center font-bold uppercase',
  notes: '',
};

export function JobSheet({
  order,
  items,
  settings,
  onClose,
}: {
  order: Order;
  items: OrderItem[];
  settings: Settings;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 no-print">
        <div className="mx-auto mb-3 flex max-w-[210mm] items-center justify-between gap-3 rounded-lg bg-white px-4 py-2 shadow-xl">
          <p className="text-sm font-semibold text-slate-700">
            A4 job sheet preview — prices are left blank for you to fill in by hand.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => window.print()}>
              Print
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>

        <Sheet order={order} items={items} settings={settings} />
      </div>

      <div id="print-root" className="hidden">
        <Sheet order={order} items={items} settings={settings} />
      </div>
    </>,
    document.body,
  );
}

function Sheet({
  order,
  items,
  settings,
}: {
  order: Order;
  items: OrderItem[];
  settings: Settings;
}) {
  const columns = normalizeColumns(order.columns);
  const showNotes = columns.includes('notes');
  const visible = ITEM_COLUMNS.filter((key) => columns.includes(key) && key !== 'notes');

  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white p-[8mm] text-black shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wide">{settings.companyName}</h1>
          <p className="text-xs">Sublimation job sheet</p>
        </div>
        <div className="text-right text-xs">
          <p className="text-base font-bold">ORDER NO.</p>
          <p className="font-mono text-base">{order.orderNo}</p>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <Row label="Customer" value={order.customerName} />
        <Row
          label="Due date"
          value={order.dueDate ? format(new Date(order.dueDate), 'dd MMM yyyy') : ''}
        />
        <Row label="Product" value={order.product} />
        <Row label="Description" value={order.description} />
        <Row label="Printed" value={format(new Date(), 'dd MMM yyyy')} />
        <Row label="Total items" value={String(items.length)} />
      </section>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr>
            {['#', ...visible.map((key) => SHEET_HEADERS[key]), 'Price'].map((heading) => (
              <th
                key={heading}
                className={`border border-black px-1.5 py-1.5 text-left font-bold uppercase tracking-wide ${
                  heading === 'Price' ? 'w-20' : ''
                }`}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={visible.length + 2}
                className="border border-black px-2 py-6 text-center text-slate-500"
              >
                No names added yet
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-black px-1.5 py-2 text-center">{index + 1}</td>
                {visible.map((key) =>
                  key === 'name' ? (
                    <td key={key} className="border border-black px-1.5 py-2">
                      <NameWithNotes name={item.name} note={showNotes ? item.notes : ''} />
                    </td>
                  ) : (
                    <td
                      key={key}
                      className={`border border-black px-1.5 py-2 text-sm ${COLUMN_ALIGN[key]}`}
                    >
                      {item[key]}
                    </td>
                  ),
                )}
                <td className="h-8 border border-black" />
              </tr>
            ))
          )}
          {items.length > 0 && items.length % 2 === 1 ? (
            <tr>
              <td colSpan={visible.length + 2} className="h-8 border border-black" />
            </tr>
          ) : null}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <div className="w-64 space-y-3 text-xs">
          <Blank label="TOTAL" currency={settings.currency} strong />
          <Blank label="Amount paid" currency={settings.currency} />
          <Blank label="Balance" currency={settings.currency} strong />
        </div>
      </section>

      <footer className="mt-8 flex items-end justify-between gap-6 border-t border-slate-300 pt-3 text-xs">
        <div className="max-w-md">
          <p className="font-semibold">Notes</p>
          <div className="mt-6 border-b border-slate-300" />
          <p className="mt-3 text-slate-500">{settings.receiptFooter}</p>
          {order.dueDate ? <p className="text-slate-500">{dueLabel(order.dueDate)}</p> : null}
        </div>
        <div className="w-48 text-center">
          <div className="h-10 border-b border-black" />
          <p className="mt-1 font-semibold">Customer signature</p>
        </div>
      </footer>
    </div>
  );
}

function NameWithNotes({ name, note }: { name: string; note: string }) {
  const cleaned = note.trim();
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-sm font-semibold uppercase">{name}</span>
      {cleaned ? (
        <span className="rounded border border-black px-1 py-px text-[9px] font-bold uppercase leading-tight">
          {cleaned}
        </span>
      ) : null}
    </span>
  );
}

function Row({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="font-bold uppercase tracking-wide">{label}: </span>
      <span>{value || '—'}</span>
    </div>
  );
}

function Blank({ label, currency, strong = false }: { label: string; currency: string; strong?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-2">
      <span className={`font-bold uppercase tracking-wide ${strong ? 'text-sm' : ''}`}>{label}</span>
      <span className={`border-b border-black px-1 ${strong ? 'h-7 w-32' : 'h-6 w-28'}`} />
      <span className="text-[10px] text-slate-500">{currency}</span>
    </div>
  );
}
