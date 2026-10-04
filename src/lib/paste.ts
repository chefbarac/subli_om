import { cleanText } from './normalize';
import { labelForTag } from './sizes';
import type { ItemDraft } from '@/types';

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
  neckType: ['neck', 'necktype', 'neckline', 'collar', 'collartype'],
  tag: ['tag', 'size', 'cloth', 'clothes', 'clothe', 'garment', 'clothsize'],
  label: ['label', 'abbr', 'abbreviation', 'short', 'code', 'sizeabbr'],
  notes: ['notes', 'note', 'comment', 'comments', 'remarks', 'remark'],
};

/**
 * Column order assumed when the pasted block has no recognisable header.
 * Neck type and notes are only picked up from a detected header, so adding
 * them here would shift every later column for existing spreadsheets.
 */
const DEFAULT_KEY_ORDER: DraftKey[] = ['name', 'jerseyNo', 'position', 'tag', 'label'];

function normalizeCell(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9#]/g, '');
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
    .map((line) => cleanText(line))
    .filter((line) => line !== '');

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

export function parsePastedNames(text: string): PasteResult {
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
      neckType: '',
      tag: '',
      label: '',
      notes: '',
    };

    row.forEach((rawCell, index) => {
      const key = mapping[index];
      if (!key) return;
      draft[key] = cleanText(rawCell);
    });

    if (!draft.name && !draft.jerseyNo && !draft.position && !draft.tag) continue;

    draft.label = draft.label || labelForTag(draft.tag);
    items.push(draft);
  }

  return { items, headerDetected, columns: mapping };
}
