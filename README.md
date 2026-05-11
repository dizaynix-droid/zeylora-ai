# ZEYLORA AI

Phase 1 foundation for a premium, modular AI photo editing SaaS.

## Current Scope

- Next.js App Router structure
- Tailwind premium dark design system
- Prisma/PostgreSQL schema foundation
- Homepage foundation
- Dashboard and admin shells
- AI tools, credits, CMS, feature flags, audit, email events, referrals, newsletter, and provider budget models
- Multilingual and SEO-ready configuration

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run prisma:generate
npm run dev
```

The brand is configured in `src/config/app.ts` and `src/config/brand.ts`.
