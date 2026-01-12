# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
