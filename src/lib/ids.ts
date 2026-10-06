/**
 * Smallest positive integer not already taken by an existing key.
 *
 * The IndexedDB stores declare `keyPath: 'id'` without `autoIncrement`, so every
 * insert has to bring its own key. Seeded rows get theirs from `buildSeedData`;
 * rows created at runtime get them from here.
 */
export function nextNumericId(keys: readonly number[]): number {
  let max = 0;
  for (const key of keys) {
    if (key > max) max = key;
  }
  return max + 1;
}
