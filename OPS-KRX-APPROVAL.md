# OneJellyInvest Ops Notes (KRX Approval + Public Repo Hardening)

Last updated: 2026-02-09

## Current Production Worker

- workers.dev URL: `https://onejellyinvest-api-production.pp48749.workers.dev`
- D1 (prod): `one-jelly-db` (id: `c69bb620-8759-48c4-87ba-0bbc1b6604fa`)

### Cron Schedules (production)

- News: `*/5 * * * *` (every 5 minutes)
- Disclosure: `0 * * * *` (hourly)
- Valuation/Prices: `0 7 * * *` (UTC 07:00 = KST 16:00)

## Why Prices/Valuations Weren't Showing

### Root cause (KRX)

- KRX OpenAPI calls were returning `401`:
  - Response JSON: `{"respMsg":"Unauthorized API Call","respCode":"401"}`
- Result: `price_daily=0`, `valuation_snapshot=0` in production D1, so mobile/web screens show nothing.

### Disclosure visibility (feed)

- Disclosures existed in DB but originally used date-only strings (`YYYY-MM-DD`), which sorted behind same-day news items.
- Fixed by storing `disclosed_at` as ISO datetime (KST end-of-day) and backfilling existing rows.

## Production Diagnostics

- Health: `GET /api/health`
- KRX probe (no secret leakage): `GET /api/health/krx`
  - Shows KOSPI/KOSDAQ endpoint status and `respMsg`/`respCode`.
  - When KRX approval is actually active, this should flip from 401 to 200.

## Public Repo Hardening (No Secrets in Git)

### What was removed from repo

- Removed committed values from `apps/api/wrangler.toml`:
  - `OPENDART_API_KEY`
  - `INTERNAL_API_SECRET`
- Removed hard-coded fallback secret in `apps/api/src/routes/internal.ts`.
- Added `.dev.vars` to `.gitignore`.
- Added local template: `apps/api/.dev.vars.example` (copy to `.dev.vars`, never commit).

### Worker secret name collisions (V2)

Cloudflare can block `wrangler secret put OPENDART_API_KEY` if the same binding name is already used as a var.
To avoid collisions, the code supports V2 secrets and prefers them:

- `OPENDART_API_KEY_V2` preferred over `OPENDART_API_KEY`
- `INTERNAL_API_SECRET_V2` preferred over `INTERNAL_API_SECRET`

Production secrets confirmed present:

- `KRX_API_KEY`
- `OPENDART_API_KEY_V2`
- `INTERNAL_API_SECRET_V2`

## Valuation Engine Readiness (Post-Approval)

To ensure the valuations screen is not permanently empty even if financial data is missing:

- Valuation snapshots are now created if `price_daily` exists, even when `financial_ttm` is missing.
  - Metrics remain `null` until financial data is available.
- Added runtime limits for valuation batch to prevent cron timeouts:
  - `runtimeBudgetMs` default ~25s
  - `maxCorps` default 500

## What To Do When KRX Approval Is Live

1. Confirm KRX works:
   - `GET /api/health/krx`
   - Expect 200 for both KOSPI/KOSDAQ.
2. Trigger a one-off run:
   - `POST /api/batch/valuation` with `x-api-secret` (internal)
3. Verify D1 is populated:
   - `price_daily` > 0
   - `valuation_snapshot` > 0
4. App verification:
   - Mobile/web valuations screens should start showing items without rebuilding the app.

## Relevant Commits (main)

- `326c044`: remove committed secrets; require INTERNAL_API_SECRET; add `.dev.vars` example
- `e1da4e7`: add V2 secret fallbacks for public repo + deploy-ready

