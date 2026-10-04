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
  with `Name | Jersey No | Position | Tag | Label`.
- **Paste from Excel / Sheets** — copy a block of cells, paste it, and the rows are created with
  the right columns. Headers are auto-detected.
- **Tag / Label** — the tag is the full size name you pick (`Extra Large`), the label is the short
  code printed on the sheet and CSV (`XL`). Both lists are configurable in Settings.
- **A4 job sheet** — printable sheet with blank price cells per row plus blank TOTAL, AMOUNT PAID
  and BALANCE lines for the operator to fill in by hand.
- **CSV export** — with configurable letter-case rules (names lowercase, labels uppercase, tag
  title case or uppercase).
- **Backup** — download a JSON backup and restore it, because the data only lives in one browser.

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
