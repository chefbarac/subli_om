import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { sheetColumns } from '@/lib/normalize';
import { Button } from './ui';
import {
  type ColumnKey,
  type Order,
  type OrderItem,
  type ProductType,
  type Settings,
} from '@/types';

const SHEET_HEADERS: Record<ColumnKey, string> = {
  name: 'Name',
  jerseyNo: 'Number',
  position: 'Position',
  cutType: 'Cut Type',
  tag: 'Tag',
  label: 'Label',
  notes: 'Notes',
};

const COLUMN_ALIGN: Record<ColumnKey, string> = {
  name: 'font-semibold uppercase',
  jerseyNo: 'text-center font-mono font-bold',
  position: '',
  cutType: '',
  tag: '',
  label: 'text-center font-bold uppercase',
  notes: '',
};

const UNASSIGNED_HEADING = 'Unassigned product type';

export function JobSheet({
  order,
  items,
  settings,
  productTypes,
  onClose,
}: {
  order: Order;
  items: OrderItem[];
  settings: Settings;
  productTypes: ProductType[];
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

        <Sheet order={order} items={items} settings={settings} productTypes={productTypes} />
      </div>

      <div id="print-root" className="hidden">
        <Sheet order={order} items={items} settings={settings} productTypes={productTypes} />
      </div>
    </>,
    document.body,
  );
}

interface Group {
  id: number | null;
  title: string;
  items: OrderItem[];
}

/**
 * Splits rows into one group per product type. The order decides the order of
 * the tables, then anything left unassigned or pointing at a deleted product
 * type is collected into a trailing table so no name is ever left off the job.
 */
export function groupByProductType(
  items: OrderItem[],
  order: Order,
  productTypes: ProductType[],
): Group[] {
  const nameById = new Map(productTypes.map((type) => [type.id, type.name]));
  const groups: Group[] = order.productTypeIds
    .filter((id, index, all) => all.indexOf(id) === index)
    .map((id) => ({ id, title: nameById.get(id) ?? `Product type ${id}`, items: [] }));

  const assigned = new Set(groups.map((group) => group.id));
  const leftovers: OrderItem[] = [];

  for (const item of items) {
    const group =
      item.productTypeId !== null && assigned.has(item.productTypeId)
        ? groups.find((candidate) => candidate.id === item.productTypeId)
        : undefined;
    if (group) group.items.push(item);
    else leftovers.push(item);
  }

  const unassigned: Group = { id: null, title: UNASSIGNED_HEADING, items: leftovers };
  return [...groups.filter((group) => group.items.length > 0), unassigned].filter(
    (group) => group.items.length > 0,
  );
}

function Sheet({
  order,
  items,
  settings,
  productTypes,
}: {
  order: Order;
  items: OrderItem[];
  settings: Settings;
  productTypes: ProductType[];
}) {
  const columns = sheetColumns(order.columns);
  const showNotes = order.columns.includes('notes');
  const groups = groupByProductType(items, order, productTypes);

  return (
    <div className="relative mx-auto w-full max-w-[210mm] bg-white p-[8mm] text-black print:bg-white print:shadow-none">
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <img
          src="/img/agt-logo.png"
          alt=""
          aria-hidden="true"
          className="h-[75mm] w-auto -rotate-12 object-contain opacity-[0.06] print:opacity-[0.04]"
        />
      </div>

      <div className="relative z-10">
      <header className="relative flex items-start justify-between gap-4 border-b-2 border-black pb-2">
        <div className="flex items-center gap-3">
          <img
            src="/img/agt-logo.png"
            alt="Company logo"
            className="h-10 w-auto object-contain"
          />
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide">{settings.companyName}</h1>
            <p className="text-xs">Sublimation job sheet</p>
          </div>
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
        <Row label="Product" value={groups.map((group) => group.title).join(', ')} />
        <Row label="Description" value={order.description} />
        <Row label="Total items" value={String(items.length)} />
      </section>

      {groups.length === 0 ? (
        <p className="mt-6 border border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
          No names added yet
        </p>
      ) : (
        groups.map((group, groupIndex) => (
          <ProductTable
            key={group.id ?? 'unassigned'}
            heading={group.title}
            count={group.items.length}
            columns={columns}
            showNotes={showNotes}
            items={group.items}
            topMargin={groupIndex === 0 ? 'mt-4' : 'mt-6'}
          />
        ))
      )}

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
          <p className="mt-3 text-slate-500">
            This receipt was printed on {format(new Date(), 'dd MMM yyyy')}.
          </p>
        </div>
        <div className="w-48 text-center">
          <div className="h-10 border-b border-black" />
          <p className="mt-1 font-semibold">Customer signature</p>
        </div>
      </footer>
      </div>
    </div>
  );
}

function ProductTable({
  heading,
  count,
  columns,
  showNotes,
  items,
  topMargin,
}: {
  heading: string;
  count: number;
  columns: ColumnKey[];
  showNotes: boolean;
  items: OrderItem[];
  topMargin: string;
}) {
  return (
    <section className={topMargin}>
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide">
        {heading}
        <span className="ml-2 font-normal text-slate-500">
          ({count} item{count === 1 ? '' : 's'})
        </span>
      </h2>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {['#', ...columns.map((key) => SHEET_HEADERS[key]), 'Price'].map((label) => (
              <th
                key={label}
                className={`border border-black px-1.5 py-1.5 text-left font-bold uppercase tracking-wide ${
                  label === 'Price' ? 'w-20' : ''
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td className="border border-black px-1.5 py-2 text-center">{index + 1}</td>
              {columns.map((key) =>
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
          ))}
          {items.length % 2 === 1 ? (
            <tr>
              <td colSpan={columns.length + 2} className="h-8 border border-black" />
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

function NameWithNotes({ name, note }: { name: string; note: string }) {
  const cleaned = note.trim();
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-sm font-semibold uppercase">{name}</span>
      {cleaned ? (
        <span className="rounded border border-black bg-amber-200 px-1 py-px text-[9px] font-bold leading-tight">
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

function Blank({
  label,
  currency,
  strong = false,
}: {
  label: string;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-2">
      <span className={`font-bold uppercase tracking-wide ${strong ? 'text-sm' : ''}`}>
        {label}
      </span>
      <div className={`flex-1 border-b border-black ${strong ? 'h-6' : 'h-5'}`} />
      <span className="text-[10px] text-slate-500">{currency}</span>
    </div>
  );
}