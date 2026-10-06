# AGENTS.md

Notes for coding agents working on this repo.

## Git: commit, never push

**Commit your work locally. Do not run `git push`, and do not rename the current
branch.** The user handles pushing and deployment themselves.

- Local branch is `master`. The Pages workflow in `.github/workflows/deploy.yml`
  triggers on `push` to `main`, so pushing `master` will not deploy anything.
  This mismatch is known and intentional — do not "fix" it by renaming the
  branch or editing the workflow trigger.
- Before committing, run `npm run verify` and make sure it is fully green.
- When a change spans several files, prefer one commit with a short subject line
  plus a body explaining the reasoning, rather than a commit per file.

## Stack

Vite + React 18 + TypeScript, Tailwind, `idb` for IndexedDB, `date-fns` for
dates, `@dnd-kit` for drag-and-drop.

There is no backend. All data lives in the browser's IndexedDB under `DB_NAME`
in `src/db/seed.ts`. That has direct consequences:

- Adding a field to `Order` or `OrderItem` does **not** need a schema migration,
  because IndexedDB stores whole objects. Normalize old rows on read instead —
  see `normalizeColumns` / `normalizeItemFields` in `src/lib/normalize.ts`.
- Removing an object store **does** need a bump to `DB_VERSION`, plus an entry in
  the `upgrade` block in `src/db/database.ts`.
- Every store declares `keyPath` **without** `autoIncrement`. Inserting a row
  that lacks the key field throws `DataError` ("key path did not yield a
  value") rather than silently auto-numbering. `addOrder` / `addOrderItem`
  assign ids via `nextNumericId` from `src/lib/ids.ts` — keep that pattern for
  any new store that uses `add`.

## Verify

```
npm run verify   # typecheck + lint + smoke tests + production build
```

`npm run test` runs two suites:

- `npm run test:logic` → `scripts/smoke.ts`, a hand-rolled assertion script
  covering the pure logic: order numbering, CSV generation and case rules, the
  fixed size pairing, paste parsing, column visibility, and known-value
  collection.
- `npm run test:db` → `scripts/dbtest.ts`, which runs the real `src/db/database.ts`
  against `fake-indexeddb`. Use this whenever you change how rows are inserted
  or keyed — it is the only thing that can catch a bad IndexedDB key path.

There is no jsdom or React testing library, so component behaviour is **not**
covered — typecheck and build are the only safety net for JSX. When changing
logic that lives outside a component, add cases to `scripts/smoke.ts`.

## Domain rules worth remembering

- **Size pairing is fixed.** `XSmall`->`XS` through `5XLarge`->`5XL`, plus `B`->`B`,
  in `src/lib/sizes.ts`. Settings no longer lets the user edit it. Legacy tag
  spellings such as `Extra Large` and `2XL` resolve via an alias map so older
  saved orders keep working — keep that map intact.
- **Label always follows Tag.** Changing the tag overwrites the label. This is
  intentional; do not make the label independent again.
- **Columns are per order.** `Order.columns` decides what shows in the editor,
  the job sheet and the CSV. `name` is always forced on by `normalizeColumns`.
- **Notes and Neck Type are never exported to CSV.** See
  `EXPORT_EXCLUDED_COLUMNS`. Notes prints as a badge beside the name on the job
  sheet rather than as its own column.
- **Stage never appears on the print sheet.** It is deliberately only in the app.
