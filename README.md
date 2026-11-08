# STAR PLUS Frontend

Next.js app for STAR PLUS, an offline-first astronaut self-check app. Every screen
works offline through a service worker; readings queue in IndexedDB and sync when a
link returns.

## Overview

Crew log in with single-use access codes, run self-checks (manual form, questionnaire,
reaction test, CSV/FHIR import, Bluetooth, voice, camera display reading, camera
heart-rate estimate), review history charts and the body map, track progress and
gamification, read the medicines formulary, and file emergency reports (with optional
photos). A role-gated surgeon view reads crew results. All data is synthetic (see
`../starplus-backend/docs/disclosure.md`).

## Architecture

- `src/app/` — routes: `/check` (+ `questionnaire`, `reaction`, `bluetooth`, `voice`,
  `camera`, `camera-hr`), `/import`, `/body`, `/history`, `/progress`, `/medicines`,
  `/reports`, `/emergency`, `/surgeon`, `/settings`, `/demo`, `/login`, `/result`.
- `src/lib/adapters/` — input parsers: questionnaire, reaction, CSV, FHIR, BLE
  profiles/parse/simulator, voice grammar, OCR display parsing (Tesseract.js, loaded on
  demand), camera heart-rate estimation, attachments.
- `src/lib/outbox*.ts` + `src/lib/db.ts` — IndexedDB stores and the sync engine with
  backoff; `src/lib/assess-and-queue.ts` — on-device `assess()` before queueing.
- `core/` — synced from the backend by `tools/sync-core.sh`; never edited here.
- `src/app/sw.ts` + `next.config.ts` — Serwist service worker; new input screens must
  be precached and covered by `test/e2e/offline-routes.spec.ts`.

## Data sources

The catalog, knowledge base, formulary and reviewed explanations come from the
backend's `core/content/` (citation-checked). The placeholder model
(`core/content/model.json`, see `ml/MODEL_CARD.md` in the backend) trains on synthetic
data; the app falls back to limits and baselines without it.

## How to run

```bash
npm install
npm run dev            # local, against the staging backend
npm run build:staging  # staging build (NEXT_PUBLIC_API_BASE points at staging)
npm run start          # serve the build on :3100 for Playwright
```

Tests: `npm test` (vitest, incl. `core/`). Static: `npm run typecheck`, `npm run
lint`. E2E: `npx playwright test` (Chromium + WebKit; staging-code suites skip without
codes). Deploys via Vercel from `main`.

## How to swap the model

The model ships as data. Follow the backend README ("How to swap the model"):
regenerate `core/content/model.json` there, run `tools/sync-core.sh` from the backend
(which copies `core/` here), run `npm test`, and push — no frontend code changes.
