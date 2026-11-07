# STAR PLUS — Design Draft (EGM Draft)

## Scope
Complete the star-plus dashboard rebuild: assemble full frontend dashboard, create backend repo with Cloudflare D1, push both repos to GitHub, deploy frontend to Vercel.

## 1. Frontend — Assemble Full Dashboard (page.tsx)

**Current state**: page.tsx is a minimal "STAR PLUS" header. All component files exist but are not assembled.

**Plan**: Assemble page.tsx with:
- Hero section (Cinematic Center, GSAP ScrollTrigger)
- Bento grid (mobile-first, grid-flow-dense, zero empty cells)
- Infinite marquee (GSAP seamless loop)
- Horizontal accordion (WATCH signals, mobile scroll)
- Vital chart (recharts LineChart)
- Role switcher (Astronaut / Medical / Mission Control)
- Empty state & skeleton loaders

**Constraints**: Mobile-first (single column below 768px), Satoshi font, #0EA5E9 accent, no Inter/pure black/neon/emojis/3-col grids.

## 2. Backend Repo — Cloudflare D1 + Workers

**Repo location**: ~/Development/starplus-backend

**Structure**:
```
starplus-backend/
├── wrangler.toml          # Cloudflare Workers config
├── schema.sql             # D1 database schema
├── migrations/            # D1 migration files
├── src/
│   └── index.ts           # Workers entry point (API routes)
├── package.json
├── tsconfig.json
└── vitest.config.ts       # Testing
```

**D1 Schema** (minimal storage):
- `astronauts` table: id, name, role, status, last_checkin
- `vitals` table: id, astronaut_id, heart_rate, blood_pressure, oxygen_sat, timestamp
- `watch_signals` table: id, signal_type, baseline_30d, moving_window_72h, status, created_at

**API Routes**:
- GET /api/astronauts — list astronauts
- GET /api/vitals/:id — get vitals for astronaut
- GET /api/watch-signals — get WATCH signals
- POST /api/vitals — submit vitals reading

**wrangler.toml**: D1 database binding, compatibility date, Miniflare for local dev

## 3. GitHub — Two Repos

**Frontend**: github.com/ariandesu/starplus-frontend
**Backend**: github.com/ariandesu/starplus-backend

Both repos: public, with README, .gitignore, LICENSE. Commit all source, push to GitHub.

## 4. Vercel Deployment — Frontend

- `vercel login` (authenticate)
- `vercel` deploy from starplus-frontend
- Connect GitHub repo for auto-deploys
- Verify live URL in browser

## 5. Cloudflare D1 Setup

- Use Cloudflare API key [REDACTED] (account ID needed — request from user)
- Create D1 database via Cloudflare API / wrangler
- Apply schema migrations
- Minimal storage tier

## Implementation Order

1. Assemble page.tsx (frontend dashboard)
2. Create starplus-backend repo with wrangler.toml + D1 schema
3. Push both repos to GitHub
4. Deploy frontend to Vercel
5. Create D1 database and run migrations
6. Verify live deployment in browser
