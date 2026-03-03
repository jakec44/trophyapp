# Supabase CLI Workflow

**Never manually paste SQL into the dashboard.** Use migrations only.

## 1. Install Supabase CLI

**Windows (PowerShell):**
```powershell
# Option A: npm (as dev dependency - recommended)
npm install supabase --save-dev
# Then use: npm run supabase:* or npx supabase <command>

# Option B: Scoop
iwr -useb get.scoop.sh | iex
scoop bucket add supabase https://github.com/supabase/scoop-bucket
scoop install supabase

# Option C: Chocolatey (run as Administrator)
choco install supabase
```

**Note:** Use dev dependency to pin the version per project. Global install works but per-project is safer.

## 2. Login

```bash
npx supabase login
```

Opens browser to authenticate. Complete in browser.

## 3. Link Project

Project ref from `.env.local` URL: `iutwkyiiendlqxytdzih`

```bash
npx supabase link --project-ref iutwkyiiendlqxytdzih
```

When prompted, enter your database password (from Supabase Dashboard → Settings → Database).

## 4. Apply Migrations

```bash
npx supabase db push
```

Applies all migrations in `supabase/migrations/` to the hosted DB.

## 5. Generate Types

```bash
npx supabase gen types typescript --project-id iutwkyiiendlqxytdzih > src/types/supabase.ts
```

Or if linked:
```bash
npx supabase gen types typescript --linked > src/types/supabase.ts
```

## 6. NPM Scripts (package.json)

- `supabase:login` — Login to Supabase
- `supabase:link` — Link project
- `supabase:push` — Push migrations to hosted DB
- `supabase:types` — Generate TypeScript types

## Migrations in This Project

| File | Purpose |
|------|---------|
| 001_storage.sql | avatars, catch-photos buckets |
| 002_stories.sql | stories table + bucket |
| 20260219* | AI fields, enhanced_url on catches |
| 20260224* | username, is_private on profiles; RLS; handle_new_user |
| 20260225* | banners, catches buckets |
| 20260226* | is_mock on profiles |
| 20260227* | requested_by on friendships |

**Migration ordering:** Supabase runs migrations in filename order. Mixing `002_stories.sql` and `20260224...` is fine; if ordering gets confusing, standardize on timestamp style (`YYYYMMDDHHMMSS_description.sql`).

## Schema Truth

- **Migrations** = source of truth for DB changes
- **Generated types** (`src/types/supabase.ts`) = source of truth for TypeScript
- `supabase/schema.sql` = optional reference only
