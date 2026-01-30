# 247 - Remote Terminal Access for Claude Code

**Access Claude Code from anywhere - phone, tablet, or any browser. Run AI-assisted coding sessions 24/7 without being tied to your desk.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

<p align="center">
  <img src="./demo.gif" alt="247 Demo" width="700" />
</p>

## Why 247?

Ever wanted to check on your Claude Code session from your phone? Or start a quick coding task from a tablet while away from your desk? **247** makes it possible.

- **Mobile-first**: Fully responsive web terminal with touch scroll support
- **Always accessible**: Access your dev machine from any browser, anywhere
- **Session persistence**: Leave and come back - your sessions stay alive via tmux
- **Secure by design**: Cloudflare Tunnel integration, no port forwarding needed
- **PWA ready**: Install as an app on your phone for instant access

## Features

| Feature                     | Description                                  |
| --------------------------- | -------------------------------------------- |
| **Web Terminal**            | Full xterm.js terminal with WebGL rendering  |
| **Claude Code Integration** | One-click launch of Claude Code sessions     |
| **Multi-Project Support**   | Switch between projects from the dashboard   |
| **Session Management**      | Persistent tmux sessions survive disconnects |
| **Real-time Sync**          | WebSocket-based instant communication        |
| **Mobile Optimized**        | Touch gestures, virtual keyboard support     |
| **Dark/Light Mode**         | Automatic theme detection                    |
| **Offline Capable**         | PWA with service worker caching              |

## Quick Start

### Prerequisites

- **Node.js 22+**
- **tmux** installed (`brew install tmux` on macOS)
- **Cloudflare Tunnel** (optional, for remote access)

### Installation

```bash
# Clone the repository
git clone https://github.com/QuivrHQ/247.git
cd 247

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This starts:

- **Web Dashboard**: http://localhost:3001
- **Agent**: ws://localhost:4678

### Using the CLI

```bash
# Install globally
npm install -g 247-cli

# Initialize configuration
247 init

# Start the agent
247 start

# Check status
247 status
```

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │        Your Phone / Tablet          │
                    │         247.quivr.com               │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS
                    ┌──────────────▼──────────────────────┐
                    │         Cloudflare Tunnel           │
                    └──────────────┬──────────────────────┘
                                   │ WebSocket
┌──────────────────────────────────▼──────────────────────────────────────┐
│                            Your Mac                                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         247 Agent                                   │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │ │
│  │  │   Express   │  │  WebSocket  │  │   node-pty  │                 │ │
│  │  │   Server    │──│   Handler   │──│   + tmux    │                 │ │
│  │  └─────────────┘  └─────────────┘  └──────┬──────┘                 │ │
│  │                                            │                        │ │
│  │                                    ┌───────▼───────┐                │ │
│  │                                    │  Claude Code  │                │ │
│  │                                    └───────────────┘                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
247/
├── apps/
│   ├── web/          # Next.js 15 dashboard (deployed to Vercel)
│   └── agent/        # Node.js agent (runs on your machine)
├── packages/
│   ├── cli/          # CLI tool for agent management
│   └── shared/       # Shared TypeScript types
└── scripts/          # Build and release automation
```

## Configuration

Create `apps/agent/config.json`:

```json
{
  "machine": {
    "id": "macbook-pro",
    "name": "MacBook Pro"
  },
  "tunnel": {
    "domain": "your-tunnel.trycloudflare.com"
  },
  "projects": {
    "basePath": "~/Dev",
    "whitelist": ["project1", "project2"]
  }
}
```

## Development Commands

| Command          | Description                   |
| ---------------- | ----------------------------- |
| `pnpm dev`       | Start all development servers |
| `pnpm dev:web`   | Start only the web dashboard  |
| `pnpm dev:agent` | Start only the agent          |
| `pnpm build`     | Build all packages            |
| `pnpm test`      | Run all tests                 |
| `pnpm typecheck` | TypeScript type checking      |
| `pnpm lint`      | Lint all packages             |
| `pnpm release`   | Semantic versioning release   |
| `./dev.sh`       | Start web & agent in tmux     |

### Local Development with tmux

For a better development experience, use the included tmux script:

```bash
cd claude-remote-control
./dev.sh
```

This creates a tmux session with web and agent in split panes. Useful shortcuts:
- `Ctrl+b` then `←/→` - switch between panes
- `Ctrl+b` then `d` - detach (servers keep running)
- `tmux attach -t 247-dev` - reattach later

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, xterm.js
- **Backend**: Express, WebSocket (ws), node-pty
- **Database**: SQLite (better-sqlite3) for local persistence
- **Terminal**: tmux for session persistence
- **Build**: pnpm workspaces, Turborepo
- **Deployment**: Vercel (web), Cloudflare Tunnel (agent)

## Roadmap

- [ ] Multi-machine support
- [ ] Session sharing
- [ ] Terminal recording/playback
- [ ] Custom themes
- [ ] Keyboard shortcuts customization

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [xterm.js](https://xtermjs.org/) - Terminal rendering
- [node-pty](https://github.com/microsoft/node-pty) - PTY handling
- [tmux](https://github.com/tmux/tmux) - Session persistence
- [Claude Code](https://claude.ai/code) - AI coding assistant

---

<p align="center">
  <b>Built by <a href="https://quivr.com">Quivr</a></b> (Y Combinator W24)
</p>

<p align="center">
  <a href="https://247.quivr.com">Website</a> •
  <a href="https://github.com/QuivrHQ/247/issues">Issues</a> •
  <a href="https://twitter.com/quaborr">Twitter</a>
</p>
