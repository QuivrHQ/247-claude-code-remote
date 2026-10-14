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

  const ipv6 = parseIPv6(host);
  if (ipv6) return isPrivateIPv6(ipv6);

  const ipv4 = parseIPv4(host);
  return ipv4 !== null && isPrivateIPv4(ipv4);
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

function isPrivateIPv4(octets: readonly number[]): boolean {
  const [a, b] = octets;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function parseIPv6Groups(part: string): number[] | null {
  if (part === '') return [];
  const groups = part.split(':');
  if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => parseInt(group, 16));
}

/**
 * Expand a textual IPv6 address (any compression, optional zone id and
 * embedded IPv4 tail) into its 8 16-bit groups, or null when it is not one.
 */
function parseIPv6(host: string): number[] | null {
  const address = host.split('%')[0];
  if (!address.includes(':')) return null;

  let text = address;
  const embeddedIPv4 = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.exec(address);
  if (embeddedIPv4) {
    const octets = parseIPv4(embeddedIPv4[0]);
    if (!octets) return null;
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    text = `${address.slice(0, -embeddedIPv4[0].length)}${high}:${low}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const head = parseIPv6Groups(halves[0]);
  if (!head) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;

  const tail = parseIPv6Groups(halves[1]);
  if (!tail) return null;
  const missing = 8 - head.length - tail.length;
  return missing >= 1 ? [...head, ...new Array<number>(missing).fill(0), ...tail] : null;
}

// Loopback (::1), unique-local (fc00::/7), link-local (fe80::/10) and
// IPv4-mapped addresses (::ffff:a.b.c.d) that map to a private IPv4 range.
function isPrivateIPv6(groups: readonly number[]): boolean {
  const isMappedIPv4 = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (isMappedIPv4) {
    return isPrivateIPv4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff]);
  }

  const isLoopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  const isUniqueLocal = (groups[0] & 0xfe00) === 0xfc00;
  const isLinkLocal = (groups[0] & 0xffc0) === 0xfe80;
  return isLoopback || isUniqueLocal || isLinkLocal;
}

function parseIPv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

/**
 * Host of the "same computer" agent. A self-hosted dashboard (localhost, a LAN
 * address or a `.local` name) runs next to its agent, so the agent lives on the
 * dashboard's own host. A dashboard served from a public hostname is only a
 * web UI: the agent runs on the browser's machine, reached via `localhost`.
 */
export function getLocalAgentHost(): string {
  if (typeof window === 'undefined') return 'localhost';

  const { hostname } = window.location;
  return hostname && isPlaintextHost(hostname) ? hostname : 'localhost';
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
