/**
 * Preflight env checks — import this FIRST in index.ts so it runs
 * before any other module tries to use these values.
 */
const REQUIRED_ENV = ["PORT", "ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
for (const key of REQUIRED_ENV) {
  const val = process.env[key];
  if (!val || val.trim().length === 0) {
    console.error(`\n✗ FATAL: ${key} is missing or blank.\n  If running from Claude Code, use artifacts/api-server/start.sh to avoid shell env overrides.\n`);
    process.exit(1);
  }
}
