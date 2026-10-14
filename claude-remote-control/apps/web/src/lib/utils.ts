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
 * and private LAN ranges (IPv4 10/8, 172.16/12, 192.168/16; IPv6 unique-local
 * fc00::/7 and link-local fe80::/10) — these are served by the agent without
 * a certificate, so TLS would fail.
 */
export function isPlaintextHost(cleanUrl: string): boolean {
  const { host } = parseHostPort(cleanUrl);
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || isPrivateIPv6(host)) return true;
  const octets = parseIPv4(host);
  if (!octets) return false;
  const [a, b] = octets;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Split a protocol-less agent URL into host and port. Understands bracketed
 * IPv6 literals (`[::1]:4678`); the returned host never includes brackets.
 */
export function parseHostPort(cleanUrl: string): { host: string; port: string } {
  const authority = cleanUrl.split('/')[0];
  if (authority.startsWith('[')) {
    const end = authority.indexOf(']');
    if (end !== -1) {
      const rest = authority.slice(end + 1);
      return {
        host: authority.slice(1, end).toLowerCase(),
        port: rest.startsWith(':') ? rest.slice(1) : '',
      };
    }
  }
  const colon = authority.indexOf(':');
  // No colon, or several colons without brackets (bare IPv6): no port to split off.
  if (colon === -1 || colon !== authority.lastIndexOf(':')) {
    return { host: authority.toLowerCase(), port: '' };
  }
  return { host: authority.slice(0, colon).toLowerCase(), port: authority.slice(colon + 1) };
}

// Unique-local (fc00::/7) and link-local (fe80::/10) literals. Only a full
// four-digit first group can fall in these ranges; the trailing colon rules
// out DNS names such as `fdab.example.com`.
function isPrivateIPv6(host: string): boolean {
  return /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
}

function parseIPv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

/**
 * Hostname the dashboard is served from. A "local" agent runs on the same
 * host, so this is what the local-agent URL and its field label should show.
 */
export function getLocalAgentHost(): string {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
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
