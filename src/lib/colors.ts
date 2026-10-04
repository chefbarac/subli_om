const PALETTE = [
  { chip: 'bg-sky-100 text-sky-800 ring-sky-200', dot: 'bg-sky-500' },
  { chip: 'bg-violet-100 text-violet-800 ring-violet-200', dot: 'bg-violet-500' },
  { chip: 'bg-amber-100 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  { chip: 'bg-emerald-100 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
  { chip: 'bg-rose-100 text-rose-800 ring-rose-200', dot: 'bg-rose-500' },
  { chip: 'bg-teal-100 text-teal-800 ring-teal-200', dot: 'bg-teal-500' },
  { chip: 'bg-indigo-100 text-indigo-800 ring-indigo-200', dot: 'bg-indigo-500' },
  { chip: 'bg-orange-100 text-orange-800 ring-orange-200', dot: 'bg-orange-500' },
];

export interface StageTone {
  chip: string;
  dot: string;
}

export function stageTone(sortOrder: number): StageTone {
  return PALETTE[Math.abs(sortOrder) % PALETTE.length] ?? PALETTE[0];
}
