# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Remote Control - A system for web terminal access to Claude Code from anywhere. Consists of a Next.js dashboard (Vercel), local Node.js agents (one per Mac), Neon PostgreSQL for persistence, and Cloudflare Tunnels for secure exposure.

## Development Commands

```bash
# Install dependencies
pnpm install

# Start all dev servers (web + agent)
pnpm dev

# Start individual services
pnpm dev:web          # Dashboard at http://localhost:3001
pnpm dev:agent        # Agent at ws://localhost:4678

# Build and check
pnpm build            # Build all packages
pnpm typecheck        # TypeScript type checking
pnpm lint             # Lint all packages

# Database (from root or apps/web)
pnpm db:push          # Push schema to Neon
pnpm db:generate      # Generate Drizzle migrations
pnpm db:studio        # Open Drizzle Studio UI
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud (Vercel)                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  apps/web (Next.js 15)                               │   │
│  │  - Dashboard UI with xterm.js terminal               │   │
│  │  - API routes for machine registration               │   │
│  │  - Drizzle ORM → Neon PostgreSQL                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    Cloudflare Tunnel
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Local Mac                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  apps/agent (Express + WebSocket)                    │   │
│  │  - node-pty for terminal spawning                    │   │
│  │  - tmux for session persistence                      │   │
│  │  - Registers with dashboard on startup               │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  packages/hooks (Claude Code Plugin)                 │   │
│  │  - Notifies agent when Claude Code stops             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

| Package | Purpose |
|---------|---------|
| `apps/web` | Next.js 15 dashboard, API routes, Drizzle ORM |
| `apps/agent` | Express server, WebSocket terminal, node-pty |
| `packages/shared` | TypeScript types shared between web and agent |
| `packages/hooks` | Claude Code plugin for stop notifications |

## Key Technical Decisions

- **pnpm workspaces + Turbo** for monorepo orchestration
- **@homebridge/node-pty-prebuilt-multiarch** for ARM64 Mac compatibility
- **tmux** sessions for terminal persistence across browser disconnects
- **Drizzle ORM** with Neon serverless PostgreSQL
- **xterm.js** for browser terminal rendering

## Environment Setup

**apps/web/.env.local:**
```
DATABASE_URL=postgres://...@neon.tech/...
AGENT_API_KEY=your-shared-secret
```

**apps/agent/config.json:**
```json
{
  "machine": { "id": "unique-id", "name": "Display Name" },
  "tunnel": { "domain": "your.tunnel.domain" },
  "projects": {
    "basePath": "~/Dev",
    "whitelist": ["project1", "project2"]
  },
  "dashboard": {
    "apiUrl": "https://your-dashboard.vercel.app/api",
    "apiKey": "same-shared-secret"
  }
}
```

## Database Schema

Three tables in Neon: `machines` (registered agents), `sessions` (terminal sessions), `users` (future auth). Schema defined in `apps/web/src/lib/db/schema.ts`.

## WebSocket Protocol

Terminal communication via `ws://agent:4678/terminal?project=X&session=Y`:
- `{ type: 'input', data: string }` - keyboard input
- `{ type: 'resize', cols, rows }` - terminal resize
- `{ type: 'start-claude' }` - launch Claude Code
- Binary data for terminal output
