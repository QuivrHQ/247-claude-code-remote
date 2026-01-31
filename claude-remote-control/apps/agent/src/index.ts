import { createServer } from './server.js';
import { config } from './config.js';
import { logger } from './logger.js';

const PORT = config.agent?.port || 4678;

async function main() {
  logger.main.info({ machine: config.machine.name }, 'Starting 247 Agent');

  const server = await createServer();

  server.listen(PORT, '127.0.0.1', () => {
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
