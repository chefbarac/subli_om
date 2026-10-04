const PALETTE = [
  {
    chip: 'bg-sky-100 text-sky-800 ring-sky-200',
    dot: 'bg-sky-500',
    card: 'border-sky-400 bg-sky-50',
  },
  {
    chip: 'bg-violet-100 text-violet-800 ring-violet-200',
    dot: 'bg-violet-500',
    card: 'border-violet-400 bg-violet-50',
  },
  {
    chip: 'bg-amber-100 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    card: 'border-amber-400 bg-amber-50',
  },
  {
    chip: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500',
    card: 'border-emerald-400 bg-emerald-50',
  },
  {
    chip: 'bg-rose-100 text-rose-800 ring-rose-200',
    dot: 'bg-rose-500',
    card: 'border-rose-400 bg-rose-50',
  },
  {
    chip: 'bg-teal-100 text-teal-800 ring-teal-200',
    dot: 'bg-teal-500',
    card: 'border-teal-400 bg-teal-50',
  },
  {
    chip: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
    dot: 'bg-indigo-500',
    card: 'border-indigo-400 bg-indigo-50',
  },
  {
    chip: 'bg-orange-100 text-orange-800 ring-orange-200',
    dot: 'bg-orange-500',
    card: 'border-orange-400 bg-orange-50',
  },
];

export interface StageTone {
  chip: string;
  dot: string;
  card: string;
}

export function stageTone(sortOrder: number): StageTone {
  return PALETTE[Math.abs(sortOrder) % PALETTE.length] ?? PALETTE[0];
}
