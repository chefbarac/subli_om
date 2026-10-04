export type TagCase = 'title' | 'upper' | 'as-is';
export type NameCase = 'lower' | 'upper' | 'as-is';

export interface Stage {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface SizeOption {
  id: number;
  name: string;
  label: string;
  sortOrder: number;
}

export interface PositionOption {
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
  product: string;
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
  tag: string;
  label: string;
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
  sizes: SizeOption[];
  positions: PositionOption[];
  settings: Settings;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface ItemDraft {
  name: string;
  jerseyNo: string;
  position: string;
  tag: string;
  label: string;
}

export interface OrderDraft {
  orderNo: string;
  customerName: string;
  description: string;
  dueDate: string | null;
  stageId: number;
  product: string;
  isCompleted: boolean;
}

export type ViewMode = 'board' | 'calendar';

export interface BackupFile {
  app: 'subli_om';
  version: 1;
  exportedAt: string;
  data: AppData;
}
