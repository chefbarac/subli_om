import type { SizeOption } from '@/types';

export function labelForTag(tag: string, sizes: SizeOption[]): string {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return '';
  const match = sizes.find(
    (size) =>
      size.name.trim().toLowerCase() === normalized ||
      size.label.trim().toLowerCase() === normalized,
  );
  return match ? match.label : '';
}

export function sizeNames(sizes: SizeOption[]): string[] {
  return sizes.map((size) => size.name);
}
