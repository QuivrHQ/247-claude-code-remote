import { Hono, Context } from 'hono';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { auth } from '../auth.js';
import { db } from '../db/index.js';
import { flyTokens } from '../db/schema.js';
import { config } from '../lib/config.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { validateTokenAndGetOrgs, getOrganizations } from '../lib/flyio-client.js';
import { logger } from '../lib/logger.js';

export const flyioRoutes = new Hono();

/**
 * Helper to get authenticated user from request
 */
async function getAuthenticatedUser(c: Context) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return session?.user ?? null;
}

// POST /api/flyio/token - Save Fly.io API token
flyioRoutes.post('/token', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: { token?: string; orgId?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { token, orgId: selectedOrgId } = body;

  if (!token || typeof token !== 'string') {
    return c.json({ error: 'Token is required' }, 400);
  }

  // Validate token format
  if (!token.startsWith('fo1_') && !token.startsWith('fm1_') && !token.startsWith('fm2_')) {
    return c.json({ error: 'Invalid token format' }, 400);
  }

  logger.info({ userId: user.id }, 'Validating Fly.io token');

  // Validate token with Fly.io API
  const result = await validateTokenAndGetOrgs(token);

  if (!result.valid) {
    logger.warn({ userId: user.id, error: result.error }, 'Invalid Fly.io token');
    return c.json({ error: result.error || 'Invalid Fly.io token' }, 400);
  }

  if (result.organizations.length === 0) {
    return c.json({ error: 'No organizations found for this token' }, 400);
  }

  // Select organization: use provided orgId/slug or default to first personal org
  let selectedOrg = result.organizations.find(
    (org) => org.id === selectedOrgId || org.slug === selectedOrgId
  );
  if (!selectedOrg) {
    // Default to personal org or first org
    selectedOrg =
      result.organizations.find((org) => org.type === 'PERSONAL') || result.organizations[0];
  }

  // Encrypt the token
  const encryptedToken = encrypt(token, config.encryptionKey);

  // Delete existing token for this user (upsert)
  await db.delete(flyTokens).where(eq(flyTokens.userId, user.id));

  // Insert new token
  await db.insert(flyTokens).values({
    id: randomUUID(),
    userId: user.id,
    accessToken: encryptedToken,
    orgSlug: selectedOrg.slug,
    orgName: selectedOrg.name,
  });

  logger.info({ userId: user.id, orgSlug: selectedOrg.slug }, 'Fly.io token saved successfully');

  return c.json({
    success: true,
    orgSlug: selectedOrg.slug,
    orgName: selectedOrg.name,
    organizations: result.organizations,
  });
});

// GET /api/flyio/status - Check if Fly.io is connected
flyioRoutes.get('/status', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const [tokenRecord] = await db
    .select({
      orgSlug: flyTokens.orgSlug,
      orgName: flyTokens.orgName,
      createdAt: flyTokens.createdAt,
    })
    .from(flyTokens)
    .where(eq(flyTokens.userId, user.id))
    .limit(1);

  if (!tokenRecord) {
    return c.json({ connected: false });
  }

  return c.json({
    connected: true,
    orgSlug: tokenRecord.orgSlug,
    orgName: tokenRecord.orgName,
    connectedAt: tokenRecord.createdAt,
  });
});

// DELETE /api/flyio/token - Disconnect Fly.io
flyioRoutes.delete('/token', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await db.delete(flyTokens).where(eq(flyTokens.userId, user.id));

  logger.info({ userId: user.id }, 'Fly.io token deleted');

  return c.json({ success: true });
});

// GET /api/flyio/orgs - List available orgs
flyioRoutes.get('/orgs', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Get user's stored token
  const [tokenRecord] = await db
    .select({ accessToken: flyTokens.accessToken })
    .from(flyTokens)
    .where(eq(flyTokens.userId, user.id))
    .limit(1);

  if (!tokenRecord) {
    return c.json({ error: 'Fly.io not connected' }, 400);
  }

  // Decrypt token
  let decryptedToken: string;
  try {
    decryptedToken = decrypt(tokenRecord.accessToken, config.encryptionKey);
  } catch (error) {
    logger.error({ userId: user.id, error }, 'Failed to decrypt Fly.io token');
    return c.json({ error: 'Failed to decrypt token' }, 500);
  }

  // Fetch fresh org list from Fly.io
  const organizations = await getOrganizations(decryptedToken);

  return c.json({ orgs: organizations });
});
