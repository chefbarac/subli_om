import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DB_NAME, DB_VERSION, buildSeedData } from './seed';
import type {
  AppData,
  Order,
  OrderItem,
  PositionOption,
  Settings,
  SizeOption,
  Stage,
} from '@/types';

interface SubliDB extends DBSchema {
  stages: {
    key: number;
    value: Stage;
  };
  sizes: {
    key: number;
    value: SizeOption;
  };
  positions: {
    key: number;
    value: PositionOption;
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
        if (!db.objectStoreNames.contains('stages')) {
          db.createObjectStore('stages', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sizes')) {
          db.createObjectStore('sizes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('positions')) {
          db.createObjectStore('positions', { keyPath: 'id' });
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
      },
    });
  }
  return dbPromise;
}

export async function loadData(): Promise<AppData> {
  const db = await getDb();
  const tx = db.transaction(
    ['stages', 'sizes', 'positions', 'orders', 'orderItems', 'settings'],
    'readonly',
  );

  const [stages, sizes, positions, orders, items, settingRows] = await Promise.all([
    tx.objectStore('stages').getAll(),
    tx.objectStore('sizes').getAll(),
    tx.objectStore('positions').getAll(),
    tx.objectStore('orders').getAll(),
    tx.objectStore('orderItems').getAll(),
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
    sizes: sortSizes(sizes),
    positions: sortPositions(positions),
    orders: sortOrders(orders),
    items: sortItems(items),
    settings: settings as unknown as Settings,
  };
}

function sortStages(rows: Stage[]): Stage[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function sortSizes(rows: SizeOption[]): SizeOption[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function sortPositions(rows: PositionOption[]): PositionOption[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function sortOrders(rows: Order[]): Order[] {
  return [...rows].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
  );
}

function sortItems(rows: OrderItem[]): OrderItem[] {
  return [...rows].sort((a, b) => a.orderId - b.orderId || a.seq - b.seq || a.id - b.id);
}

export async function isEmpty(): Promise<boolean> {
  const db = await getDb();
  const count = await db.count('stages');
  return count === 0;
}

export async function seedIfEmpty(): Promise<void> {
  if (!(await isEmpty())) return;
  const seed = buildSeedData();
  await replaceAll(seed);
}

export async function replaceAll(data: AppData): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ['stages', 'sizes', 'positions', 'orders', 'orderItems', 'settings'],
    'readwrite',
  );

  await Promise.all([
    tx.objectStore('stages').clear(),
    tx.objectStore('sizes').clear(),
    tx.objectStore('positions').clear(),
    tx.objectStore('orders').clear(),
    tx.objectStore('orderItems').clear(),
    tx.objectStore('settings').clear(),
  ]);

  for (const row of data.stages) await tx.objectStore('stages').put(row);
  for (const row of data.sizes) await tx.objectStore('sizes').put(row);
  for (const row of data.positions) await tx.objectStore('positions').put(row);
  for (const row of data.orders) await tx.objectStore('orders').put(row);
  for (const row of data.items) await tx.objectStore('orderItems').put(row);
  for (const [key, value] of Object.entries(data.settings)) {
    await tx.objectStore('settings').put({ key, value: String(value) });
  }

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

export async function putSizes(sizes: SizeOption[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('sizes', 'readwrite');
  for (const size of sizes) await tx.objectStore('sizes').put(size);
  await tx.done;
}

export async function deleteSize(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('sizes', id);
}

export async function putPositions(positions: PositionOption[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('positions', 'readwrite');
  for (const position of positions) await tx.objectStore('positions').put(position);
  await tx.done;
}

export async function deletePosition(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('positions', id);
}

export async function addOrder(order: Omit<Order, 'id'>): Promise<number> {
  const db = await getDb();
  return db.add('orders', order as Order);
}

export async function putOrder(order: Order): Promise<void> {
  const db = await getDb();
  await db.put('orders', order);
}

export async function addOrderItem(item: Omit<OrderItem, 'id'>): Promise<number> {
  const db = await getDb();
  return db.add('orderItems', item as OrderItem);
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
