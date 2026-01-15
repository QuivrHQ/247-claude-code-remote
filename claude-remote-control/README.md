<p align="center">
  <img src="https://247.quivr.com/logo.svg" alt="247 Logo" width="120" />
</p>

<h1 align="center">247</h1>

<p align="center">
  <strong>Run Claude Code from your phone. Seriously.</strong>
</p>

<p align="center">
  <a href="https://247.quivr.com">Website</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="https://github.com/QuivrHQ/247/issues">Report Bug</a>
</p>

<p align="center">
  <a href="https://github.com/QuivrHQ/247/releases"><img src="https://img.shields.io/github/v/release/QuivrHQ/247?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/QuivrHQ/247/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://www.ycombinator.com/companies/quivr"><img src="https://img.shields.io/badge/Y%20Combinator-W24-orange?style=flat-square" alt="YC W24"></a>
</p>

---

**247** lets you access Claude Code from anywhere - your phone, tablet, or any browser. Start a coding task from your desk, continue it from the couch, check on it from your phone at dinner.

Sessions persist forever with tmux. Disconnect and reconnect anytime. Your AI keeps working.

<!-- TODO: Add demo GIF here -->

![247 Demo](demo.gif)

<!-- ![247 Demo](./docs/assets/demo.gif) -->

## Quick Start

```bash
npm install -g 247-cli
247 init
247 start
open https://247.quivr.com
```

## Why 247?

| Problem                                  | Solution                              |
| ---------------------------------------- | ------------------------------------- |
| Claude Code is desktop-only              | Access from any device with a browser |
| Sessions die when you close the terminal | tmux keeps sessions alive forever     |
| Can't check on long-running tasks        | Real-time status on your phone        |
| Complex tunnel setup                     | One command: `247 init`               |
| Don't want to run on your machine        | Cloud VMs on Fly.io                   |

## Features

**Mobile-First Terminal** - Full xterm.js terminal optimized for touch. Install as a PWA.

**Persistent Sessions** - tmux-backed. Close your browser, the session keeps running.

**One-Click Claude Code** - Hit play, Claude starts. No commands to type.

**Real-Time Status** - See what Claude is doing without opening the terminal: status, cost, context usage.

**Secure** - Tailscale Funnel. No port forwarding. Project whitelisting. All data stays local.

**Cloud VMs** - Don't want to run the agent on your machine? Spin up a VM on Fly.io with one click. Full isolation, auto-shutdown when idle.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Phone/Browser                       │
│                        https://247.quivr.com                     │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTPS/WebSocket
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Tailscale Funnel                          │
│                    (secure, no port forwarding)                  │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              247 Agent (local machine or Fly.io VM)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Express    │  │  WebSocket  │  │  tmux + Claude Code     │  │
│  │  Server     │  │  Terminal   │  │  Sessions               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                         │                                        │
│                         ▼                                        │
│                   ┌───────────┐                                  │
│                   │  SQLite   │  (local persistence)             │
│                   └───────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

<p align="center">
  MIT License · Built by <a href="https://quivr.com">Quivr</a> (YC W24)
</p>

### Bugs

It is probably full of bugs :D Bear in mind this is an early project that I built for personal use and open-sourced. Please report any issues but would love for you to fix them if you can too!
