/**
 * Regression test for the "+ New order" crash:
 *
 *   Failed to execute 'add' on 'IDBObjectStore':
 *   Evaluating the object store's key path did not yield a value.
 *
 * The stores declare `keyPath: 'id'` without `autoIncrement`, so a row inserted
 * without an `id` has no key to evaluate. This drives the real database module
 * through fake-indexeddb rather than asserting on the helper in isolation.
 */
import 'fake-indexeddb/auto';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
  }
}

async function main(): Promise<void> {
  const { addOrder, addOrderItem, loadData } = await import('@/db/database');
  const { buildSeedData, DB_NAME, DB_VERSION } = await import('@/db/seed');
  const { ITEM_COLUMNS } = await import('@/types');
  const { openDB } = await import('idb');

  const getRawDb = () => openDB(DB_NAME, DB_VERSION);

  const seed = buildSeedData();

  const base = {
    customerName: 'Muscat Sports Club',
    description: '',
    dueDate: null,
    stageId: seed.stages[0].id,
    productTypeIds: [seed.productTypes[0].id],
    columns: [...ITEM_COLUMNS],
    isCompleted: false,
  };

  console.log('new order insert');

  const first = await addOrder({ ...base, orderNo: 'ORD-2026-0001', createdAt: '', updatedAt: '' });
  check('first order gets an id', first > 0, true);

  const second = await addOrder({ ...base, orderNo: 'ORD-2026-0002', createdAt: '', updatedAt: '' });
  check('second order does not reuse the first id', second !== first, true);

  console.log('\nnew order item insert');

  // This is the call that used to throw DataError.
  const itemFields = {
    name: 'Ahmed Al Hinai',
    jerseyNo: '10',
    position: 'Captain',
    cutType: 'Jersey Standard',
    tag: 'XLarge',
    label: 'XL',
    notes: '',
    productTypeId: seed.productTypes[0].id,
  };

  const itemOne = await addOrderItem({ orderId: first, seq: 0, ...itemFields });
  check('item gets an id', itemOne > 0, true);

  const itemTwo = await addOrderItem({
    orderId: first,
    seq: 1,
    ...itemFields,
    name: 'Bilal',
    jerseyNo: '7',
  });
  check('second item does not reuse the first id', itemTwo !== itemOne, true);

  console.log('\nround trip');

  const data = await loadData();
  check('both orders persisted', data.orders.length, 2);
  check('both items persisted', data.items.length, 2);
  check('items keep their order id', data.items.every((item) => item.orderId === first || item.orderId === second), true);
  check('row order ids match the returned key', data.items.map((item) => item.orderId).sort(), [first, first]);

  // A third insert must land past everything already stored, including rows
  // deleted out of the middle of the sequence.
  const third = await addOrder({ ...base, orderNo: 'ORD-2026-0003', createdAt: '', updatedAt: '' });
  check('third order lands past the max', third > second, true);

  console.log('\nlegacy order key 0');

  // Older builds spread `draftOrder` (which uses `id: existing?.id ?? 0`) straight
  // into addOrder, so the order row committed under key 0 before the item insert
  // failed. Real databases can therefore hold that row — new inserts must not
  // collide with it.
  const raw = await getRawDb();
  await raw.put('orders', {
    ...base,
    id: 0,
    orderNo: 'ORD-LEGACY-0000',
    createdAt: '',
    updatedAt: '',
  });
  check('legacy key 0 is present', (await raw.getAllKeys('orders')).includes(0), true);

  const afterLegacy = await addOrder({ ...base, orderNo: 'ORD-2026-0004', createdAt: '', updatedAt: '' });
  check('insert still works alongside key 0', afterLegacy > 0, true);
  check('new id is never 0', afterLegacy !== 0, true);

  const afterLegacyItem = await addOrderItem({ orderId: afterLegacy, seq: 0, ...itemFields });
  check('item insert works alongside key 0', afterLegacyItem > 0, true);

  const finalData = await loadData();
  check('all five orders readable', finalData.orders.length, 5);
  check('legacy row survives', finalData.orders.some((o) => o.id === 0), true);

  console.log(`\n${failures === 0 ? 'DB CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exit(1);
}

void main();
