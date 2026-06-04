# NusantaraRP

Website server Minecraft roleplay Indonesia dengan sistem login/register, member area pengumuman, showcase pengembangan server, dan admin panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (artifacts/mc-roleplay)
- API: Express 5 (artifacts/api-server)
- Auth: Clerk (Replit-managed)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — DB schema (users, developments, announcements)
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/mc-roleplay/src/` — React frontend
- `artifacts/mc-roleplay/src/App.tsx` — Router + Clerk Provider setup

## Architecture decisions

- Clerk auth is cookie-based on web; `clerkProxyMiddleware` proxies Clerk FAPI through the API server for prod
- Dates returned from DB (JS Date objects) must be serialized with `serializeDates()` before Zod `.parse()` — Zod schemas expect strings
- Users are auto-created in the DB on first `/api/me` call after Clerk sign-in (JIT provisioning)
- Admin role is stored in the `users` table; only admins can create/edit/delete developments and announcements
- `serializeDates` helper in `artifacts/api-server/src/lib/serialize.ts` handles `Date → string` conversion

## Product

- **Landing page** — public, showcases server developments and stats with CTAs to register
- **Member area** — authenticated, view announcements and server development roadmap, manage profile
- **Admin panel** — admin-only, manage developments (CRUD), announcements (CRUD), user roles

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` after changing any `lib/*` schema before typechecking artifacts — stale lib declarations cause false errors
- After OpenAPI spec changes, run codegen before using updated types
- Clerk dev key warning in console is normal and expected in development

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
