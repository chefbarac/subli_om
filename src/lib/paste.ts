import { labelForTag } from './sizes';
import type { ItemDraft, SizeOption } from '@/types';

type DraftKey = keyof ItemDraft;

const COLUMN_ALIASES: Record<DraftKey, string[]> = {
  name: ['name', 'names', 'player', 'playername', 'customername', 'fullname'],
  jerseyNo: [
    'jerseyno',
    'jersey',
    'jerseynumber',
    'number',
    'no',
    'num',
    'shirt',
    'shirtno',
    'backnumber',
  ],
  position: ['position', 'role', 'rank', 'post', 'designation'],
  tag: ['tag', 'size', 'cloth', 'clothes', 'clothe', 'garment', 'clothsize'],
  label: ['label', 'abbr', 'abbreviation', 'short', 'code', 'sizeabbr'],
};

const DEFAULT_KEY_ORDER: DraftKey[] = ['name', 'jerseyNo', 'position', 'tag', 'label'];

function normalizeCell(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9#]/g, '');
}

function detectHeader(cells: string[]): DraftKey[] | null {
  let matches = 0;
  const mapping: DraftKey[] = [];

  for (const cell of cells) {
    const normalized = normalizeCell(cell);
    const key = (Object.keys(COLUMN_ALIASES) as DraftKey[]).find((candidate) =>
      COLUMN_ALIASES[candidate].includes(normalized),
    );
    mapping.push(key ?? 'name');
    if (key) matches += 1;
  }

  return matches >= 2 ? mapping : null;
}

function splitRows(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '');

  const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : ',';

  return lines.map((line) =>
    delimiter === '\t' ? line.split('\t') : line.split(delimiter),
  );
}

export interface PasteResult {
  items: ItemDraft[];
  headerDetected: boolean;
  columns: DraftKey[];
}

export function parsePastedNames(text: string, sizes: SizeOption[]): PasteResult {
  const rows = splitRows(text);
  if (rows.length === 0) {
    return { items: [], headerDetected: false, columns: DEFAULT_KEY_ORDER };
  }

  let headerDetected = false;
  let mapping = DEFAULT_KEY_ORDER;
  let dataRows = rows;

  const header = detectHeader(rows[0]);
  if (header) {
    headerDetected = true;
    mapping = header;
    dataRows = rows.slice(1);
  }

  if (headerDetected && dataRows.length === 0) {
    headerDetected = false;
    mapping = DEFAULT_KEY_ORDER;
    dataRows = rows;
  }

  const items: ItemDraft[] = [];

  for (const row of dataRows) {
    const draft: ItemDraft = {
      name: '',
      jerseyNo: '',
      position: '',
      tag: '',
      label: '',
    };

    row.forEach((rawCell, index) => {
      const key = mapping[index];
      if (!key) return;
      draft[key] = rawCell.trim();
    });

    if (!draft.name && !draft.jerseyNo && !draft.position && !draft.tag) continue;

    draft.label = draft.label || labelForTag(draft.tag, sizes);
    items.push(draft);
  }

  return { items, headerDetected, columns: mapping };
}
