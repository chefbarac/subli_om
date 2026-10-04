import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Order } from '@/types';

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toDate(iso: string): Date {
  return parseISO(iso);
}

export function formatDate(iso: string | null, pattern = 'dd MMM yyyy'): string {
  if (!iso) return '';
  return format(toDate(iso), pattern);
}

export function daysUntil(iso: string): number {
  return differenceInCalendarDays(toDate(iso), new Date());
}

export function isOverdue(order: Order): boolean {
  if (order.isCompleted || !order.dueDate) return false;
  return daysUntil(order.dueDate) < 0;
}

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

export const DUE_BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'week', 'later', 'none'];

export const DUE_BUCKET_TITLES: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Due this week',
  later: 'Later',
  none: 'No due date',
};

export function dueBucketFor(dueDate: string | null): DueBucket {
  if (!dueDate) return 'none';
  const diff = daysUntil(dueDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'week';
  return 'later';
}

export function dueBucket(order: Order): DueBucket {
  if (order.isCompleted) return 'none';
  return dueBucketFor(order.dueDate);
}

export function dueLabel(iso: string | null): string {
  if (!iso) return 'No due date';
  const diff = daysUntil(iso);
  if (diff < 0) {
    const days = Math.abs(diff);
    return `${days} day${days === 1 ? '' : 's'} overdue`;
  }
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return formatDate(iso, 'EEE, dd MMM');
}

export function monthMatrix(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function shiftMonth(anchor: Date, amount: number): Date {
  return addMonths(anchor, amount);
}

export function shiftWeek(anchor: Date, amount: number): Date {
  return addDays(anchor, amount * 7);
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export { isSameMonth, format as formatDateFns };
