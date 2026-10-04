import { parsePastedNames } from '@/lib/paste';
import { nextOrderNo } from '@/lib/orderNo';
import { applyCase } from '@/lib/caseRules';
import { labelForTag } from '@/lib/sizes';
import { buildOrdersCsv } from '@/lib/csv';
import { DEFAULT_SETTINGS, DEFAULT_SIZES } from '@/db/seed';
import type { Order, OrderItem, SizeOption } from '@/types';

const sizes: SizeOption[] = DEFAULT_SIZES.map(([name, label], i) => ({
  id: i + 1,
  name,
  label,
  sortOrder: i,
}));

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
  }
}

console.log('order numbering');
const orders: Order[] = [
  { orderNo: 'ORD-2026-0001' },
  { orderNo: 'ORD-2026-0042' },
  { orderNo: 'ORD-2025-0999' },
].map((partial, index) => ({
  id: index + 1,
  customerName: '',
  description: '',
  dueDate: null,
  stageId: 1,
  product: '',
  isCompleted: false,
  createdAt: '',
  updatedAt: '',
  ...partial,
})) as Order[];

check('continues current year', nextOrderNo(orders, 2026), 'ORD-2026-0043');
check('restarts new year', nextOrderNo(orders, 2027), 'ORD-2027-0001');

console.log('\ncase rules');
check('lower', applyCase('AHMED ALI', 'lower'), 'ahmed ali');
check('upper', applyCase('xl', 'upper'), 'XL');
check('title keeps short codes', applyCase('extra large', 'title'), 'Extra Large');
check('title keeps numeric codes', applyCase('2xl', 'title'), '2XL');
check('title normalises caps', applyCase('MEDIUM', 'title'), 'Medium');
check('as-is', applyCase(' Mixed ', 'as-is'), 'Mixed');

console.log('\ntag to label');
check('by full name', labelForTag('Extra Large', sizes), 'XL');
check('by label', labelForTag('xl', sizes), 'XL');
check('unknown tag', labelForTag('One Size Custom', sizes), '');

console.log('\npaste with header');
const withHeader = parsePastedNames(
  ['Name\tJersey No\tPosition\tTag', 'Ahmed Ali\t10\tCaptain\tLarge', 'Bilal\t7\tPlayer\tXL'].join('\n'),
  sizes,
);
check('header detected', withHeader.headerDetected, true);
check('row count', withHeader.items.length, 2);
check('first name', withHeader.items[0].name, 'Ahmed Ali');
check('first jersey', withHeader.items[0].jerseyNo, '10');
check('first position', withHeader.items[0].position, 'Captain');
check('label derived from tag', withHeader.items[0].label, 'L');
check('second label from XL tag', withHeader.items[1].label, 'XL');

console.log('\npaste without header');
const noHeader = parsePastedNames('Ahmed\t10\tCaptain\tLarge\nBilal\t7\tPlayer\tMedium', sizes);
check('default column order', noHeader.headerDetected, false);
check('row count', noHeader.items.length, 2);
check('tag mapped', noHeader.items[0].tag, 'Large');
check('label mapped', noHeader.items[0].label, 'L');
check('second label', noHeader.items[1].label, 'M');

console.log('\npaste header-only fallback');
const onlyHeader = parsePastedNames('name', sizes);
check('treated as data', onlyHeader.headerDetected, false);
check('row kept', onlyHeader.items.length, 1);
check('value kept', onlyHeader.items[0].name, 'name');

console.log('\nCSV export rules');
const csvOrder: Order = {
  id: 1,
  orderNo: 'ORD-2026-0001',
  customerName: 'Club, "A"',
  description: '',
  dueDate: null,
  stageId: 1,
  product: '',
  isCompleted: false,
  createdAt: '',
  updatedAt: '',
};
const csvItems: OrderItem[] = [
  {
    id: 1,
    orderId: 1,
    seq: 0,
    name: 'AHMED ALI',
    jerseyNo: '10',
    position: 'Captain',
    tag: 'Extra Large',
    label: 'xl',
  },
];
const csv = buildOrdersCsv([csvOrder], csvItems, DEFAULT_SETTINGS);
const lines = csv.split('\r\n');

check('header row', lines[0], 'Order No,Customer,Due Date,Product,Stage,Name,Jersey No,Position,Tag,Label');
check(
  'customer name is escaped',
  lines[1].includes('"Club, ""A"""'),
  true,
);
check('name lowercased', lines[1].includes(',ahmed ali,'), true);
check('label uppercased', lines[1].endsWith(',XL'), true);
check('tag title cased', lines[1].includes(',Extra Large,'), true);
check('position untouched', lines[1].includes(',Captain,'), true);

const upperTagCsv = buildOrdersCsv([csvOrder], csvItems, {
  ...DEFAULT_SETTINGS,
  exportTagCase: 'upper',
});
check('tag rule switchable to upper', upperTagCsv.includes(',EXTRA LARGE,'), true);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
if (failures > 0) process.exit(1);
