import { createServer } from './server.js';
import { config } from './config.js';
import { resolveAuthToken } from './lib/auth.js';
import { logger } from './logger.js';

const PORT = config.agent?.port || 4678;

// Hook scripts run inside each tmux session and post back to the agent. Export
// the port and the effective auth token so the session (which inherits this
// process's environment via terminal.ts) can reach and authenticate to the
// agent; notify-247.sh reads both.
process.env.AGENT_247_PORT = String(PORT);
const effectiveToken = resolveAuthToken(config.agent?.authToken, process.env.AGENT_247_AUTH_TOKEN);
if (effectiveToken) {
  process.env.AGENT_247_TOKEN = effectiveToken;
}

async function main() {
  logger.main.info({ machine: config.machine.name }, 'Starting 247 Agent');

  const server = await createServer();

  server.listen(PORT, () => {
    logger.main.info({ port: PORT }, 'Agent running');
    logger.main.info({ url: `ws://localhost:${PORT}` }, 'Dashboard connection URL');
    logger.main.info({ url: `http://localhost:${PORT}/pair` }, 'Pair with dashboard at');
    logger.main.info('For remote access, use Tailscale Funnel, Cloudflare Tunnel, or SSH tunnel');
  });
}

main().catch((err) => {
  logger.main.error(err, 'Agent startup failed');
  process.exit(1);
});
