<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# STAR PLUS frontend: guide for coding agents

State as of **2026-11-10**. Read this whole file before changing anything.

## 1. What this is

STAR PLUS is an **offline-first astronaut health self-check app**, built for the NASA Space
Apps 2026 "Health Monitoring Software" challenge (hackathon **2026-11-14/15**).

*   An **astronaut** runs a self-check (manual entry, Bluetooth, camera, voice, reaction test,
    questionnaire, import). The device scores it and shows a status per measure, with the
    reason and a cited source.
*   A **flight surgeon** (Flight Medical Officer) or **Mission Control** sees a crew
    dashboard, each person's detail page and a reports inbox.
*   **Emergency mode** works on every screen, with no login and no network.
*   **Judges** use the demo: three role cards on `/login` fill a username and password, then
    Login. Demo accounts hold synthetic crew data only.

| | |
|---|---|
| Production frontend | https://starplus-frontend.vercel.app (Vercel; **every push to `main` deploys to production**) |
| Production API | https://starplus-backend.shareflow.workers.dev (Cloudflare Worker + D1, separate repo `starplus-backend`) |
| Staging API | https://starplus-backend-staging.shareflow.workers.dev (allows CORS only from `http://localhost:3100`) |
| Repos | `ariandesu/starplus-frontend` (this repo), `ariandesu/starplus-backend` |

The approved product design is `../docs/designs/self-check-platform.md`. The audit trail is
in `../docs/audits/`; the latest is `audit-2026-11-10-better-auth.md`.

**Stale files; do not follow them:** `DESIGN_DRAFT.md` and `DEPLOYMENT_STATUS.md` describe an
older GSAP/bento/marquee landing page that the design removed. `README.md` may lag behind.

## 2. Stack

*   **Next.js 16.4.5** (App Router), **React 19.3**, TypeScript. Builds with
    `next build --webpack`, because Serwist needs webpack.
*   **Tailwind CSS v4.** Tokens are in `src/app/globals.css` (`@theme inline`); there is no
    `tailwind.config`.
*   Small shadcn-style primitives in `src/components/ui/` (`button`, `card`, `badge`,
    `input`, `separator`, `skeleton`), built on `class-variance-authority`, `clsx` and
    `tailwind-merge` (`cn()` in `src/lib/utils.ts`).
*   Icons: `lucide-react`. Charts: `recharts`. OCR: `tesseract.js` (loaded only on use).
*   **Offline:** Serwist service worker `src/app/sw.ts` (pages network-first with a 3 s
    timeout, then the cache; static assets precached; an "Updated. Reload" bar).
    IndexedDB via `idb` (`src/lib/db.ts`). An outbox syncs to the API when online.
*   **Auth:** Better Auth client (`src/lib/auth-client.ts`) with **bearer tokens** (not
    cookies: the frontend and API are on different sites). One session layer:
    `src/lib/session.ts` → `useSession()` → `<RequireSession>`
    (`src/components/require-session.tsx`).
*   **Font:** Satoshi, self-hosted in `public/fonts` (400/500/700) so it works offline.

## 3. Map of the code

```
src/app/                    routes (all client pages reading IndexedDB; work offline)
  layout.tsx                wraps every page in <AppShell> + service worker register
  page.tsx                  Home (astronaut "Today"); surgeons are redirected to /surgeon
  login/                    role cards, username/password, "Use your access code" (redeem)
  check/ (+ bluetooth, camera, camera-hr, voice, reaction, questionnaire)
  result/  history/  body/  progress/  medicines/  reports/  settings/  import/  demo/
  emergency/                emergency flow (self or crewmate, one step per screen)
  surgeon/ (+ crew, reports) role-gated dashboard for flight_medical_officer / mission_control
  sw.ts  manifest.ts  globals.css
src/components/
  navigation/dashboard-shell.tsx   AppShell: top bar, side nav, demo banner, emergency button
  navigation/mobile-nav.tsx
  dashboard/                status card (empty-state.tsx), demo badge, vital chart
  surgeon/                  crew-board, crew-detail, reports-inbox, report-photos, use-surgeon
  ui/                       primitives
  body-map, readiness-ring, model-view, measure-form, reading-preview, citation,
  continue-as (profile picker), require-session, waiting-banner, outbox-sync
src/lib/                    logic: session, auth-client, api, db, outbox, adapters/*, nav-items, ...
core/                       shared code + content, synced from the backend (see rule 3)
test/                       Vitest unit tests;  test/e2e/  Playwright specs
```

The menu comes from `src/lib/nav-items.ts`: astronauts get the full list; surgeon and Mission
Control roles get Dashboard, Crew, Reports, Emergency, Medicines and Settings.

## 4. Rules you must not break

1.  **Status meaning is fixed.** `assess()` in `core/` alone decides a status. The UI only
    displays it. There are four statuses with fixed meaning and colour family:
    *   nominal (the accent);
    *   **watch** (amber);
    *   **critical** (red);
    *   **insufficient** (grey, "no baseline yet").

    You may restyle them, but never merge, rename or recolour them into a different
    meaning. Status must not rely on colour alone: keep the icon and the word.
2.  **The model view is advisory.** `model-view.tsx` stays a neutral grey panel with no
    status colours or status words, and keeps its fixed disagreement text.
3.  **Do not edit `core/`.** It is copied from the backend and checked by
    `test/core-checksum.test.ts` against `core/core.sha256`.
4.  **Emergency stays reachable from every screen**, works logged out and offline, and is
    visually prominent.
5.  **Offline first.** No remote fonts, CSS or scripts (no Google Fonts, no CDN). Every
    asset must be precacheable. Keep pages as client components that render without the
    network. Keep the camera and OCR code lazy-loaded.
6.  **Safety wording.** Keep the citations (`citation.tsx`). Keep the source line on the
    result page ("From the cited source." / "AI-written, reviewed by the developer against
    the cited source."). Keep the data notice in Settings. Never invent medical text, doses
    or thresholds.
7.  **Demo honesty.** When a demo account is active, exactly **one** banner reads
    "Demo: synthetic crew data" (`data-testid="demo-banner"`, in the AppShell).
8.  **Accessibility.** Touch targets at least 44 px (set in `globals.css`), visible focus
    rings, real headings and labelled controls, WCAG AA contrast, mobile-first (one column
    below 768 px), no horizontal scroll at 375 px.
9.  **Do not change behaviour while redesigning.** Leave `src/lib/**`, `src/app/sw.ts`, the
    auth/session flow, IndexedDB schemas and API calls alone unless a visual change truly
    needs it, and say so in your report. The backend is out of scope.
10. **Secrets.** Never commit `.env*` files or passwords. `NEXT_PUBLIC_DEMO_PASSWORD` is set
    in Vercel; ask the author for the staging value when testing. Never put the production
    value anywhere.

## 5. The test contract (what a redesign must keep)

The Playwright specs find elements by **test id**, **role + accessible name** and
**headings**. Keep these as they are, or update the specs **in the same change** with a
reason.

**Test ids:**
*   login: `demo-card-astronaut`, `demo-card-fmo`, `demo-card-mission`, `toggle-password`,
    `show-redeem`;
*   session and app shell: `session-expired`, `demo-banner`;
*   surgeon: `crew-card-<crewId>` (for example `crew-card-demo-crew-3`), `photo-thumb`;
*   self-check: `save`, `simulator`, `mic`, `estimate`, `display-text`,
    `voice-unsupported`, `photo`, `photo-ready`.

Form field ids: `#username`, `#password`, `#access-code`, `#redeem-username`,
`#redeem-password`.

**Headings the specs look for:**
*   login and home: "Select your mission role", "Today";
*   self-check: "Self-check", "Bluetooth check", "Camera check", "Camera heart rate",
    "Voice check", "Reaction test", "Daily questionnaire", "Import data";
*   results and reports: "Your result", "Review the report", "Report queued" / "Report
    sent", "Delivered", "Reports";
*   surgeon: "Flight surgeon", "Reports inbox", crew names such as "Mia Chen";
*   other: "Emergency", "STAR PLUS self-check".

**Buttons and links by name:**
*   login and session: "Login", "Log in", "Log out", "Redeem and sign in", "Unlock",
    "Continue as …", "Sign in again", "Go to login";
*   navigation: "Open menu", the nav labels ("History" and the others);
*   self-check: "Start test", "Tap now", "Record", "Save answers", "Save result",
    "Confirm reading stands", "Import 3 readings", "Start a self-check";
*   results and reports: "Finish and review report", "Queue report", "Explain more simply",
    "Acknowledge", "All";
*   emergency: "Done, next step", "Severe bleeding", "Someone else, not responding";
*   demo: "Switch on demo mode", "Exit demo mode".

The nav is an `aside[aria-label="Main navigation"]`, and on small screens it opens with the
"Open menu" button. Search `test/e2e/` before renaming any visible text.

## 6. Commands

```bash
npm ci
npm run dev                 # local dev (uses the production API unless NEXT_PUBLIC_API_BASE is set)
npm run lint && npm run typecheck && npm test   # must all pass (238 unit tests today)
npm run build               # production build (webpack)
```

**Browser tests against staging** (the specs serve the app on port 3100):

```bash
NEXT_PUBLIC_DEMO_PASSWORD=<staging value from the author> npm run build:staging
NEXT_PUBLIC_DEMO_PASSWORD=<same> npx playwright test --project=chromium --workers=1
NEXT_PUBLIC_DEMO_PASSWORD=<same> npx playwright test --project=webkit --workers=1
```

Baseline on 2026-11-10: each browser **44 passed, 9 skipped, 0 failed**. The skips need staging
codes or an admin key, which only the auditor holds.
*   Delete `.next` before a build that tests depend on; stale builds have given false
    results.
*   Use fresh browser storage for manual checks: a newer build's IndexedDB version breaks
    older builds.
*   Use `localhost`, not `127.0.0.1` (staging CORS).
*   Sign-in is rate-limited to about 30 a minute per address, so do not loop sign-ins.

## 7. How work is handed in

*   **Roles:**
    *   the author (ariandesu) decides;
    *   a coding agent builds on a branch;
    *   Claude audits each hand-in, then deploys on the author's go-ahead.
*   **Branch:** work on a branch, for example `redesign`. **Never push to `main`**: it
    deploys to production.
*   **Git:**
    *   commit as `ariandesu <ariandesu@users.noreply.github.com>`;
    *   **no AI co-author, "Generated with" or attribution lines**, in commits or PR text;
    *   accurate commit titles;
    *   no merge commits on `main` (it is fast-forwarded).
*   **Hand-in report:**
    *   what changed, screen by screen;
    *   before and after screenshots at 375 px and 1280 px;
    *   lint, typecheck and unit results;
    *   both Playwright runs against staging;
    *   any changed test or selector, with the reason;
    *   the CI link.

    Push, do not merge, and stop.
*   **Freeze:** the hackathon starts 2026-11-14. Changes must be audited green before then;
    otherwise production stays as it is.

## 8. Design notes for a redesign

*   **Current look:**
    *   light only;
    *   background `#F9FAFB`, text `#18181B`, muted `#71717A`, surface `#F1F5F9`, border
        `#E4E4E7`;
    *   one accent `#0EA5E9`;
    *   radius 1 rem;
    *   Satoshi;
    *   skeleton shimmers instead of spinners.
*   **What you may change:**
    *   tokens in `globals.css`;
    *   the primitives in `components/ui`;
    *   page layout and composition;
    *   the AppShell look;
    *   charts styling.

    Adding dark mode is welcome if every status stays readable in both themes.
*   **Audiences:** astronauts on a tablet or phone under stress, often offline; surgeons on
    a laptop scanning a crew board; judges opening the demo cold. Clarity beats decoration:
    status, reason and next step should be readable at a glance.
*   **Avoid:**
    *   heavy animation libraries (GSAP and framer-motion were removed on purpose);
    *   remote assets;
    *   decorative motion that hides content;
    *   new runtime dependencies without a reason in the report.

## 9. Active task: the redesign plan

The approved redesign plan is `../docs/designs/frontend-redesign.md` (2026-11-10): what to
build. The order of work is in `../REDESIGN_HANDOFF.md`: do one step (S0 to S6b) per
session, commit, **do not push**, print the step report and stop; an auditor checks each
step. For this task the handoff replaces the hand-in report and the builder's browser-test
runs described in sections 6 and 7 above. The plan approves three changes to the notes above: the
`three` dependency (for the 3D body on `/body` only), a lime accent in place of sky blue,
and adding static files to the precache list in `next.config.ts`. Everything else in
sections 4 and 5 still holds.
