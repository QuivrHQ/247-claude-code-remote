/**
 * Terminal constants and theme configuration
 */

import { projectSlug } from '247-shared';

// Reconnection constants
export const WS_RECONNECT_BASE_DELAY = 1000; // 1 second
export const WS_RECONNECT_MAX_DELAY = 30000; // 30 seconds

// Heartbeat constants (adaptive ping)
export const WS_PING_INTERVAL = 10000; // 10 seconds between pings
export const WS_PONG_TIMEOUT = 5000; // 5 seconds to receive pong
export const WS_ACTIVITY_PAUSE = 3000; // 3 seconds after activity before resuming pings

// xterm.js theme
export const TERMINAL_THEME = {
  background: '#0a0a10',
  foreground: '#e4e4e7',
  cursor: '#f97316',
  cursorAccent: '#0a0a10',
  selectionBackground: 'rgba(249, 115, 22, 0.3)',
  selectionForeground: '#ffffff',
  black: '#18181b',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa',
};

// Session name generator (same as agent)
export function generateSessionName(project: string): string {
  const adjectives = [
    'brave',
    'swift',
    'calm',
    'bold',
    'wise',
    'keen',
    'fair',
    'wild',
    'bright',
    'cool',
  ];
  const nouns = ['lion', 'hawk', 'wolf', 'bear', 'fox', 'owl', 'deer', 'lynx', 'eagle', 'tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${projectSlug(project)}--${adj}-${noun}-${num}`;
}
