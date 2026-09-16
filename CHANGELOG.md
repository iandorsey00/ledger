# Changelog

## 0.3.0 — 2026-09-15

- Make Total deposits the default dashboard view, with Available cash as a separate Checking-and-Savings view.
- Add multiple named Checking, Savings, CD, and other deposit accounts, with optional CD maturity dates.
- Make manual entry, CSV import staging, and data-clearing scopes account-driven.
- Include CD balances only after their first observation; use synchronized liquid-account dates for historical totals.
- Disclose omitted accounts and carried-forward balance dates in the dashboard and PNG sharing.
- Localize the new account and total labels in English, Chinese, and bilingual reports.

## 0.2.0 — 2026-08-17

- Add separate Checking and Savings accounts with a combined-cash view.
- Add simultaneous, account-scoped CSV import with safe replacement defaults.
- Normalize transaction exports into daily closing-balance observations.
- Ignore pending rows with blank running balances.
- Add synchronized combined history and mismatched-date warnings.
- Add adaptive reporting periods, chart value labels, date bands, and localized time axes.
- Add English, Chinese, and bilingual CSV and PNG sharing.
- Add local data-clearing controls for individual or all accounts.
- Keep all parsing, storage, calculations, and export generation local to the browser.
