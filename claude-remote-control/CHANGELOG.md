# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.20.1] - 2026-01-13

### Tests

- **mcp-server**: add unit tests for agent client and tools (9a4d87f)

## [2.20.0] - 2026-01-13

### Features

- **spawn**: persist claude -p output to file and database (cc536f8)

## [2.19.1] - 2026-01-13

### Bug Fixes

- **release**: include mcp-server in package version updates (f5339d3)

## [2.19.0] - 2026-01-13

### Features

- **mcp-server**: move to standalone npm package (0c1d4e8)
- **plugin**: add 247-orchestrator plugin for multi-agent orchestration (8d509d7)

### Bug Fixes

- add compiled MCP server and fix TypeScript error (50dd4f2)
- remove hooks from plugin.json manifest (auto-discovered) (ae6ff1a)
- remove agents field from plugin.json (unsupported format) (af396f4)
- correct marketplace.json schema for Claude Code (f6a0525)
- move marketplace.json to .claude-plugin/ folder (3338829)
- move marketplace.json to root and fix repo URLs (999d7c8)

### Documentation

- add multi-agent orchestration plugin section to README (2743a3b)
- add multi-agent orchestration plugin section to README (61d00a2)

### Chores

- include MCP server dist/ in repository (b517a70)

## [2.18.3] - 2026-01-13

### Bug Fixes

- **cloud-agent**: disable auto-stop to prevent agent unavailability (4bc9398)

## [2.18.2] - 2026-01-13

### Tests

- **cli**: update E2E tests for statusLine API (9dfa507)

## [2.18.1] - 2026-01-13

### Bug Fixes

- **web**: render DeployAgentModal in main connected view (becaa8c)

## [2.18.0] - 2026-01-13

### Features

- **cloud-agent**: enable Git commits via GitHub OAuth token (f1a988f)

## [2.17.1] - 2026-01-13

### Documentation

- clarify workflow location rule in CLAUDE.md (4e7b1c5)

### Chores

- migrate workflows from claude-remote-control to root (1296651)

## [2.17.0] - 2026-01-13

### Features

- **settings**: add additional Bash commands for Fly and Vercel integration (8cad4f2)

### Bug Fixes

- **provisioning**: add catch-all redirect for OAuth error handling (8727213)

## [2.16.1] - 2026-01-13

### Bug Fixes

- **web**: use correct agent URL when multiple agents are configured (672373d)

## [2.16.0] - 2026-01-13

### Features

- **web**: add multi-agent connection support (f09833f)

### CI/CD

- add provisioning deployment workflow on tag push (a02ff81)

## [2.15.0] - 2026-01-13

### Features

- **cloud**: add auto-sleep/auto-wake for Fly.io agents (e99036e)

## [2.14.0] - 2026-01-13

### Features

- **web**: add cloud config access button to header (5931bcc)

## [2.13.0] - 2026-01-12

### Features

- **ci**: add automatic provisioning deployment to Fly.io (53b68b9)

### Bug Fixes

- **ci**: use lowercase image name for Docker registry (1ed0594)

## [2.12.1] - 2026-01-12

### Bug Fixes

- **cloud-agent**: fix infinite restart loop and CI/CD build order (2364e5d)

## [2.12.0] - 2026-01-12

### Features

- **provisioning**: allocate public IPs via GraphQL for Fly.io agents (6a071d5)

## [2.11.1] - 2026-01-12

### Bug Fixes

- **provisioning**: add health checks and disable autostop for Fly.io machines (20bea48)

## [2.11.0] - 2026-01-12

### Features

- **web**: display and manage deployed cloud agents (07fd1d4)

## [2.10.0] - 2026-01-12

### Features

- **cloud-agent**: add fly.toml for proper Fly.io port mapping (72f5568)

### Bug Fixes

- **agent**: add /health endpoint for container health checks (27ed0af)

## [2.9.0] - 2026-01-12

### Features

- **cloud-agent**: add deployment step for 247-agent and update Dockerfile to copy standalone agent (4d72608)
- **cloud-agent**: rename user to quivr and use port 4678 (7c4b262)

### Bug Fixes

- **agent**: add missing .js extension to init-script import (30a10d2)
- **cloud-agent**: copy dist folder from builder stage to include compiled code (d23ec24)
- **provisioning**: use correct ghcr.io org for cloud-agent image (83ae0e7)
- **cloud-agent**: fix Dockerfile build issues (a36e06f)
- **cloud-agent**: copy root tsconfig.json for shared package build (55512b4)
- **cloud-agent**: build shared package before agent in Dockerfile (ee2bc88)
- **cloud-agent**: handle existing ubuntu user in Ubuntu 24.04 (c9dc41b)
- **cloud-agent**: correct config.cloud.json path in Dockerfile (5baa233)
- **ci**: correct Docker build context path for cloud-agent workflow (6accfcf)

## [2.8.1] - 2026-01-12

### Bug Fixes

- **cli**: add missing web-push dependency for push notifications (44699e7)
- move cloud-agent-image workflow to root .github/workflows (38c48d7)

### Chores

- **claude**: updated (86a8d30)

## [2.8.0] - 2026-01-12

### Features

- **cloud**: implement Launch Cloud Agent feature (f47415a)

## [2.7.0] - 2026-01-12

### Features

- **web**: show Fly.io connected state in CloudWelcomeView (5fb98b2)

## [2.6.0] - 2026-01-12

### Features

- **provisioning**: implement Fly.io token management (aa6aed5)

## [2.5.3] - 2026-01-12

### Bug Fixes

- **auth**: fix GitHub OAuth and Fly.io token validation (ec90928)

## [2.5.2] - 2026-01-12

### Bug Fixes

- **agent**: use bash for init script content, separate targetShell (45614f1)

## [2.5.1] - 2026-01-12

### Bug Fixes

- sync pnpm-lock.yaml and untrack next-env.d.ts (ea1871e)

## [2.5.0] - 2026-01-12

### Features

- **web**: add cloud auth UI with dual CTA cards (7216415)

### Chores

- add next-env.d.ts to gitignore (b21da95)

## [2.4.0] - 2026-01-12

### Features

- **provisioning**: add cloud provisioning service with GitHub OAuth (a1a7797)

## [2.3.0] - 2026-01-12

### Features

- **web**: add search bar to project dropdown (a80bcb8)

## [2.2.1] - 2026-01-11

### Bug Fixes

- **web**: session creation from modal while in existing session (038eaad)

## [2.2.0] - 2026-01-11

### Features

- **agent**: redesign terminal boot animation with robot AI (58bc37e)
- **hooks**: add typecheck to pre-commit and tests to pre-push (b27c66d)

## [2.1.0] - 2026-01-11

### Features

- **push**: add Web Push notifications for background alerts (aa909e3)

## [2.0.1] - 2026-01-11

### Bug Fixes

- **agent**: suppress macOS bash deprecation warning in terminal (e3fea90)

## [2.0.0] - 2026-01-11

### Breaking Changes

- remove managed projects, issues and planning features (#11) (4a66334)

### Features

- **agent**: add animated rabbit loader to terminal init (#10) (7004fb3)
- **web**: make git worktree optional when creating sessions (#9) (90b8899)

### Bug Fixes

- **agent**: restore animated rabbit loader accidentally removed in 4a66334 (529ebba)
- **web**: remove worktree param when creating non-worktree session (#12) (8643cc3)

### Refactoring

- remove managed projects, issues and planning features (#11) (4a66334)

## [1.7.0] - 2026-01-11

### Features

- **planning**: implement planning session with Claude (#8) (98527b3)
- **agent**: enhance terminal init script for better UX (#7) (deb5ef1)

### Bug Fixes

- **web**: fix mobile Start Session button not responding (#6) (2a3d0ed)

### Documentation

- add git worktree workflow instructions to CLAUDE.md (e37a1d2)

## [1.6.0] - 2026-01-10

### Features

- **agent**: use bash init script instead of tmux send-keys injection (d355eaf)

## [1.5.0] - 2026-01-10

### Features

- **web**: add pull-to-refresh for mobile PWA (#3) (ba67f29)

### Bug Fixes

- **release**: enforce main branch for releases (4f8fdd5)

### Chores

- track settings.local.json in git (1b59ea8)

## [1.4.1] - 2026-01-10

### Bug Fixes

- **worktree**: cleanup worktree immediately when session is closed or archived (e18bfa4)

## [1.4.0] - 2026-01-10

### Features

- **worktree**: enable Git worktree isolation with Push/PR UI actions (52eed31)
- **database**: add Ralph mode support with new columns and migration to v5 (af307c2)

## [1.3.0] - 2026-01-10

### Features

- **agent**: improve status detection with Stop hook and notification_type parsing (943f625)

### Bug Fixes

- **agent**: sanitize Ralph Loop prompts to remove shell special characters (ad9641c)

## [1.2.0] - 2026-01-09

### Features

- **web**: add Ralph Loop feature with terminal stability fixes (b51c743)

## [1.1.0] - 2026-01-09

### Features

- **agent**: add Notification hook for session status detection (68ed0eb)

## [1.0.4] - 2026-01-09

### Bug Fixes

- **pwa**: remove orange title bar on macOS PWA (9a04540)

### Chores

- reduce test output verbosity (20d8be0)

## [1.0.3] - 2026-01-09

### Bug Fixes

- **hooks**: cleanup old hooks from settings.json and plugin directory (ce246fe)

## [1.0.2] - 2026-01-09

### Bug Fixes

- **terminal**: remove CLAUDE_TMUX_SESSION reinjection for existing sessions (48a8d33)

## [1.0.1] - 2026-01-09

### Bug Fixes

- **agent**: improve status mapping and prevent ghost sessions (9b76f10)

## [1.0.0] - 2026-01-09

### Breaking Changes

- replace hooks with heartbeat system and persist StatusLine metrics (82f6d00)

### Features

- replace hooks with heartbeat system and persist StatusLine metrics (82f6d00)

### Tests

- **agent**: add tests for auto-update fixes (f7586ee)

## [0.8.3] - 2026-01-08

### Bug Fixes

- **agent**: fix auto-update version detection and script reliability (7ab6158)

## [0.8.2] - 2026-01-08

### Documentation

- add README (c7192a9)
- move README.md to project root (2e8cd2c)

## [0.8.1] - 2026-01-08

### Bug Fixes

- **web**: strip protocol prefix from agent URL on save (407ae62)

## [0.8.0] - 2026-01-08

### Features

- **web**: display app version in sidebar footer (d98a669)

### Bug Fixes

- **cli**: make version tests independent of actual version (bc1061d)

## [0.7.0] - 2026-01-08

### Features

- **cli**: add version command with update check (e37ab7f)

## [0.6.1] - 2026-01-08

### Bug Fixes

- **deploy**: add pnpm setup to Vercel deploy workflow (e28a89e)

## [0.6.0] - 2026-01-08

### Features

- **deploy**: deploy web to Vercel only on git tags (0aa1c69)

### Chores

- trigger release (6359bc0)

## [0.5.2] - 2026-01-08

### Documentation

- enhance README with GitHub SEO optimizations (135385b)

## [0.5.1] - 2026-01-08

### Documentation

- add README.md (bd61908)

## [0.5.0] - 2026-01-08

### Features

- **package-updater**: implement version retrieval from last git tag (eea567f)
- **agent**: add auto-update system for version sync with web (cd2a366)
