import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, SETTINGS_VERSION, SETTINGS_MIGRATIONS, buildDemoData, buildSeedData } from './seed';
import { normalizeColumns, normalizeItemFields, normalizeOrderFields } from '@/lib/normalize';
import { nextNumericId } from '@/lib/ids';
import type {
  AppData,
  CutType,
  Order,
  OrderItem,
  ProductType,
  Settings,
  Stage,
} from '@/types';

const CURRENT_STORES = [
  'stages',
  'orders',
  'orderItems',
  'productTypes',
  'cutTypes',
  'settings',
] as const;
type CurrentStore = (typeof CURRENT_STORES)[number];

interface SubliDB extends DBSchema {
  stages: {
    key: number;
    value: Stage;
  };
  orders: {
    key: number;
    value: Order;
    indexes: { byStage: number };
  };
  orderItems: {
    key: number;
    value: OrderItem;
    indexes: { byOrder: number };
  };
  productTypes: {
    key: number;
    value: ProductType;
  };
  cutTypes: {
    key: number;
    value: CutType;
  };
  settings: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbPromise: Promise<IDBPDatabase<SubliDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SubliDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Drop stores the schema no longer declares (e.g. the old `sizes` and
        // `positions` lists). Listing the stores to keep, rather than the ones
        // to drop, means a store removed later needs no change here.
        // `idb` types deleteObjectStore() to only accept stores still in the
        // schema, which is exactly the operation a migration needs, hence the cast.
        const existing = Array.from(db.objectStoreNames as unknown as ArrayLike<string>);
        for (const name of existing) {
          if (!CURRENT_STORES.includes(name as CurrentStore)) {
            db.deleteObjectStore(name as never);
          }
        }
        if (!db.objectStoreNames.contains('stages')) {
          db.createObjectStore('stages', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('orders')) {
          const store = db.createObjectStore('orders', { keyPath: 'id' });
          store.createIndex('byStage', 'stageId');
        }
        if (!db.objectStoreNames.contains('orderItems')) {
          const store = db.createObjectStore('orderItems', { keyPath: 'id' });
          store.createIndex('byOrder', 'orderId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('productTypes')) {
          const store = db.createObjectStore('productTypes', { keyPath: 'id' });
          for (const type of buildSeedData().productTypes) store.put(type);
        }
        if (!db.objectStoreNames.contains('cutTypes')) {
          const store = db.createObjectStore('cutTypes', { keyPath: 'id' });
          for (const type of buildSeedData().cutTypes) store.put(type);
        }
      },
    });
  }
  return dbPromise;
}

export async function loadData(): Promise<AppData> {
  const db = await getDb();
  const tx = db.transaction(
    ['stages', 'orders', 'orderItems', 'productTypes', 'cutTypes', 'settings'],
    'readonly',
  );

  const [stages, orders, items, productTypes, cutTypes, settingRows] = await Promise.all([
    tx.objectStore('stages').getAll(),
    tx.objectStore('orders').getAll(),
    tx.objectStore('orderItems').getAll(),
    tx.objectStore('productTypes').getAll(),
    tx.objectStore('cutTypes').getAll(),
    tx.objectStore('settings').getAll(),
  ]);

  await tx.done;

  const stored = Object.fromEntries(settingRows.map((row) => [row.key, row.value]));
  const settings = { ...buildSeedData().settings } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(buildSeedData().settings)) {
    const value = stored[key];
    if (value !== undefined) settings[key] = value;
    else settings[key] = fallback;
  }

  return {
    stages: sortStages(stages),
    orders: sortOrders(orders),
    items: sortItems(items),
    productTypes: sortNames(productTypes),
    cutTypes: sortNames(cutTypes),
    settings: settings as unknown as Settings,
  };
}

function sortStages(rows: Stage[]): Stage[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function sortOrders(rows: Order[]): Order[] {
  return [...rows]
    .map((order) => ({
      ...order,
      columns: normalizeColumns(order.columns),
      ...normalizeOrderFields(order),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
}

function sortNames<T extends { sortOrder: number; id: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function sortItems(rows: OrderItem[]): OrderItem[] {
  return [...rows]
    .map((item) => ({ ...item, ...normalizeItemFields(item) }))
    .sort((a, b) => a.orderId - b.orderId || a.seq - b.seq || a.id - b.id);
}

export async function isEmpty(): Promise<boolean> {
  const db = await getDb();
  const count = await db.count('stages');
  return count === 0;
}

export async function seedIfEmpty(): Promise<void> {
  if (!(await isEmpty())) return;
  await replaceAll(buildDemoData());
}

export async function migrateSettings(): Promise<void> {
  const db = await getDb();
  const stored = Object.fromEntries(
    (await db.getAll('settings')).map((row) => [row.key, row.value]),
  );
  const version = Number(stored.settingsVersion ?? '0');
  if (version >= SETTINGS_VERSION) return;

  const changes = SETTINGS_MIGRATIONS[version];
  const tx = db.transaction('settings', 'readwrite');
  for (const [key, value] of Object.entries(changes ?? {})) {
    await tx.objectStore('settings').put({ key, value: String(value) });
  }
  await tx
    .objectStore('settings')
    .put({ key: 'settingsVersion', value: String(SETTINGS_VERSION) });
  await tx.done;
}

export async function replaceOrders(orders: Order[], items: OrderItem[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['orders', 'orderItems'], 'readwrite');
  await tx.objectStore('orders').clear();
  await tx.objectStore('orderItems').clear();
  for (const row of orders) await tx.objectStore('orders').put(row);
  for (const row of items) await tx.objectStore('orderItems').put(row);
  await tx.done;
}

export async function replaceAll(data: AppData): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ['stages', 'orders', 'orderItems', 'productTypes', 'cutTypes', 'settings'],
    'readwrite',
  );

  await Promise.all([
    tx.objectStore('stages').clear(),
    tx.objectStore('orders').clear(),
    tx.objectStore('orderItems').clear(),
    tx.objectStore('productTypes').clear(),
    tx.objectStore('cutTypes').clear(),
    tx.objectStore('settings').clear(),
  ]);

  for (const row of data.stages) await tx.objectStore('stages').put(row);
  for (const row of data.orders) await tx.objectStore('orders').put(row);
  for (const row of data.items) await tx.objectStore('orderItems').put(row);
  for (const row of data.productTypes) await tx.objectStore('productTypes').put(row);
  for (const row of data.cutTypes) await tx.objectStore('cutTypes').put(row);
  for (const [key, value] of Object.entries(data.settings)) {
    await tx.objectStore('settings').put({ key, value: String(value) });
  }

  await tx.done;
}

/** Replaces just the two editable name lists, used by the Settings screen. */
export async function replaceLists(
  productTypes: ProductType[],
  cutTypes: CutType[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['productTypes', 'cutTypes'], 'readwrite');
  await Promise.all([
    tx.objectStore('productTypes').clear(),
    tx.objectStore('cutTypes').clear(),
  ]);
  for (const row of productTypes) await tx.objectStore('productTypes').put(row);
  for (const row of cutTypes) await tx.objectStore('cutTypes').put(row);
  await tx.done;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('settings', 'readwrite');
  for (const [key, value] of Object.entries(settings)) {
    await tx.objectStore('settings').put({ key, value: String(value) });
  }
  await tx.done;
}

export async function putStage(stage: Stage): Promise<void> {
  const db = await getDb();
  await db.put('stages', stage);
}

export async function putStages(stages: Stage[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('stages', 'readwrite');
  for (const stage of stages) await tx.objectStore('stages').put(stage);
  await tx.done;
}

export async function deleteStage(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('stages', id);
}

export async function addOrder(order: Omit<Order, 'id'>): Promise<number> {
  const db = await getDb();
  const id = nextNumericId(await db.getAllKeys('orders'));
  return db.add('orders', { ...order, id });
}

export async function putOrder(order: Order): Promise<void> {
  const db = await getDb();
  await db.put('orders', order);
}

export async function addOrderItem(item: Omit<OrderItem, 'id'>): Promise<number> {
  const db = await getDb();
  const id = nextNumericId(await db.getAllKeys('orderItems'));
  return db.add('orderItems', { ...item, id });
}

export async function putOrderItem(item: OrderItem): Promise<void> {
  const db = await getDb();
  await db.put('orderItems', item);
}

export async function deleteOrderItems(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('orderItems', 'readwrite');
  for (const id of ids) await tx.objectStore('orderItems').delete(id);
  await tx.done;
}

export async function removeOrder(id: number): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['orders', 'orderItems'], 'readwrite');
  await tx.objectStore('orders').delete(id);
  const keys = await tx.objectStore('orderItems').index('byOrder').getAllKeys(id);
  for (const key of keys) {
    await tx.objectStore('orderItems').delete(key);
  }
  await tx.done;
}
