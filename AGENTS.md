# AGENTS.md

## Cursor Cloud specific instructions

BisiCab is an npm-workspaces monorepo (Node ≥ 20). Standard setup/run/test commands live in `README.md` and the root/workspace `package.json` scripts — refer to those first. The notes below only capture non-obvious, durable gotchas for working in a Cloud VM (where the update script has already run `npm install`).

### Services overview

| Workspace | What it is | How to run (dev) | Needs Supabase? |
| --- | --- | --- | --- |
| `apps/shifts` (`@bisicab/shifts`) | Next.js shift-schedule (Vardiya) viewer + swap + `/yonetim` admin | `npm run shifts` (:3001) | No — falls back to a local file store; fully usable without Supabase |
| `apps/admin` (`@bisicab/admin`) | Next.js admin panel (dashboard, live map, trip audit) | `npm run admin` (:3000) | Yes — auth-gated; boots to `/login` but real login needs a working Supabase |
| `apps/mobile` (`@bisicab/mobile`) | Expo/React Native driver + passenger app | `npm run mobile` (Metro :8081) | Yes — plus a native dev build |
| `packages/shared` (`@bisicab/shared`) | Pure-TS fare/geo/kalman/tracking library | build: `npm run build:shared`; test: `npm test --workspace @bisicab/shared` | No |

The web apps consume `@bisicab/shared` from source via Next.js `transpilePackages`, so you do NOT need to build the shared package before running `admin`/`shifts`. `build:shared` only produces `dist/` (used by the README's `node --test packages/shared/dist` variant); the workspace `test` script runs `tsx` on `src` directly.

### Lint / typecheck / test

- `npm run lint` does NOT work non-interactively: the Next.js apps have no ESLint config, so `next lint` opens an interactive "How would you like to configure ESLint?" prompt and fails in CI/automation. Use `npm run typecheck` (runs `tsc --noEmit` across all workspaces) as the static-check path.
- Unit tests: `npm test --workspace @bisicab/shared` (9 fare/tracking tests).

### The `shifts` app without Supabase (default in this VM)

With empty/placeholder `NEXT_PUBLIC_SUPABASE_*` and no `VERCEL` env var, `apps/shifts` uses a local JSON file store at `apps/shifts/data/schedules/*.json` (see `src/lib/local-schedule-store.ts`). You can log into `/yonetim` (default password `bisicab2026`, override via `SHIFTS_ADMIN_PASSWORD`), import CSV/PDF, and publish — data persists to that local `data/` dir (git-ignored intent; do not commit it).

### Supabase (required for `admin` and `mobile`)

Supabase local is NOT part of the update script (it needs Docker). To run it:

1. Docker is installed but the daemon is not managed by systemd here — start it manually: `sudo dockerd &` (daemon is configured with the `fuse-overlayfs` storage driver and `containerd-snapshotter` disabled in `/etc/docker/daemon.json`, required for Docker 29 in this VM).
2. `supabase start` then `supabase db reset` (CLI installed at `/usr/local/bin/supabase`).

KNOWN BLOCKER: a clean `supabase start`/`db reset` currently FAILS at migration `supabase/migrations/0007_admin_no_shift.sql`. It sets `end_reason = 'shift_end'` on `public.shifts` (column type `shift_end_reason`), but `shift_end` is never added to the `shift_end_reason` enum — migration `0004` only adds `auto_21h` to it and adds `shift_end` to a *different* enum (`assignment_release_reason`). Until migration `0007` is fixed, the local Supabase stack cannot be initialized, so `admin` login and the `mobile` backend cannot be exercised end-to-end locally.

### Mobile (`apps/mobile`)

Requires a native development build (`expo run:android` / `expo run:ios`) because of native modules (`@rnmapbox/maps`, `expo-camera`, `expo-location`) — it will not run under Expo Go, and cannot be built/run in this headless Cloud VM without Android/iOS tooling + a Mapbox download token (`MAPBOX_DOWNLOAD_TOKEN`) and public token (`EXPO_PUBLIC_MAPBOX_TOKEN`).

### Env files

Each app reads its own env file: `apps/admin/.env.local`, `apps/shifts/.env.local`, `apps/mobile/.env` (copy from the respective `.env.example`). Maps need a Mapbox public token (`pk...`) to render; apps otherwise boot without it.
