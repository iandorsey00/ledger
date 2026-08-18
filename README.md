# 家计 Ledger

A privacy-focused, local-first balance dashboard. Version 0.2 is an offline-capable browser application with separate Checking and Savings accounts, a derived combined-cash view, synthetic starter data, manual balance observations, mapped CSV import, arbitrary reporting periods, and summary-only PNG/CSV export.

## Run

Requires Node.js 20 or later. There are no third-party runtime or development dependencies.

```sh
npm start
```

Open `http://127.0.0.1:4173`. Run tests with `npm test`.

## Import workflow

- Import Checking and Savings CSV files together or separately.
- Map the bank's date and running-balance columns. Transaction amount, debit, and credit columns are not balances.
- Oldest-first and newest-first files are detected automatically. Mixed or ambiguous ordering requires an explicit choice.
- Multiple transactions on one date are reduced to the daily closing balance. Pending rows with blank balances are ignored.
- Imports replace the selected account's existing observations by default, preventing stale rows from previous datasets.
- Combined history uses synchronized account dates to avoid temporary transfer-related changes. A warning appears when the latest account dates differ.

## Privacy and security

- The app makes no network requests. Its Content Security Policy sets `connect-src 'none'`.
- Accounts and balance observations are stored in browser IndexedDB for the local origin. Combined cash is calculated locally without merging the source accounts.
- CSV parsing, calculations, charts, and exports happen in the browser.
- Summary exports contain dates and balance aggregates only. They never include source filenames or transaction descriptions.
- Synthetic data is installed on first launch. Real financial data must never be committed to this repository.
- Imported files are read in memory and are not copied into the project. Normalized observations are stored in the browser profile's IndexedDB, outside this directory.

Do not expose the local server beyond `127.0.0.1`. Browser storage is not encrypted at rest. Database encryption, macOS Keychain integration, and a native SQLite persistence adapter are the next security milestone.

## Architecture

- `src/domain.js`: normalized observations, reporting boundaries, calculations
- `src/csv.js`: validated parsing, row-order detection, and daily closing-balance normalization
- `src/storage.js`: replaceable IndexedDB persistence adapter
- `src/export.js`: UTF-8 CSV and deterministic 1200×860 PNG report generation
- `src/i18n.js`: English, Chinese, and bilingual localization resources
- `src/app.js`: interface orchestration only

IndexedDB is used instead of SQLite in this dependency-free browser milestone. The persistence boundary is intentionally small so a future native macOS shell can adopt SQLite without changing domain or export logic.

## Release and rollback

This repository has no build step or third-party package dependencies. A release is the reviewed source tree served by the local Node server.

Before release, run:

```sh
npm test
git diff --check
```

To roll back an unreleased branch, stop using that branch and return to the prior release branch or tag. To roll back a published change, revert the release commit with a new commit and push it through the normal review workflow. Browser data is versioned independently through IndexedDB schema upgrades; source rollback does not delete local financial observations.
