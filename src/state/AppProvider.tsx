import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addOrder,
  addOrderItem,
  deleteOrderItems,
  loadData,
  migrateSettings,
  putOrder,
  putOrderItem,
  putStages,
  removeOrder,
  replaceAll,
  replaceLists,
  replaceOrders,
  saveSettings,
  seedIfEmpty,
} from '@/db/database';
import { buildDemoOrders, buildSeedData } from '@/db/seed';
import { collectKnownValues, type KnownValues } from '@/lib/known';
import { nextOrderNo } from '@/lib/orderNo';
import {
  cleanSettings,
  cleanStageList,
  cleanProductTypeList,
  cleanCutTypeList,
  cleanText,
} from '@/lib/normalize';
import { labelForTag } from '@/lib/sizes';
import { downloadTextFile } from '@/lib/csv';
import type {
  AppData,
  BackupFile,
  CutType,
  ItemDraft,
  Order,
  OrderDraft,
  OrderItem,
  ProductType,
  Settings,
  Stage,
} from '@/types';

export type EditableRow = ItemDraft & { id?: number };

interface AppContextValue {
  loading: boolean;
  error: string | null;
  data: AppData;
  itemsByOrder: Map<number, OrderItem[]>;
  itemCounts: Map<number, number>;
  activeStages: Stage[];
  stageById: Map<number, Stage>;
  orderById: Map<number, Order>;
  known: KnownValues;
  suggestOrderNo: () => string;
  saveOrder: (draft: OrderDraft, rows: EditableRow[], existingId?: number) => Promise<number>;
  moveOrderStage: (orderId: number, stageId: number) => Promise<void>;
  setOrderCompleted: (orderId: number, isCompleted: boolean) => Promise<void>;
  deleteOrderById: (orderId: number) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  saveStageList: (stages: Stage[]) => Promise<void>;
  saveLists: (productTypes: ProductType[], cutTypes: CutType[]) => Promise<void>;
  exportBackup: () => void;
  importBackup: (file: File) => Promise<void>;
  loadDemoOrders: () => Promise<void>;
  deleteAllOrders: () => Promise<void>;
  resetAll: () => Promise<void>;
  reload: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY: AppData = { ...buildSeedData(), orders: [], items: [], stages: [] };

const EMPTY_KNOWN: KnownValues = { customers: [], positions: [], cutTypes: [] };

function normalizeRow(row: EditableRow): ItemDraft {
  const tag = cleanText(row.tag);
  return {
    name: cleanText(row.name),
    jerseyNo: cleanText(row.jerseyNo),
    position: cleanText(row.position),
    cutType: cleanText(row.cutType),
    tag,
    label: cleanText(row.label) || labelForTag(tag),
    notes: cleanText(row.notes),
    productTypeId: row.productTypeId ?? null,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await loadData();
    setData(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await seedIfEmpty();
        await migrateSettings();
        const next = await loadData();
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Failed to open local database');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const itemsByOrder = useMemo(() => {
    const map = new Map<number, OrderItem[]>();
    for (const item of data.items) {
      const list = map.get(item.orderId);
      if (list) list.push(item);
      else map.set(item.orderId, [item]);
    }
    return map;
  }, [data.items]);

  const itemCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of data.items) {
      map.set(item.orderId, (map.get(item.orderId) ?? 0) + 1);
    }
    return map;
  }, [data.items]);

  const activeStages = useMemo(
    () => data.stages.filter((stage) => stage.isActive),
    [data.stages],
  );

  const stageById = useMemo(
    () => new Map(data.stages.map((stage) => [stage.id, stage])),
    [data.stages],
  );

  const orderById = useMemo(
    () => new Map(data.orders.map((order) => [order.id, order])),
    [data.orders],
  );

  const configuredCutTypes = useMemo(
    () => data.cutTypes.map((type) => type.name),
    [data.cutTypes],
  );

  const known = useMemo(
    () =>
      data.orders.length === 0 && data.items.length === 0
        ? EMPTY_KNOWN
        : collectKnownValues(data.orders, data.items, configuredCutTypes),
    [configuredCutTypes, data.items, data.orders],
  );

  const suggestOrderNo = useCallback(
    () => nextOrderNo(data.orders),
    [data.orders],
  );

  const saveOrder = useCallback(
    async (draft: OrderDraft, rows: EditableRow[], existingId?: number) => {
      const now = new Date().toISOString();
      const normalized = rows.map((row) => normalizeRow(row));
      const orderFields = {
        ...draft,
        orderNo: cleanText(draft.orderNo),
        customerName: cleanText(draft.customerName),
        description: cleanText(draft.description),
      };

      let orderId: number;

      if (existingId === undefined) {
        orderId = await addOrder({ ...orderFields, createdAt: now, updatedAt: now });
        for (let seq = 0; seq < normalized.length; seq += 1) {
          await addOrderItem({ orderId, seq, ...normalized[seq] });
        }
      } else {
        orderId = existingId;
        const previous = data.orders.find((order) => order.id === existingId);
        await putOrder({
          ...orderFields,
          id: existingId,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        });

        const keptIds = rows
          .map((row) => row.id)
          .filter((id): id is number => id !== undefined);
        const removedIds = data.items
          .filter((item) => item.orderId === existingId && !keptIds.includes(item.id))
          .map((item) => item.id);
        await deleteOrderItems(removedIds);

        for (let seq = 0; seq < rows.length; seq += 1) {
          const item = normalized[seq];
          const rowId = rows[seq].id;
          if (rowId === undefined) {
            await addOrderItem({ orderId, seq, ...item });
          } else {
            await putOrderItem({ id: rowId, orderId, seq, ...item });
          }
        }
      }

      await reload();
      return orderId;
    },
    [data.items, data.orders, reload],
  );

  const moveOrderStage = useCallback(
    async (orderId: number, stageId: number) => {
      const order = data.orders.find((candidate) => candidate.id === orderId);
      if (!order || order.stageId === stageId) return;
      await putOrder({ ...order, stageId, updatedAt: new Date().toISOString() });
      await reload();
    },
    [data.orders, reload],
  );

  const setOrderCompleted = useCallback(
    async (orderId: number, isCompleted: boolean) => {
      const order = data.orders.find((candidate) => candidate.id === orderId);
      if (!order) return;
      await putOrder({
        ...order,
        isCompleted,
        updatedAt: new Date().toISOString(),
      });
      await reload();
    },
    [data.orders, reload],
  );

  const deleteOrderById = useCallback(
    async (orderId: number) => {
      await removeOrder(orderId);
      await reload();
    },
    [reload],
  );

  const updateSettings = useCallback(
    async (settings: Settings) => {
      await saveSettings(cleanSettings(settings));
      await reload();
    },
    [reload],
  );

  const saveStageList = useCallback(
    async (stages: Stage[]) => {
      await putStages(cleanStageList(stages));
      await reload();
    },
    [reload],
  );

  const saveLists = useCallback(
    async (productTypes: ProductType[], cutTypes: CutType[]) => {
      await replaceLists(cleanProductTypeList(productTypes), cleanCutTypeList(cutTypes));
      await reload();
    },
    [reload],
  );

  const exportBackup = useCallback(() => {
    const payload: BackupFile = {
      app: 'subli_om',
      version: 2,
      exportedAt: new Date().toISOString(),
      data,
    };
    downloadTextFile(
      `subli_om-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8',
    );
  }, [data]);

  const importBackup = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupFile;
      if (parsed.app !== 'subli_om' || !parsed.data) {
        throw new Error('That file is not a subli_om backup.');
      }
      await replaceAll(parsed.data);
      await reload();
    },
    [reload],
  );

  const resetAll = useCallback(async () => {
    await replaceAll(buildSeedData());
    await reload();
  }, [reload]);

  const loadDemoOrders = useCallback(async () => {
    const { orders, items } = buildDemoOrders();
    await replaceOrders(orders, items);
    await reload();
  }, [reload]);

  const deleteAllOrders = useCallback(async () => {
    await replaceOrders([], []);
    await reload();
  }, [reload]);

  const value = useMemo<AppContextValue>(
    () => ({
      loading,
      error,
      data,
      itemsByOrder,
      itemCounts,
      activeStages,
      stageById,
      orderById,
      known,
      suggestOrderNo,
      saveOrder,
      moveOrderStage,
      setOrderCompleted,
      deleteOrderById,
      updateSettings,
      saveStageList,
      saveLists,
      exportBackup,
      importBackup,
      loadDemoOrders,
      deleteAllOrders,
      resetAll,
      reload,
    }),
    [
      activeStages,
      data,
      deleteAllOrders,
      deleteOrderById,
      error,
      exportBackup,
      importBackup,
      itemCounts,
      itemsByOrder,
      known,
      loadDemoOrders,
      loading,
      moveOrderStage,
      orderById,
      reload,
      resetAll,
      saveOrder,
      saveStageList,
      saveLists,
      setOrderCompleted,
      stageById,
      suggestOrderNo,
      updateSettings,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return context;
}
