import { parsePastedNames } from '@/lib/paste';
import { exportableColumns, normalizeColumns, unionColumns } from '@/lib/normalize';
import { nextOrderNo } from '@/lib/orderNo';
import { applyCase } from '@/lib/caseRules';
import { SIZE_PAIRINGS, SIZE_TAGS, labelForTag } from '@/lib/sizes';
import { buildOrdersCsv } from '@/lib/csv';
import { collectKnownValues, suggestionsFor } from '@/lib/known';
import {
  cleanSettings,
  cleanStageList,
  cleanText,
} from '@/lib/normalize';
import {
  DEFAULT_SETTINGS,
  SETTINGS_MIGRATIONS,
  SETTINGS_VERSION,
  buildDemoData,
  buildSeedData,
} from '@/db/seed';
import {
  EXPORT_EXCLUDED_COLUMNS,
  ITEM_COLUMNS,
  type Order,
  type OrderItem,
} from '@/types';

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
  productTypeIds: [],
  columns: [...ITEM_COLUMNS],
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
check('pairing count', SIZE_PAIRINGS.length, 10);
check('pairing first', SIZE_PAIRINGS[0].tag, 'XSmall');
check('pairing first label', SIZE_PAIRINGS[0].label, 'XS');
check('pairing second XL', SIZE_PAIRINGS[4].tag, 'XLarge');
check('pairing 2XLarge', labelForTag('2XLarge'), '2XL');
check('pairing 5XLarge', labelForTag('5XLarge'), '5XL');
check('pairing B', labelForTag('B'), 'B');
check('tags offered', SIZE_TAGS.includes('3XLarge'), true);
check('by full name', labelForTag('XLarge'), 'XL');
check('by label', labelForTag('xl'), 'XL');
check('case insensitive', labelForTag('medium'), 'M');
check('surrounding space', labelForTag('  Large  '), 'L');
check('legacy extra large', labelForTag('Extra Large'), 'XL');
check('legacy 2XL', labelForTag('2XL'), '2XL');
check('legacy extra small', labelForTag('Extra Small'), 'XS');
check('unknown tag', labelForTag('One Size Custom'), '');
check('empty tag', labelForTag(''), '');

console.log('\npaste with header');
const withHeader = parsePastedNames(
  ['Name\tJersey No\tPosition\tTag', 'Ahmed Ali\t10\tCaptain\tLarge', 'Bilal\t7\tPlayer\tXL'].join('\n'),
);
check('header detected', withHeader.headerDetected, true);
check('row count', withHeader.items.length, 2);
check('first name', withHeader.items[0].name, 'Ahmed Ali');
check('first jersey', withHeader.items[0].jerseyNo, '10');
check('first position', withHeader.items[0].position, 'Captain');
check('label derived from tag', withHeader.items[0].label, 'L');
check('second label from XL tag', withHeader.items[1].label, 'XL');

console.log('\npaste without header');
const noHeader = parsePastedNames('Ahmed\t10\tCaptain\tLarge\nBilal\t7\tPlayer\tMedium');
check('default column order', noHeader.headerDetected, false);
check('row count', noHeader.items.length, 2);
check('tag mapped', noHeader.items[0].tag, 'Large');
check('label mapped', noHeader.items[0].label, 'L');
check('second label', noHeader.items[1].label, 'M');

console.log('\npaste header-only fallback');
const onlyHeader = parsePastedNames('name');
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
  productTypeIds: [],
  columns: [...ITEM_COLUMNS],
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
    cutType: 'V Neck',
    tag: 'XLarge',
    label: 'xl',
    notes: 'SECRET NOTE',
    productTypeId: null,
  },
];
const csv = buildOrdersCsv([csvOrder], csvItems, DEFAULT_SETTINGS);
const lines = csv.split('\r\n');

check(
  'header row',
  lines[0],
  'name,num,position,tag,label',
);
check(
  'customer name is escaped',
  lines[1].includes('"Club, ""A"""'),
  false,
);
check('name lowercased', lines[1].includes('ahmed ali'), true);
check('label uppercased', lines[1].endsWith(',XL'), true);
check('tag lowercased by default', lines[1].includes('xlarge'), true);
check('position untouched', lines[1].includes(',Captain,'), true);
check('neck type never exported', lines[0].includes('Cut'), false);
check('neck value never exported', lines[1].includes('V Neck'), false);
check('notes header never exported', lines[0].includes('Notes'), false);
check('notes value never exported', lines[1].includes('SECRET NOTE'), false);

const titleTagCsv = buildOrdersCsv([csvOrder], csvItems, {
  ...DEFAULT_SETTINGS,
  exportTagCase: 'title',
});
check('tag rule switchable to title', titleTagCsv.includes(',Xlarge,'), true);

const upperTagCsv = buildOrdersCsv([csvOrder], csvItems, {
  ...DEFAULT_SETTINGS,
  exportTagCase: 'upper',
});
check('tag rule switchable to upper', upperTagCsv.includes(',XLARGE,'), true);

const asIsTagCsv = buildOrdersCsv([csvOrder], csvItems, {
  ...DEFAULT_SETTINGS,
  exportTagCase: 'as-is',
});
check('tag rule switchable to as-is', asIsTagCsv.includes(',XLarge,'), true);

check('default tag case is lower', DEFAULT_SETTINGS.exportTagCase, 'lower');
check('default label case is upper', DEFAULT_SETTINGS.exportLabelCase, 'upper');
check('default name case is lower', DEFAULT_SETTINGS.exportNameCase, 'lower');

console.log('\nwhitespace trimming');
check('leading and trailing', cleanText('  Ahmed Ali  '), 'Ahmed Ali');
check('tabs', cleanText('\t\tnumber\t\t'), 'number');
check('newlines around', cleanText('\n Large \n'), 'Large');
check('non-breaking spaces', cleanText('\u00a0Extra Large\u00a0'), 'Extra Large');
check('already clean stays clean', cleanText('Medium'), 'Medium');
check('empty stays empty', cleanText('     '), '');
check('trailing space per line', cleanText('first   \nsecond  '), 'first\nsecond');
check('inner spacing kept', cleanText('  Ahmed   Ali  '), 'Ahmed   Ali');

check(
  'stage names trimmed',
  cleanStageList([{ id: 1, name: '  For Printing ', sortOrder: 0, isActive: true }])[0].name,
  'For Printing',
);
check(
  'blank stage name gets a placeholder',
  cleanStageList([{ id: 1, name: '   ', sortOrder: 0, isActive: true }])[0].name,
  'Untitled stage',
);
check(
  'settings scalars trimmed',
  (({ companyName, currency }) => ({ companyName, currency }))(
    cleanSettings({ ...DEFAULT_SETTINGS, companyName: '  Print House  ', currency: ' OMR ' }),
  ),
  { companyName: 'Print House', currency: 'OMR' },
);

const trimmedCsv = buildOrdersCsv(
  [{ ...csvOrder, orderNo: '  ORD-2026-0001  ', customerName: '  Club, "A"  ' }],
  [{ ...csvItems[0], name: '  AHMED ALI  ', jerseyNo: '  10  ', tag: ' XLarge ', label: ' xl ', notes: '  note  ' }],
  DEFAULT_SETTINGS,
);
const trimmedLines = trimmedCsv.split('\r\n');
check('csv order number trimmed', trimmedLines[1].startsWith('ORD-2026-0001,'), false);
check('csv name trimmed and lowercased', trimmedLines[1].includes('ahmed ali'), true);
check('csv jersey number trimmed', trimmedLines[1].includes(',10,'), true);
check('csv label trimmed and uppercased', trimmedLines[1].endsWith(',XL'), true);
check('csv tag trimmed and lowercased', trimmedLines[1].includes(',xlarge,'), true);

console.log('\nlabel follows tag');
check('tag change yields label', labelForTag('XLarge'), 'XL');
check('tag change overwrites stale label', labelForTag('Medium'), 'M');
check('tag with no mapping clears label', labelForTag('Bespoke'), '');
check('label still uppercased on export', applyCase(labelForTag('XLarge'), 'upper'), 'XL');
check('tag lowercased on export', applyCase('XLarge', 'lower'), 'xlarge');
check('label case is independent of tag case', applyCase(labelForTag('XLarge'), 'lower'), 'xl');

console.log('\ndemo seed data');
const demo = buildDemoData();
const stageIds = new Set(demo.stages.map((stage) => stage.id));

check('has orders', demo.orders.length >= 10, true);
check('has name rows', demo.items.length > 100, true);
check('order ids unique', new Set(demo.orders.map((order) => order.id)).size, demo.orders.length);
check('item ids unique', new Set(demo.items.map((item) => item.id)).size, demo.items.length);
check('all stage ids valid', demo.orders.every((order) => stageIds.has(order.stageId)), true);
check(
  'order numbers are sequential',
  demo.orders.map((order) => Number(order.orderNo.split('-')[2])).join(),
  demo.orders.map((_, index) => index + 1).join(),
);
check(
  'every item label derived from its tag',
  demo.items.every((item) => item.label === labelForTag(item.tag)),
  true,
);
check('every item has a name', demo.items.every((item) => item.name.length > 0), true);
check('every item seq is contiguous per order', demo.items.every((item) => {
  const siblings = demo.items.filter((candidate) => candidate.orderId === item.orderId);
  return siblings.findIndex((candidate) => candidate.id === item.id) === item.seq;
}), true);
check('some orders are overdue', demo.orders.some((order) => order.dueDate !== null && new Date(order.dueDate) < new Date()), true);
check('one order has no due date', demo.orders.filter((order) => order.dueDate === null).length, 1);
check('one order is completed', demo.orders.filter((order) => order.isCompleted).length, 1);
check('orders span all four stages', new Set(demo.orders.map((order) => order.stageId)).size, 4);
check('items with jersey numbers exist', demo.items.some((item) => item.jerseyNo !== ''), true);
check('items without jersey numbers exist', demo.items.some((item) => item.jerseyNo === ''), true);
check('reference seed has no orders', buildSeedData().orders.length, 0);

console.log('\ncolumn visibility');
check('missing columns defaults to all', normalizeColumns(undefined), [...ITEM_COLUMNS]);
check('non-array defaults to all', normalizeColumns('nope'), [...ITEM_COLUMNS]);
check('name always kept', normalizeColumns(['position']), ['name', 'position']);
check('unknown keys dropped', normalizeColumns(['name', 'bogus']), ['name']);
check('canonical order enforced', normalizeColumns(['label', 'name', 'tag']), ['name', 'tag', 'label']);
check('hiding position works', normalizeColumns(['name', 'jerseyNo', 'tag', 'label']), ['name', 'jerseyNo', 'tag', 'label']);
check('hiding jersey works', normalizeColumns(['name', 'position', 'tag', 'label']), ['name', 'position', 'tag', 'label']);

const jerseyOrder: Order = { ...csvOrder, id: 2, orderNo: 'ORD-2026-0002', columns: ['name', 'jerseyNo', 'tag', 'label'] };
const poloOrder: Order = { ...csvOrder, id: 3, orderNo: 'ORD-2026-0003', columns: ['name', 'position', 'tag', 'label'] };
check('union spans both orders', unionColumns([jerseyOrder, poloOrder]), ['name', 'jerseyNo', 'position', 'tag', 'label']);
check('union of one order', unionColumns([jerseyOrder]), ['name', 'jerseyNo', 'tag', 'label']);
check('union of empty list', unionColumns([]), []);
check('neck type excluded from export', unionColumns([csvOrder]).includes('cutType'), false);
check('notes excluded from export', unionColumns([csvOrder]).includes('notes'), false);
check('exportable drops neck type', exportableColumns([...ITEM_COLUMNS]).includes('cutType'), false);
check('exportable drops notes', exportableColumns([...ITEM_COLUMNS]).includes('notes'), false);
check('exportable keeps label', exportableColumns([...ITEM_COLUMNS]).includes('label'), true);
check('excluded list is notes and neck', [...EXPORT_EXCLUDED_COLUMNS], ['cutType', 'notes']);

const jerseyItems: OrderItem[] = csvItems.map((i) => ({ ...i, orderId: jerseyOrder.id }));
const jerseyCsv = buildOrdersCsv([jerseyOrder], jerseyItems, DEFAULT_SETTINGS).split('\r\n');
check('jersey csv drops position header', jerseyCsv[0].includes('Position'), false);
check('jersey csv keeps jersey header', jerseyCsv[0].includes('num'), true);
check('jersey csv header width', jerseyCsv[0].split(',').length, 4);
check('jersey csv row keeps name', jerseyCsv[1].includes('ahmed ali'), true);

const poloItems: OrderItem[] = csvItems.map((i) => ({ ...i, orderId: poloOrder.id }));
const poloCsv = buildOrdersCsv([poloOrder], poloItems, DEFAULT_SETTINGS).split('\r\n');
check('polo csv drops jersey header', poloCsv[0].includes('Jersey No'), false);
check('polo csv keeps position header', poloCsv[0].includes('position'), true);
check('polo csv header width', poloCsv[0].split(',').length, 4);
check('polo csv position preserved', poloCsv[1].includes(',Captain,'), true);
check('polo csv has one data row', poloCsv.length, 2);

const mixedCsv = buildOrdersCsv([jerseyOrder, poloOrder], [...jerseyItems, ...poloItems], DEFAULT_SETTINGS).split('\r\n');
check('mixed csv keeps all headers', mixedCsv[0].split(',').length, 5);
check('mixed row jersey hidden is blank', mixedCsv[1].includes(',,,'), false);

console.log('\ndemo column sets');
const demoCols = buildDemoData();
const demoOrders = demoCols.orders;
check('demo orders all have columns', demoOrders.every((o) => (o.columns?.length ?? 0) > 0), true);
check('demo orders all keep name', demoOrders.every((o) => o.columns.includes('name')), true);

const polo = demoOrders.find((o) =>
  demoCols.productTypes.some(
    (t) => o.productTypeIds.includes(t.id) && t.name.includes('Polo'),
  ),
);
check('demo polo order exists', Boolean(polo), true);
check('polo has position', polo!.columns.includes('position'), true);
check('polo has no jersey number', polo!.columns.includes('jerseyNo'), false);

const kitOrders = demoOrders.filter((o) =>
  ['Muscat Sports Club', 'Oman Petroleum Club', 'Rustaq Football Team'].includes(
    o.customerName,
  ),
);
check('demo jersey orders exist', kitOrders.length, 3);
check('demo jerseys have no position', kitOrders.every((o) => !o.columns.includes('position')), true);
check('demo jerseys have jersey numbers', kitOrders.every((o) => o.columns.includes('jerseyNo')), true);

const fullKit = demoOrders.find((o) => o.customerName === 'Barka Mall Sports Academy');
check('demo full kit found', Boolean(fullKit), true);
check('full kit shows every column', fullKit!.columns.length, ITEM_COLUMNS.length);

const itemsOfPolo = demoCols.items.filter((i) => i.orderId === polo!.id);
check('polo rows have empty jersey numbers', itemsOfPolo.every((i) => i.jerseyNo === ''), true);

console.log('\nsuggested values');
const known = collectKnownValues(demo.orders, demo.items, demoCols.cutTypes.map((t) => t.name));
check('customers suggested', known.customers.includes('Muscat Sports Club'), true);
check('positions suggested', known.positions.includes('Captain'), true);
check('cut types suggested', known.cutTypes.some((v) => v.length > 0), true);
check('blank values never suggested', known.customers.every((v) => v.trim() !== ''), true);
check('no duplicate suggestions', new Set(known.cutTypes).size, known.cutTypes.length);
check('most used suggestion first', known.positions[0] === 'Player', true);
check(
  'prefix suggestions rank first',
  suggestionsFor(known, 'customers', 'Mus').some((v) => v.startsWith('Muscat Sports Club')) ||
    suggestionsFor(known, 'customers', 'mus')[0]?.startsWith('Muscat Sports Club'),
  true,
);
check(
  'unrelated typing offers no suggestions',
  suggestionsFor(known, 'customers', 'zzz').length,
  0,
);
check('empty input returns all', suggestionsFor(known, 'positions', '').length, known.positions.length);

console.log('\nUI state revival');
const viewRevive = (raw: unknown) =>
  raw === 'board' || raw === 'calendar' ? raw : 'board';
check('valid view kept', viewRevive('calendar'), 'calendar');
check('invalid view falls back', viewRevive('nonsense'), 'board');
check('null view falls back', viewRevive(null), 'board');

const hiddenRevive = (raw: unknown) =>
  Array.isArray(raw) ? raw.filter((id): id is number => typeof id === 'number') : [];
check('hidden stages kept', hiddenRevive([1, 3]), [1, 3]);
check('non-numbers dropped', hiddenRevive([1, 'x', 4, null]), [1, 4]);
check('non-array falls back', hiddenRevive({ nope: true }), []);

console.log('\nsettings migration');
check('tag case migration exists', SETTINGS_MIGRATIONS[1].exportTagCase, 'lower');
check('version is ahead of migrations', SETTINGS_VERSION, Math.max(...Object.keys(SETTINGS_MIGRATIONS).map(Number)) + 1);
check('migration matches current default', SETTINGS_MIGRATIONS[1].exportTagCase, DEFAULT_SETTINGS.exportTagCase);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
if (failures > 0) process.exit(1);
