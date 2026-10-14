import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip protocol (http://, https://, ws://, wss://) from a URL
 * Returns just the host:port/path portion
 */
export function stripProtocol(url: string): string {
  return url.replace(/^(https?|wss?):\/\//, '');
}

/**
 * Decide whether an agent host should be reached over plaintext (ws/http)
 * rather than TLS (wss/https). True for localhost, loopback, mDNS `.local`,
 * and private LAN ranges (10/8, 172.16/12, 192.168/16) — these are served by
 * the agent without a certificate, so TLS would fail.
 */
export function isPlaintextHost(cleanUrl: string): boolean {
  const host = cleanUrl.split('/')[0].split(':')[0].toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host.startsWith('127.')) return true;
  // IPv4 private ranges
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

/**
 * Build a WebSocket URL from an agent URL
 * Handles both URLs with and without protocol
 */
export function buildWebSocketUrl(agentUrl: string, path: string): string {
  const cleanUrl = stripProtocol(agentUrl);
  const wsProtocol = isPlaintextHost(cleanUrl) ? 'ws' : 'wss';
  return `${wsProtocol}://${cleanUrl}${path}`;
}

/**
 * Build an HTTP API URL from an agent URL
 * Handles both URLs with and without protocol
 */
export function buildApiUrl(agentUrl: string, path: string): string {
  const cleanUrl = stripProtocol(agentUrl);
  const protocol = isPlaintextHost(cleanUrl) ? 'http' : 'https';
  return `${protocol}://${cleanUrl}${path}`;
}
