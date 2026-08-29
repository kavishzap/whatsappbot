#!/usr/bin/env bash
# Refresh supabase/production/ from linked Supabase production project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROD="$ROOT/supabase/production"
PROJECT_REF="jlewluyfyvklebaoccke"
FETCHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cd "$ROOT"

echo "==> Downloading edge functions..."
for fn in get-plans create-companies whatsapp-bot-items whatsapp-bot-orders whatsapp-bot-sessions whatsapp-cities; do
  supabase functions download "$fn" --project-ref "$PROJECT_REF" --use-api
done

echo "==> Copying functions snapshot..."
rm -rf "$PROD/functions"
cp -R "$ROOT/supabase/functions" "$PROD/functions"
rm -rf "$ROOT/supabase/functions/get-plans" "$ROOT/supabase/functions/create-companies" 2>/dev/null || true

echo "==> Dumping schema (local pg_dump via Supabase CLI login role)..."
mkdir -p "$PROD/schema" "$PROD/enums" "$PROD/tables" "$PROD/rpc" "$PROD/policies" "$PROD/metadata"
eval "$(supabase db dump --linked --dry-run 2>/dev/null | grep '^export PG')"
pg_dump \
  --schema-only \
  --quote-all-identifier \
  --role "postgres" \
  --exclude-schema "information_schema|pg_*|_analytics|_realtime|_supavisor|auth|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault" \
  | sed -E 's/^\\(un)?restrict .*$/-- &/' \
  | sed -E 's/^CREATE SCHEMA "/CREATE SCHEMA IF NOT EXISTS "/' \
  | sed -E 's/^CREATE TABLE "/CREATE TABLE IF NOT EXISTS "/' \
  | sed -E 's/^CREATE SEQUENCE "/CREATE SEQUENCE IF NOT EXISTS "/' \
  | sed -E 's/^CREATE VIEW "/CREATE OR REPLACE VIEW "/' \
  | sed -E 's/^CREATE FUNCTION "/CREATE OR REPLACE FUNCTION "/' \
  | sed -E 's/^CREATE TRIGGER "/CREATE OR REPLACE TRIGGER "/' \
  | sed -E 's/^CREATE PUBLICATION "supabase_realtime/-- &/' \
  | sed -E 's/^CREATE EVENT TRIGGER /-- &/' \
  | sed -E 's/^         WHEN TAG IN /-- &/' \
  | sed -E 's/^   EXECUTE FUNCTION /-- &/' \
  | sed -E 's/^ALTER EVENT TRIGGER /-- &/' \
  | sed -E 's/^ALTER PUBLICATION "supabase_realtime_/-- &/' \
  | sed -E 's/^ALTER FOREIGN DATA WRAPPER (.+) OWNER TO /-- &/' \
  | sed -E 's/^ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin"/-- &/' \
  | sed -E 's/^GRANT ALL ON FOREIGN DATA WRAPPER (.+) TO "postgres" WITH GRANT OPTION/-- &/' \
  | sed -E "s/^GRANT (.+) ON (.+) \"(information_schema|pg_*|_analytics|_realtime|_supavisor|auth|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault)\"/-- &/" \
  | sed -E "s/^REVOKE (.+) ON (.+) \"(information_schema|pg_*|_analytics|_realtime|_supavisor|auth|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault)\"/-- &/" \
  | sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pg_tle").+/\1;/' \
  | sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pgsodium").+/\1;/' \
  | sed -E 's/^(CREATE EXTENSION IF NOT EXISTS "pgmq").+/\1;/' \
  | sed -E 's/^COMMENT ON EXTENSION (.+)/-- &/' \
  | sed -E 's/^CREATE POLICY "cron_job_/-- &/' \
  | sed -E 's/^ALTER TABLE "cron"/-- &/' \
  | sed -E 's/^SET transaction_timeout = 0;/-- &/' \
  | sed -E "/^--/d" \
  > "$PROD/schema/full_schema.sql"

echo "==> Splitting schema artifacts..."
awk '
/^CREATE TYPE / { f="'"$PROD"'/enums/enums.sql"; inblock=1 }
/^CREATE TABLE / { f="'"$PROD"'/tables/tables.sql"; inblock=1 }
/^CREATE OR REPLACE FUNCTION / { f="'"$PROD"'/rpc/rpc.sql"; inblock=1 }
/^CREATE POLICY / { f="'"$PROD"'/policies/policies.sql"; inblock=1 }
/^ALTER TABLE .* ENABLE ROW LEVEL SECURITY/ { f="'"$PROD"'/policies/policies.sql"; inblock=1 }
inblock { print >> f; if ($0 ~ /;$/) inblock=0 }
' "$PROD/schema/full_schema.sql"

echo "==> Exporting JSON metadata..."
psql -v ON_ERROR_STOP=1 -At -c "
SELECT json_agg(row_to_json(t) ORDER BY t.enum_name)
FROM (
  SELECT n.nspname AS schema, t.typname AS enum_name,
         array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY n.nspname, t.typname
) t;" > "$PROD/enums/enums.json"

psql -v ON_ERROR_STOP=1 -At -c "
SELECT json_agg(row_to_json(t) ORDER BY t.table_name)
FROM (
  SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
) t;" > "$PROD/tables/columns.json"

psql -v ON_ERROR_STOP=1 -At -c "
SELECT json_agg(row_to_json(t) ORDER BY t.routine_name)
FROM (
  SELECT routine_name, routine_type, data_type AS return_type,
         pg_get_function_arguments(p.oid) AS arguments
  FROM information_schema.routines r
  JOIN pg_proc p ON p.proname = r.routine_name
  JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = r.routine_schema
  WHERE r.routine_schema = 'public'
  GROUP BY routine_name, routine_type, data_type, p.oid
) t;" > "$PROD/rpc/functions.json"

psql -v ON_ERROR_STOP=1 -At -c "
SELECT json_agg(row_to_json(t) ORDER BY t.tablename, t.policyname)
FROM (
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
) t;" > "$PROD/policies/rls_policies.json"

echo "==> Generating TypeScript types..."
supabase gen types typescript --project-id "$PROJECT_REF" > "$PROD/metadata/database.types.ts"

cp "$ROOT/supabase/config.toml" "$PROD/config.toml"

cat > "$PROD/manifest.json" <<EOF
{
  "project_ref": "$PROJECT_REF",
  "project_name": "InvoiceApp",
  "fetched_at": "$FETCHED_AT",
  "source": "supabase.com production (linked CLI)",
  "edge_functions": [
    "get-plans",
    "create-companies",
    "whatsapp-bot-items",
    "whatsapp-bot-orders",
    "whatsapp-bot-sessions",
    "whatsapp-cities"
  ]
}
EOF

echo "Done. Production snapshot updated in supabase/production/"
