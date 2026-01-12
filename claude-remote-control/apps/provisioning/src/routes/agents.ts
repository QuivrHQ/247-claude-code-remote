import { Hono, Context } from 'hono';
import { randomUUID } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { auth } from '../auth.js';
import { db } from '../db/index.js';
import { flyTokens, agents } from '../db/schema.js';
import { config } from '../lib/config.js';
import { decrypt } from '../lib/crypto.js';
import {
  createApp,
  createVolume,
  createMachine,
  getMachine,
  startMachine,
  stopMachine,
  destroyMachine,
  deleteVolume,
  deleteApp,
  waitForMachineState,
  type FlyMachineConfig,
} from '../lib/flyio-client.js';
import { logger } from '../lib/logger.js';

export const agentsRoutes = new Hono();

// Default region for cloud agents
const DEFAULT_REGION = 'sjc';

// Docker image for cloud agent (built by GitHub Actions)
const CLOUD_AGENT_IMAGE = 'ghcr.io/stangirard/247-cloud-agent:latest';

/**
 * Helper to get authenticated user from request
 */
async function getAuthenticatedUser(c: Context) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return session?.user ?? null;
}

/**
 * Helper to get user's Fly.io token (decrypted)
 */
async function getUserFlyToken(userId: string): Promise<{ token: string; orgSlug: string } | null> {
  const [tokenRecord] = await db
    .select({
      accessToken: flyTokens.accessToken,
      orgSlug: flyTokens.orgSlug,
    })
    .from(flyTokens)
    .where(eq(flyTokens.userId, userId))
    .limit(1);

  if (!tokenRecord) {
    return null;
  }

  try {
    const token = decrypt(tokenRecord.accessToken, config.encryptionKey);
    return { token, orgSlug: tokenRecord.orgSlug };
  } catch (error) {
    logger.error({ userId, error }, 'Failed to decrypt Fly.io token');
    return null;
  }
}

/**
 * Generate a unique app name for the cloud agent
 */
function generateAppName(userId: string): string {
  const userPrefix = userId
    .slice(0, 6)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const random = randomUUID().slice(0, 4);
  return `agent-${userPrefix}-${random}`;
}

// =============================================================================
// POST /api/agents - Deploy new cloud agent
// =============================================================================
agentsRoutes.post('/', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Parse optional body for region selection
  let body: { region?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    // Body is optional
  }

  const region = body.region || DEFAULT_REGION;

  // Get user's Fly.io token
  const flyCredentials = await getUserFlyToken(user.id);
  if (!flyCredentials) {
    return c.json(
      { error: 'Fly.io not connected. Please connect your Fly.io account first.' },
      400
    );
  }

  const { token, orgSlug } = flyCredentials;
  const appName = generateAppName(user.id);

  logger.info({ userId: user.id, appName, region }, 'Starting cloud agent deployment');

  // Create agent record with pending status
  const agentId = randomUUID();
  await db.insert(agents).values({
    id: agentId,
    userId: user.id,
    flyAppName: appName,
    hostname: `${appName}.fly.dev`,
    region,
    status: 'pending',
  });

  try {
    // Step 1: Create Fly.io app
    await db.update(agents).set({ status: 'creating_app' }).where(eq(agents.id, agentId));

    const appResult = await createApp(token, appName, orgSlug);
    if (!appResult.success) {
      throw new Error(`Failed to create app: ${appResult.error}`);
    }

    // Step 2: Create volume for persistent storage
    await db.update(agents).set({ status: 'creating_volume' }).where(eq(agents.id, agentId));

    const volumeResult = await createVolume(token, appName, 'home_data', region, 1);
    if (!volumeResult.success) {
      // Rollback: delete app
      await deleteApp(token, appName);
      throw new Error(`Failed to create volume: ${volumeResult.error}`);
    }

    await db
      .update(agents)
      .set({ flyVolumeId: volumeResult.volume?.id })
      .where(eq(agents.id, agentId));

    // Step 3: Create and start machine
    await db.update(agents).set({ status: 'creating_machine' }).where(eq(agents.id, agentId));

    const machineConfig: FlyMachineConfig = {
      image: CLOUD_AGENT_IMAGE,
      guest: {
        cpu_kind: 'shared',
        cpus: 1,
        memory_mb: 1024,
      },
      services: [
        {
          protocol: 'tcp',
          internal_port: 8911,
          ports: [
            { port: 443, handlers: ['tls', 'http'] },
            { port: 80, handlers: ['http'] },
          ],
          autostop: 'stop',
          autostart: true,
        },
      ],
      mounts: volumeResult.volume
        ? [
            {
              volume: volumeResult.volume.id,
              path: '/home/ariana',
            },
          ]
        : undefined,
      env: {
        NODE_ENV: 'production',
      },
      restart: {
        policy: 'on-failure',
      },
    };

    const machineResult = await createMachine(token, appName, machineConfig, region);
    if (!machineResult.success) {
      // Rollback: delete volume and app
      if (volumeResult.volume) {
        await deleteVolume(token, appName, volumeResult.volume.id);
      }
      await deleteApp(token, appName);
      throw new Error(`Failed to create machine: ${machineResult.error}`);
    }

    // Wait for machine to start
    const waitResult = await waitForMachineState(
      token,
      appName,
      machineResult.machine!.id,
      'started',
      120000 // 2 minutes timeout
    );

    if (!waitResult.success) {
      logger.warn(
        { machineId: machineResult.machine?.id, error: waitResult.error },
        'Machine did not reach started state, but continuing'
      );
    }

    // Update agent record with final status
    await db
      .update(agents)
      .set({
        flyMachineId: machineResult.machine?.id,
        status: 'running',
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    logger.info(
      { userId: user.id, agentId, appName, machineId: machineResult.machine?.id },
      'Cloud agent deployed successfully'
    );

    // Return the created agent
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);

    return c.json(agent);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      { userId: user.id, agentId, appName, error: errorMessage },
      'Cloud agent deployment failed'
    );

    // Update agent with error status
    await db
      .update(agents)
      .set({
        status: 'error',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    return c.json({ error: errorMessage }, 500);
  }
});

// =============================================================================
// GET /api/agents - List user's agents
// =============================================================================
agentsRoutes.get('/', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userAgents = await db.select().from(agents).where(eq(agents.userId, user.id));

  return c.json({ agents: userAgents });
});

// =============================================================================
// GET /api/agents/:id - Get agent status
// =============================================================================
agentsRoutes.get('/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('id');

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  // If agent has a machine, get live status from Fly.io
  if (agent.flyMachineId && agent.status !== 'error') {
    const flyCredentials = await getUserFlyToken(user.id);
    if (flyCredentials) {
      const { machine } = await getMachine(
        flyCredentials.token,
        agent.flyAppName,
        agent.flyMachineId
      );
      if (machine) {
        // Map Fly.io machine state to our status
        let status = agent.status;
        if (machine.state === 'started') status = 'running';
        else if (machine.state === 'stopped') status = 'stopped';
        else if (machine.state === 'starting') status = 'starting';
        else if (machine.state === 'stopping') status = 'stopping';

        // Update database if status changed
        if (status !== agent.status) {
          await db
            .update(agents)
            .set({ status, updatedAt: new Date() })
            .where(eq(agents.id, agentId));
        }

        return c.json({ ...agent, status, machineState: machine.state });
      }
    }
  }

  return c.json(agent);
});

// =============================================================================
// POST /api/agents/:id/start - Start stopped agent
// =============================================================================
agentsRoutes.post('/:id/start', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('id');

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (!agent.flyMachineId) {
    return c.json({ error: 'Agent has no machine' }, 400);
  }

  const flyCredentials = await getUserFlyToken(user.id);
  if (!flyCredentials) {
    return c.json({ error: 'Fly.io not connected' }, 400);
  }

  logger.info({ userId: user.id, agentId, machineId: agent.flyMachineId }, 'Starting agent');

  const result = await startMachine(flyCredentials.token, agent.flyAppName, agent.flyMachineId);

  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  await db
    .update(agents)
    .set({ status: 'starting', updatedAt: new Date() })
    .where(eq(agents.id, agentId));

  return c.json({ success: true });
});

// =============================================================================
// POST /api/agents/:id/stop - Stop running agent
// =============================================================================
agentsRoutes.post('/:id/stop', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('id');

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  if (!agent.flyMachineId) {
    return c.json({ error: 'Agent has no machine' }, 400);
  }

  const flyCredentials = await getUserFlyToken(user.id);
  if (!flyCredentials) {
    return c.json({ error: 'Fly.io not connected' }, 400);
  }

  logger.info({ userId: user.id, agentId, machineId: agent.flyMachineId }, 'Stopping agent');

  const result = await stopMachine(flyCredentials.token, agent.flyAppName, agent.flyMachineId);

  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  await db
    .update(agents)
    .set({ status: 'stopping', updatedAt: new Date() })
    .where(eq(agents.id, agentId));

  return c.json({ success: true });
});

// =============================================================================
// DELETE /api/agents/:id - Destroy agent
// =============================================================================
agentsRoutes.delete('/:id', async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const agentId = c.req.param('id');

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, user.id)))
    .limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  const flyCredentials = await getUserFlyToken(user.id);

  logger.info({ userId: user.id, agentId, appName: agent.flyAppName }, 'Destroying agent');

  // Try to clean up Fly.io resources (best effort)
  if (flyCredentials) {
    const { token } = flyCredentials;

    // Destroy machine if exists
    if (agent.flyMachineId) {
      const machineResult = await destroyMachine(token, agent.flyAppName, agent.flyMachineId);
      if (!machineResult.success) {
        logger.warn({ error: machineResult.error }, 'Failed to destroy machine');
      }
    }

    // Delete volume if exists
    if (agent.flyVolumeId) {
      const volumeResult = await deleteVolume(token, agent.flyAppName, agent.flyVolumeId);
      if (!volumeResult.success) {
        logger.warn({ error: volumeResult.error }, 'Failed to delete volume');
      }
    }

    // Delete app
    const appResult = await deleteApp(token, agent.flyAppName);
    if (!appResult.success) {
      logger.warn({ error: appResult.error }, 'Failed to delete app');
    }
  }

  // Delete agent record from database
  await db.delete(agents).where(eq(agents.id, agentId));

  logger.info({ agentId }, 'Agent destroyed');

  return c.json({ success: true });
});
