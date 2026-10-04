export type TagCase = 'lower' | 'title' | 'upper' | 'as-is';
export type NameCase = 'lower' | 'upper' | 'as-is';

export const ITEM_COLUMNS = [
  'name',
  'jerseyNo',
  'position',
  'cutType',
  'tag',
  'label',
  'notes',
] as const;
export type ColumnKey = (typeof ITEM_COLUMNS)[number];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Name',
  jerseyNo: 'Jersey No',
  position: 'Position',
  cutType: 'Cut Type',
  tag: 'Tag (size)',
  label: 'Label',
  notes: 'Notes',
};

export const TOGGLEABLE_COLUMNS: ColumnKey[] = ITEM_COLUMNS.filter(
  (key) => key !== 'name',
);

export const EXPORT_EXCLUDED_COLUMNS: ColumnKey[] = ['cutType', 'notes'];

/** Columns that never appear as their own column on the printed job sheet. */
export const SHEET_HIDDEN_COLUMNS: ColumnKey[] = ['notes', 'tag'];

export interface Stage {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** A kind of garment an order can be made of, editable in Settings. */
export interface ProductType {
  id: number;
  name: string;
  sortOrder: number;
}

/** A collar/finish option per name, editable in Settings. */
export interface CutType {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Order {
  id: number;
  orderNo: string;
  customerName: string;
  description: string;
  dueDate: string | null;
  stageId: number;
  productTypeIds: number[];
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
  cutType: string;
  tag: string;
  label: string;
  notes: string;
  /** null means the row has not been assigned to a product type yet. */
  productTypeId: number | null;
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
  productTypes: ProductType[];
  cutTypes: CutType[];
  settings: Settings;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface ItemDraft {
  name: string;
  jerseyNo: string;
  position: string;
  cutType: string;
  tag: string;
  label: string;
  notes: string;
  productTypeId: number | null;
}

export interface OrderDraft {
  orderNo: string;
  customerName: string;
  description: string;
  dueDate: string | null;
  stageId: number;
  productTypeIds: number[];
  columns: ColumnKey[];
  isCompleted: boolean;
}

export type ViewMode = 'board' | 'calendar';

export interface BackupFile {
  app: 'subli_om';
  version: 2;
  exportedAt: string;
  data: AppData;
}
