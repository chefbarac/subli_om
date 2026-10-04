# subli_om

Order manager for a sublimation printing business. Tracks every job from **For Designing**
through **For Approval**, **For Printing** and **For Heatpress** to delivery.

The app is a fully static site — it runs from GitHub Pages (or any static host) and stores all
data **locally in the browser** using IndexedDB. There is no server and no account.

## Features

- **Board** — Kanban columns per stage, drag a card to move an order between stages.
- **Priority panel** — always-visible list of open orders bucketed by due date: overdue, due
  today, this week, later, no due date.
- **Calendar** — month grid of due dates with a checkbox per stage so you can hide the stages you
  are not working on, plus a day detail panel and an unscheduled list.
- **Order form** — customer, auto order number, product, description, due date, and a names table
  with `Name | Jersey No | Position | Neck Type | Tag | Label | Notes`.
- **Paste from Excel / Sheets** — currently hidden in the UI while the import flow is reworked. The
  parser still works and header auto-detection is unchanged.
- **Tag / Label** — the tag is the full size name you pick (`XLarge`), the label is the short code
  printed on the sheet and CSV (`XL`) and is filled in for you.
- **A4 job sheet** — printable sheet with blank price cells per row plus blank TOTAL, AMOUNT PAID
  and BALANCE lines for the operator to fill in by hand.
- **Show/hide columns per order** — each order decides whether it needs Jersey No, Position, Neck
  Type, Tag, Label and Notes. Name is always shown. Hide Position for a jersey order, or hide Jersey
  No for a polo shirt order. Hidden columns are also dropped from the printed sheet and the CSV.
- **Neck Type and Notes** — per-name fields for collar style and instructions. Neck Type is free
  type with suggestions; both are always excluded from the CSV export. On the job sheet, Notes is
  printed as a small badge beside the name rather than as its own column.
- **CSV export** — letter case is configurable per column in Settings. Defaults: names lowercase,
  labels UPPERCASE, tags lowercase, positions left as typed.
- **Fixed size pairing** — `XSmall`→`XS`, `Small`→`S`, `Medium`→`M`, `Large`→`L`, `XLarge`→`XL`,
  `2XLarge`→`2XL` … `5XLarge`→`5XL`, `B`→`B`. The label is filled in automatically whenever the
  tag changes. Older tag spellings such as `Extra Large` and `2XL` still resolve.
- **Suggested values** — customer, product, position and neck type inputs suggest what you have
  entered before, ranked by how often you use each value. Everything stays free type. Settings shows
  the current suggestion lists.
- **Reorder names by dragging** — grab the handle on the left of any row and drop it in place.
- **Backup** — download a JSON backup and restore it, because the data only lives in one browser.
- **Remembers your place** — the selected view (board or calendar) and which stages you have hidden
  on the calendar are stored in `localStorage` and restored next time you open the app.
- **Automatic trimming** — leading and trailing whitespace (spaces, tabs, blank lines, and the
  non-breaking spaces Excel likes to paste) is stripped from every field on save, in pasted name
  lists, in Settings lists and in CSV export.

## Demo data

On first run the app seeds 12 demo orders (146 names) spread across all four stages, including
overdue jobs, an unscheduled job and one completed job, so every view has something to show. Due
dates are generated relative to the day you first open the app.

When you are ready for real work, go to **Settings → Delete all orders**. That clears the demo data
while keeping your stages, sizes and positions. **Settings → Load demo orders** puts them back, and
**Settings → Reset all data** restores the original stages, size list and settings.

## Running locally

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

Then open the printed local URL (usually <http://localhost:5173>).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Logic tests for numbering, paste parsing, case rules and CSV |
| `npm run verify` | Everything above plus a production build |

## Deploying to GitHub Pages

The repository ships with `.github/workflows/deploy.yml`, which builds and publishes on every push
to `main`.

1. Push the repo to GitHub.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow publishes to `https://<user>.github.io/<repo>/`.

The build uses a relative `base`, so the app works from a repository sub-path without extra config.

To deploy somewhere else, run `npm run build` and upload the contents of `dist/`.

## Data and backups

Data lives in the browser's IndexedDB under the origin you opened the app from. This means:

- Orders are **not** shared between browsers, devices or people.
- Clearing site data, using a private window, or a different browser means a **different, empty**
  database.
- Use **Settings → Download backup (JSON)** regularly and store the file somewhere safe. Restore it
  with **Settings → Restore from backup** on any machine.

## Order numbers

Order numbers follow `ORD-YYYY-NNNN`, for example `ORD-2026-0001`. The sequence restarts every
January. The number is generated automatically when you open a new order and can still be edited by
hand if a customer quotes their own reference.
