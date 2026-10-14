-- Adds the per-connection bearer token the user enters when connecting, and
-- heals the pre-existing "color" drift (in schema.ts but absent from earlier
-- migrations). IF NOT EXISTS is safe where a column was added via drizzle-kit push.
ALTER TABLE "agent_connection" ADD COLUMN IF NOT EXISTS "color" text;--> statement-breakpoint
ALTER TABLE "agent_connection" ADD COLUMN IF NOT EXISTS "auth_token" text;
