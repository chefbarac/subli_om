export type TagCase = 'lower' | 'title' | 'upper' | 'as-is';
export type NameCase = 'lower' | 'upper' | 'as-is';

export const ITEM_COLUMNS = [
  'name',
  'jerseyNo',
  'position',
  'neckType',
  'tag',
  'label',
  'notes',
] as const;
export type ColumnKey = (typeof ITEM_COLUMNS)[number];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Name',
  jerseyNo: 'Jersey No',
  position: 'Position',
  neckType: 'Neck Type',
  tag: 'Tag (size)',
  label: 'Label',
  notes: 'Notes',
};

export const TOGGLEABLE_COLUMNS: ColumnKey[] = ITEM_COLUMNS.filter(
  (key) => key !== 'name',
);

export const EXPORT_EXCLUDED_COLUMNS: ColumnKey[] = ['neckType', 'notes'];

export interface Stage {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Order {
  id: number;
  orderNo: string;
  customerName: string;
  description: string;
  dueDate: string | null;
  stageId: number;
  product: string;
  columns: ColumnKey[];
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  seq: number;
  name: string;
  jerseyNo: string;
  position: string;
  neckType: string;
  tag: string;
  label: string;
  notes: string;
}

export interface Settings {
  companyName: string;
  receiptFooter: string;
  currency: string;
  exportNameCase: NameCase;
  exportLabelCase: TagCase;
  exportTagCase: TagCase;
  exportPositionCase: TagCase;
}

export interface AppData {
  orders: Order[];
  items: OrderItem[];
  stages: Stage[];
  settings: Settings;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface ItemDraft {
  name: string;
  jerseyNo: string;
  position: string;
  neckType: string;
  tag: string;
  label: string;
  notes: string;
}

export interface OrderDraft {
  orderNo: string;
  customerName: string;
  description: string;
  dueDate: string | null;
  stageId: number;
  product: string;
  columns: ColumnKey[];
  isCompleted: boolean;
}

export type ViewMode = 'board' | 'calendar';

export interface BackupFile {
  app: 'subli_om';
  version: 1;
  exportedAt: string;
  data: AppData;
}
