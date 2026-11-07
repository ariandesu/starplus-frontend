# STAR PLUS — Elephant-Goldfish Model Context

## Project Overview
Rebuild star-plus as a mobile-first Next.js dashboard with separate frontend and backend repos, GitHub-hosted, Vercel-deployed frontend, Cloudflare D1 backend database.

## Context Held (Elephant Memory)

### User
- Mahir Faisal (MHR3D), GitHub: ariandesu, Telegram 8941576242, UTC+6
- Addresses assistant as "Sera"
- Prefers Kaggle for ML, leakage prevention, honest generalization analysis
- Expects live browser verification of deployments, free Cloudflare for ShareFlow, Telegram Q&A via .docx
- Demands 100% real audited data, no placeholders
- Prefers rewarded ad monetization with 1-click ad step progression
- Prefers hiding feedback/report buttons on admin dashboards, required Name/Email fields
- Prefers exact selective rollbacks on UI bugs, disable Light Mode toggle when dual-theme friction arises
- No kiss emojis in responses

### Hardware / Environment
- Host: Ubuntu 26.04 (Xubuntu), ThinkPad X270, profile "Sanctuary"
- Intel i5 10500, 16GB DDR4 RAM, RTX 4060 (8GB VRAM)
- Laptop memory constrained (bus errors during builds; resolved with webpack, clean deps)
- Daily 05:00 reboot via systemd; other crons offloaded to Poco F1 Termux
- ~/.hermes/data/api-errors.log for error logging

### Active Projects
- hermes-agent: ~/Development/hermes-agent (Hermes Agent by Nous Research)
- omniroute: ~/Development/omniroute, localhost:20128
- searxng: Docker 127.0.0.1:8081
- star-plus: ~/Development/star-plus — original Astronaut Health Monitoring & Decision Support System repo
- starplus-frontend: ~/Development/Development/starplus-frontend — NEW Next.js frontend (BUILT ✅)
- starplus-design: ~/Development/Development/starplus-design — DESIGN.md created

### Frontend Status (COMPLETED)
- Next.js 16.4.5 + React 19 + Tailwind CSS, webpack build (turbo disabled due to bus errors)
- Build: ✅ PASSES (`npx next build --webpack`)
- Design system: Satoshi font, #F9FAFB background, #18181B foreground, #0EA5E9 accent
- Components: button, card, input, badge, skeleton, separator, mobile-nav, hero-section, bento-grid, infinite-marquee, horizontal-accordion, vital-chart, role-switcher, empty-state, skeleton-loader
- Mobile-first: single column below 768px
- gpt-taste constraints: no Inter, no pure black, no neon, no emojis, max 1 accent color, Satoshi font
- page.tsx: currently minimal "STAR PLUS" header (full dashboard components exist but not assembled)

### Remaining Work
1. **Backend repo** — NOT created. Need: wrangler.toml, D1 schema/migrations, API routes
2. **GitHub push** — No repos pushed yet. GitHub auth confirmed ready.
3. **Vercel deploy** — Vercel CLI installed, auth unverified. Need: vercel login, vercel deploy
4. **Cloudflare D1** — API key [REDACTED], need account ID, create D1 DB, run migrations
5. **EGM methodology** — Need to apply elephant-goldfish-model planning properly

### Design Constraints (gpt-taste)
- Satoshi font (not Inter), accent #0EA5E9, background #F9FAFB
- No Inter, no pure black, no neon glows, no 3-col equal grids, no emojis, max 1 accent color
- Mobile-first dashboard website (single column below 768px)
