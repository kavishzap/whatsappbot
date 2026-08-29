# Production Supabase snapshot

Read-only copy of **production** Supabase assets for project `jlewluyfyvklebaoccke` (InvoiceApp).

Fetched from the linked Supabase CLI project. Do **not** deploy from this folder directly — use `supabase/functions/` and root migrations for active development.

## Contents

| Path | Description |
|------|-------------|
| `schema/full_schema.sql` | Full public schema dump (pg_dump, schema-only) |
| `enums/` | PostgreSQL enums (`enums.sql` + `enums.json`) |
| `tables/` | Table DDL (`tables.sql`) + column metadata (`columns.json`) |
| `rpc/` | Functions / RPC DDL (`rpc.sql`) + catalog (`functions.json`) |
| `policies/` | RLS policies (`policies.sql` + `rls_policies.json`) |
| `functions/` | Edge functions downloaded from production |
| `metadata/database.types.ts` | Generated TypeScript types |
| `config.toml` | Edge function config snapshot |
| `manifest.json` | Fetch metadata and paths |

## Edge functions (production)

- `get-plans`
- `create-companies`
- `whatsapp-bot-items`
- `whatsapp-bot-orders`
- `whatsapp-bot-sessions`
- `whatsapp-cities`

## Refresh from production

Requires: Supabase CLI logged in, project linked, local `pg_dump`/`psql` (libpq).

```bash
./supabase/production/refresh-from-production.sh
```

Or manually:

```bash
supabase functions download <name> --project-ref jlewluyfyvklebaoccke --use-api
supabase gen types typescript --project-id jlewluyfyvklebaoccke > supabase/production/metadata/database.types.ts
```

Schema dump uses local `pg_dump` via Supabase CLI login role (Docker not required).

## Notes

- `rpc/functions.json` includes extension helpers (e.g. `pg_trgm`); filter by `routine_name` for app RPCs only.
- Production edge downloads land in `supabase/functions/` first; the refresh script copies them here.
- Never commit database passwords or service role keys.
