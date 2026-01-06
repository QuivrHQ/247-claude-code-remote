import { createServer } from './server.js';
import config from '../config.json' with { type: 'json' };

const PORT = config.agent?.port || 4678;

async function main() {
  console.log(`Starting Claude Remote Agent for ${config.machine.name}...`);

  const server = createServer();

  server.listen(PORT, () => {
    console.log(`\n🚀 Agent running on http://localhost:${PORT}`);
    console.log(`📡 Connect your dashboard to: ws://localhost:${PORT}`);
    console.log(`\n💡 For remote access, use one of these options:`);
    console.log(`   • Tailscale Funnel: tailscale funnel --bg --https=${PORT}`);
    console.log(`   • Cloudflare Tunnel: cloudflared tunnel --url http://localhost:${PORT}`);
    console.log(`   • SSH tunnel: ssh -L ${PORT}:localhost:${PORT} user@remote\n`);
  });
}

main().catch(console.error);
