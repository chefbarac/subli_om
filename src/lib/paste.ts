import { CSV_HEADERS } from './csv';
import { cleanText } from './normalize';
import { labelForTag } from './sizes';
import type { ColumnKey, ItemDraft } from '@/types';

// Product type is chosen from this order's list, never pasted as a cell.
type DraftKey = Exclude<keyof ItemDraft, 'productTypeId'>;

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
  cutType: ['cuttype', 'cut', 'neck', 'necktype', 'neckline', 'collar', 'collartype'],
  tag: ['tag', 'size', 'cloth', 'clothes', 'clothe', 'garment', 'clothsize'],
  label: ['label', 'abbr', 'abbreviation', 'short', 'code', 'sizeabbr'],
  notes: ['notes', 'note', 'comment', 'comments', 'remarks', 'remark'],
};

/**
 * The exact headers this app writes on export, reversed. Matching these first
 * means a CSV we produced always round-trips, including `num` and `pos`, which
 * the alias table below would otherwise miss or map to the wrong column.
 */
const CSV_HEADER_KEYS: Record<string, DraftKey> = Object.fromEntries(
  (Object.entries(CSV_HEADERS) as Array<[ColumnKey, string]>)
    .filter((entry): entry is [ColumnKey, string] => Boolean(entry[1]))
    .map(([key, header]) => [normalizeCell(header), key as DraftKey]),
);

/**
 * Column order assumed when the pasted block has no recognisable header.
 * Neck type and notes are only picked up from a detected header, so adding
 * them here would shift every later column for existing spreadsheets.
 */
const DEFAULT_KEY_ORDER: DraftKey[] = ['name', 'jerseyNo', 'position', 'tag', 'label'];

function normalizeCell(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9#]/g, '');
}

function detectHeader(cells: string[]): Array<DraftKey | undefined> | null {
  let matches = 0;
  const mapping: Array<DraftKey | undefined> = [];

  for (const cell of cells) {
    const normalized = normalizeCell(cell);
    // Our own export headers win; the friendly aliases are only a fallback for
    // spreadsheets written by hand. An unrecognised column is skipped rather
    // than folded into `name`, so a trailing blank Excel column cannot wipe
    // the name it sits next to.
    const key =
      CSV_HEADER_KEYS[normalized] ??
      (Object.keys(COLUMN_ALIASES) as DraftKey[]).find((candidate) =>
        COLUMN_ALIASES[candidate].includes(normalized),
      );
    mapping.push(key);
    if (key) matches += 1;
  }

  return matches >= 2 ? mapping : null;
}

/**
 * Work out whether the block is tab or comma separated before tokenising.
 *
 * Only the first row is inspected, because that is the row that defines the
 * file's structure. Scanning the whole block would let a stray tab inside a
 * later data cell turn a comma file into a TSV, and quote tracking keeps a
 * quoted cell from being mistaken for a delimiter run.
 */
function detectDelimiter(text: string): '\t' | ',' {
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) break;
    if (!inQuotes && char === '\t') return '\t';
  }
  return ',';
}

/**
 * Tokenise a delimited block, honouring RFC 4180 quoting.
 *
 * The old implementation did a naive `line.split(',')`, which could not read
 * back what this app itself writes: `escapeCell` wraps any cell containing a
 * comma in double quotes, so a name like `Doe, John` came back as two cells and
 * every later column shifted by one. Splitting on newlines first also broke any
 * cell that legitimately contained a line break.
 *
 * Rows where every cell is blank are dropped, matching the old empty-line
 * filter.
 */
function splitRows(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      // A quote only opens a quoted cell at the start of that cell, so a
      // stray quote in the middle of a value stays literal.
      if (cell === '') inQuotes = true;
      else cell += char;
      continue;
    }
    if (char === delimiter) {
      endCell();
      continue;
    }
    if (char === '\r') {
      if (text[i + 1] === '\n') i += 1;
      endRow();
      continue;
    }
    if (char === '\n') {
      endRow();
      continue;
    }
    cell += char;
  }

  // A trailing newline leaves nothing pending; anything else is a final row
  // with no terminator.
  if (cell !== '' || row.length > 0) endRow();

  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

export interface PasteResult {
  items: ItemDraft[];
  headerDetected: boolean;
  /** One entry per input cell; `undefined` marks a column we do not map. */
  columns: Array<DraftKey | undefined>;
}

export function parsePastedNames(text: string): PasteResult {
  const rows = splitRows(text);
  if (rows.length === 0) {
    return { items: [], headerDetected: false, columns: DEFAULT_KEY_ORDER };
  }

  let headerDetected = false;
  let mapping: Array<DraftKey | undefined> = DEFAULT_KEY_ORDER;
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
      cutType: '',
      productTypeId: null,
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

/** Case-insensitive, whitespace-insensitive identity used to match a name. */
export function nameKey(value: string): string {
  return cleanText(value).toLowerCase();
}

export interface PastedRowFields {
  name: string;
  jerseyNo: string;
  position: string;
  cutType: string;
  tag: string;
  label: string;
  notes: string;
}

export interface PasteMerge<T> {
  rows: T[];
  added: number;
  updated: number;
}

/**
 * Merge parsed CSV rows into an existing row list.
 *
 * A pasted row whose name matches a row already in the table updates that row;
 * anything else is appended. Two rules drive the details:
 *
 * - A blank cell never wipes a value already on the row, so a partial CSV can
 *   refresh some columns without clobbering the rest.
 * - Label follows Tag: it is only recomputed when the paste actually changes
 *   the tag, so a custom label survives a refresh that leaves the tag alone.
 *
 * The index is built once from `existing` and never extended, so a name
 * repeated inside the pasted block is added twice rather than merged away.
 */
export function mergePastedRows<T extends PastedRowFields>(
  existing: T[],
  incoming: ItemDraft[],
  makeRow: (item: ItemDraft) => T,
): PasteMerge<T> {
  const at = new Map<string, number>();
  existing.forEach((row, index) => {
    const key = nameKey(row.name);
    if (key && !at.has(key)) at.set(key, index);
  });

  const rows = [...existing];
  let added = 0;
  let updated = 0;

  for (const item of incoming) {
    const index = at.get(nameKey(item.name));
    if (index === undefined) {
      rows.push(makeRow(item));
      added += 1;
      continue;
    }

    const current = rows[index];
    const nextTag = cleanText(item.tag);
    const nextLabel = cleanText(item.label);
    const tagChanged = nextTag !== '' && nextTag !== current.tag;

    rows[index] = {
      ...current,
      jerseyNo: cleanText(item.jerseyNo) || current.jerseyNo,
      position: cleanText(item.position) || current.position,
      cutType: cleanText(item.cutType) || current.cutType,
      notes: cleanText(item.notes) || current.notes,
      tag: nextTag || current.tag,
      label: tagChanged
        ? nextLabel || labelForTag(nextTag)
        : nextLabel || current.label,
    };
    updated += 1;
  }

  return { rows, added, updated };
}
