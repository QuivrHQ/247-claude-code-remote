# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.44.0] - 2026-01-30

### Features

- **web**: add mobile filtering and refactor session actions (797bf3f)

## [2.43.0] - 2026-01-30

### Features

- **auth**: add error handling to POST request and include polyfills for compatibility Google Pixel Tablet) (#13) (f4546ca)

## [2.42.2] - 2026-01-30

### Bug Fixes

- **web**: remove help button from header (a6261ff)

## [2.42.1] - 2026-01-30

### Bug Fixes

- **web**: remove settings button from sidebar (834f57a)

## [2.42.0] - 2026-01-30

### Features

- **web**: add context menu to sidebar for machine rename/remove (b9969c6)

## [2.41.5] - 2026-01-30

### Bug Fixes

- **web**: use real user session data instead of hardcoded mock (0f125af)

## [2.41.4] - 2026-01-28

### Bug Fixes

- **cli**: show detailed npm errors on update failure and verify installed version (c7b27fa)

## [2.41.3] - 2026-01-28

### Bug Fixes

- **cli**: auto-rebuild native modules when Node.js version changes (2c2e5ea)

## [2.41.2] - 2026-01-22

### Bug Fixes

- **pwa**: clear app badge when app is opened or becomes visible (ba67165)

## [2.41.1] - 2026-01-22

### Bug Fixes

- **web**: play notification sound on WebSocket status changes (34400f3)

## [2.41.0] - 2026-01-22

### Features

- **web**: add multiple notification sound options (9a258f7)

### Bug Fixes

- **web**: connect bell icon to notification settings (698a237)

## [2.40.0] - 2026-01-22

### Features

- **web**: add notification preferences with sound support (67f0550)

## [2.39.0] - 2026-01-21

### Features

- add codex notification hooks (0e57d18)

### Bug Fixes

- **web**: improve session dropdown and notifications (6ce44a2)

### Tests

- stabilize localStorage mocks and hooks CLI tests (5a0a27d)

## [2.38.2] - 2026-01-20

### Bug Fixes

- **web**: remove duplicate in-app notification from WebSocket (b5a03fc)

## [2.38.1] - 2026-01-20

### Bug Fixes

- **web**: move notifications to top and fix session delete button (003fa56)

## [2.38.0] - 2026-01-20

### Features

- **web**: apply Linear × Craft hybrid design system (cf204c2)

## [2.37.0] - 2026-01-20

### Features

- **web**: redesign UI with 3-panel layout and new design system (2ea4e1b)

## [2.36.2] - 2026-01-20

### Bug Fixes

- **web**: memory optimizations and best practices audit (cecd5af)

## [2.36.1] - 2026-01-20

### Bug Fixes

- **agent**: detect user shell from /etc/passwd when SHELL env is unset (a79a817)

### Refactoring

- remove dead code and unused exports (5b27655)

### Chores

- ignore .claude directories (5e50c7b)

## [2.36.0] - 2026-01-20

### Features

- add in-app notifications support (a244884)

### Chores

- resolve pending changes (2159913)
- update local settings (28da1d9)

## [2.35.0] - 2026-01-20

### Features

- **agents**: add machine renaming and color customization (bc6a039)
- add dead code detection with knip (74a0454)

### Bug Fixes

- **pwa**: add timeout on pushManager.subscribe() for iOS (5ef4d98)
- **pwa**: fix macOS notification click handling (c5abbf8)
- **pwa**: fix push notification handler to not block on badge API (6a1a626)

### Chores

- **release**: v2.34.3 (9d9f3a8)
- **release**: v2.34.2 (a5eae4d)
- **release**: v2.34.1 (884e17d)

## [2.34.3] - 2026-01-20

### Bug Fixes

- **pwa**: add timeout on pushManager.subscribe() for iOS (5ef4d98)

## [2.34.2] - 2026-01-20

### Bug Fixes

- **pwa**: fix macOS notification click handling (c5abbf8)

## [2.34.1] - 2026-01-20

### Bug Fixes

- **pwa**: fix push notification handler to not block on badge API (6a1a626)

## [2.34.0] - 2026-01-19

### Features

- **pwa**: enhance push notifications with actions and badge (94111b5)

## [2.33.2] - 2026-01-19

### Bug Fixes

- **session**: allow empty project for terminal at root (7475f75)

## [2.33.1] - 2026-01-19

### Bug Fixes

- **agent**: add nvm support for auto-update on Linux VMs (ac53092)

## [2.33.0] - 2026-01-19

### Features

- **session**: add clone repo tab and terminal at root option (842c8ac)

## [2.32.2] - 2026-01-19

### Bug Fixes

- **push**: improve iOS PWA notification deep linking (5095687)

## [2.32.1] - 2026-01-19

### Bug Fixes

- **push**: add timeout and logging for mobile push subscription (c4966b4)

## [2.32.0] - 2026-01-19

### Features

- **mobile**: add push notification button to mobile header (ad99c4a)

## [2.31.7] - 2026-01-19

### Bug Fixes

- **push**: include session URL in notification for deep linking (4173a60)

## [2.31.6] - 2026-01-19

## [2.31.5] - 2026-01-19

### Chores

- force redeploy (407a41b)

## [2.31.4] - 2026-01-19

### Bug Fixes

- **cli**: bundle hook script correctly for npm distribution (db2e63c)

## [2.31.3] - 2026-01-19

### Chores

- trigger redeploy for VAPID keys (d241e13)

## [2.31.2] - 2026-01-19

### Chores

- update README comment (97e4fb6)

## [2.31.1] - 2026-01-19

### Bug Fixes

- **web**: always show push notification button + add debug logging (d62b817)

## [2.31.0] - 2026-01-19

### Features

- **web**: add confirmation modal for push notification toggle (8b4c30f)

## [2.30.1] - 2026-01-19

### Bug Fixes

- **web**: use synchronous check for service worker controller (06993b7)
- **web**: add timeout for service worker ready check (12473aa)
- **web**: always show push notification button, delete unused Header.tsx (ede298c)

## [2.30.0] - 2026-01-19

### Features

- **web**: add push notification subscribe button in header (0925920)

### Bug Fixes

- **web**: add push notification button to correct header (MultiAgentHeader) (fd8b2da)

## [2.29.0] - 2026-01-19

### Features

- **push**: add PWA push notifications with machineId-based lookup (a5222fb)

## [2.28.2] - 2026-01-19

### Bug Fixes

- **hooks**: use CLAUDE_TMUX_SESSION env var instead of Claude's UUID (437d837)

### Chores

- update pnpm-lock.yaml after web-push addition (88c2377)

## [2.28.1] - 2026-01-19

### Bug Fixes

- **hooks**: add parentheses in jq timestamp expression (b7cdeae)

## [2.28.0] - 2026-01-19

### Features

- **hooks**: simplify hook system - any hook = needs_attention (9d929f0)
- **web**: add visual indicator for sessions needing attention (93f32e4)

### Bug Fixes

- **web**: add debug logging to browser notifications (f0603c4)

## [2.27.1] - 2026-01-19

### Bug Fixes

- **agent**: improve v17 migration robustness for status columns (268f2d1)

## [2.27.0] - 2026-01-19

### Features

- **web**: add browser notifications for session status updates (cfbcde4)

### Bug Fixes

- **web**: improve accessibility across UI components (445a4c3)

## [2.26.0] - 2026-01-19

### Features

- **cli**: add hooks command for Claude Code notification hooks (4563e82)

## [2.25.0] - 2026-01-19

### Features

- **agent**: add attention notification system via Claude Code hooks (87fd017)

## [2.24.1] - 2026-01-18

### Bug Fixes

- **web**: move paste button to mobile header, revert keybar changes (d647d32)

## [2.24.0] - 2026-01-18

### Features

- **web**: add mobile terminal text selection and copy/paste support (e481fd8)

## [2.23.5] - 2026-01-18

### Refactoring

- remove deprecated plugin-247 package and update README (f596e3d)

## [2.23.4] - 2026-01-18

### Refactoring

- remove worktree, git branches, and PR features (5e44e9a)
- remove hooks system and status tracking (0987859)

## [2.23.3] - 2026-01-18

### Refactoring

- simplify agent architecture by removing advanced features (e8da41f)

## [2.23.2] - 2026-01-18

### Bug Fixes

- update repository URLs to new location (d5a1199)

## [2.23.1] - 2026-01-18

### Bug Fixes

- use dynamic imports for all neon auth to avoid build-time env requirement (1feb92e)
- use dynamic import for neonAuthMiddleware to avoid build-time env requirement (131f8bd)
- make db connection lazy to avoid build-time env requirement (88d4730)
- make auth server lazy to avoid build-time env requirement (db22bfc)
- **ci**: add NEON_AUTH_BASE_URL env for build (43bb8f8)
- update pnpm-lock.yaml (d3aee8b)

## [2.23.0] - 2026-01-18

### Features

- add agent pairing system and remove session preview (ee614a9)

## [2.22.1] - 2026-01-17

### Refactoring

- remove environments, push notifications, and unused workflows (42f4da5)

### Tests

- fix tests after environments feature removal (c01926f)

## [2.22.0] - 2026-01-16

### Features

- make auth optional with sign-in required for agent connection (a612b28)
- add user profile menu with logout (d4a8378)
- add Neon Auth for stateful frontend (23704fe)
- update README with enhanced project description and add demo GIF (fb40548)
- add agent-browser documentation for web automation (744681d)

### Bug Fixes

- constrain SVG icons in Neon Auth UI buttons (9c6a3bb)
- use local demo.gif path in README (032d950)

### Refactoring

- major simplification - remove cloud, git, editor features (-11k lines) (58cee44)

## [2.21.1] - 2026-01-14

### Bug Fixes

- update schema version test to expect v11 (c8c199a)
- add missing types for stream-json feature (b226d3c)
- **provisioning**: upgrade cloud-agent VM specs to 2 CPUs and 2GB RAM (1cb301a)

## [2.21.1] - 2026-01-14

### Bug Fixes

- **provisioning**: upgrade cloud-agent VM specs to 2 CPUs and 2GB RAM (1cb301a)

## [2.21.0] - 2026-01-14

### Features

- **cloud-agent**: upgrade VM specs and add persistent storage (c15ed74)

## [2.20.4] - 2026-01-14

### Bug Fixes

- **ci**: deploy provisioning on tag push events (56b6f39)

## [2.20.3] - 2026-01-14

### Bug Fixes

- **cloud-agent**: cd to valid directory after symlink replacement (8c41dc3)

## [2.20.2] - 2026-01-14

### Bug Fixes

- **cloud-agent**: persist home and workspace on Fly.io volume (8ef0d1a)

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
