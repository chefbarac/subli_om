/**
 * Reading a dropped or picked CSV file into text.
 *
 * Kept separate from `paste.ts` so the parsing stays a pure string function and
 * the byte/encoding handling here can be tested without a DOM `File`.
 */

export const ACCEPTED_EXTENSIONS = ['.csv', '.txt', '.tsv'];

/**
 * MIME types we accept when the filename carries no useful extension. Several
 * tools write `.csv` as `application/vnd.ms-excel`, so the extension list is
 * still the primary check.
 */
const ACCEPTED_MIME = [
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
  'application/vnd.ms-excel',
];

/** A file bigger than this is refused rather than risking freezing the tab. */
const MAX_BYTES = 5 * 1024 * 1024;

export type PickableFile = Pick<File, 'name' | 'type' | 'size'>;

/**
 * Why a file was refused, or `null` when it is fine to read. Returns a message
 * rather than a boolean so the caller can show it verbatim.
 */
export function csvFileRejection(file: PickableFile): string | null {
  if (file.size > MAX_BYTES) {
    return `${file.name} is larger than 5 MB. Export just this order's rows instead.`;
  }

  const lower = file.name.toLowerCase();
  const hasExtension = ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (hasExtension) return null;

  const mime = file.type.toLowerCase();
  if (ACCEPTED_MIME.includes(mime)) return null;

  return `${file.name} is not a .csv, .txt or .tsv file. Drop a CSV exported from this app or a spreadsheet.`;
}

/**
 * Decode file bytes to text, sniffing the byte order mark.
 *
 * Excel's "Unicode Text" save is UTF-16LE with a `FF FE` BOM, which a plain
 * UTF-8 read turns into NUL-separated gibberish. TextDecoder strips the BOM it
 * recognises, so the header cell comes back as `name` and not as the same word
 * prefixed with the invisible BOM.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  const encoding = sniffEncoding(bytes);
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    // Unknown encoding label — UTF-8 is the best available guess.
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function sniffEncoding(bytes: Uint8Array): string {
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  }
  return 'utf-8';
}
