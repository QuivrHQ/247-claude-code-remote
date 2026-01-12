-- Rename org_id to org_slug in fly_tokens table
-- Users will need to reconnect their Fly.io account after this migration

-- Add new org_slug column
ALTER TABLE "fly_tokens" ADD COLUMN "org_slug" text;

-- Copy data from org_id (note: this won't work correctly as org_id contains GraphQL IDs, not slugs)
-- Users will need to reconnect their Fly.io account
UPDATE "fly_tokens" SET "org_slug" = "org_id";

-- Make org_slug NOT NULL
ALTER TABLE "fly_tokens" ALTER COLUMN "org_slug" SET NOT NULL;

-- Drop old org_id column
ALTER TABLE "fly_tokens" DROP COLUMN "org_id";
