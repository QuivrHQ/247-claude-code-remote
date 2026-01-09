# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
