import { cleanText } from './normalize';
import type { NameCase, TagCase } from '@/types';

const SHORT_CODE = /^[A-Z0-9]{1,3}$/;

function toTitleCaseKeepingShortCodes(value: string): string {
  return value
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === '') return part;
      if (SHORT_CODE.test(part.toUpperCase())) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

export function applyCase(value: string, mode: NameCase | TagCase): string {
  const trimmed = cleanText(value);
  if (mode === 'as-is') return trimmed;
  if (mode === 'upper') return trimmed.toUpperCase();
  if (mode === 'lower') return trimmed.toLowerCase();
  return toTitleCaseKeepingShortCodes(trimmed);
}
