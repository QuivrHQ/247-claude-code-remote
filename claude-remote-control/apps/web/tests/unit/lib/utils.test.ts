/**
 * Utils Module Tests
 *
 * Tests for utility functions used across the application.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  cn,
  stripProtocol,
  buildWebSocketUrl,
  buildApiUrl,
  isPlaintextHost,
  parseHostPort,
  getLocalAgentHost,
} from '@/lib/utils';

describe('Utils', () => {
  describe('parseHostPort', () => {
    it('splits host and port', () => {
      expect(parseHostPort('example.com:4678')).toEqual({ host: 'example.com', port: '4678' });
    });

    it('returns an empty port when none is given', () => {
      expect(parseHostPort('example.com')).toEqual({ host: 'example.com', port: '' });
    });

    it('ignores the path', () => {
      expect(parseHostPort('example.com:4678/api/x:y')).toEqual({
        host: 'example.com',
        port: '4678',
      });
    });

    it('lowercases the host', () => {
      expect(parseHostPort('Example.COM:4678').host).toBe('example.com');
    });

    it('parses a bracketed IPv6 literal with a port', () => {
      expect(parseHostPort('[::1]:4678')).toEqual({ host: '::1', port: '4678' });
    });

    it('parses a bracketed IPv6 literal without a port', () => {
      expect(parseHostPort('[::1]')).toEqual({ host: '::1', port: '' });
    });

    it('treats a bare IPv6 literal as host only', () => {
      expect(parseHostPort('::1')).toEqual({ host: '::1', port: '' });
    });
  });

  describe('isPlaintextHost', () => {
    it.each([
      'localhost:4678',
      'app.localhost:4678',
      'macbook.local:4678',
      '127.0.0.1:4678',
      '127.8.9.10',
      '10.0.10.2:4678',
      '192.168.1.5:4678',
      '172.16.0.1',
      '172.31.255.255',
      '[::1]:4678',
      '[fd00::1]:4678',
      '[fc00::1]',
      '[FD12:3456:789a::1]:4678',
      '[fe80::1]:4678',
      '[febf::1]',
      '[0:0:0:0:0:0:0:1]:4678',
      '[0000:0000:0000:0000:0000:0000:0000:0001]',
      '[::0001]',
      'fe80::1%en0',
      '[::ffff:192.168.1.5]:4678',
      '[::ffff:7f00:1]',
    ])('treats %s as plaintext', (host) => {
      expect(isPlaintextHost(host)).toBe(true);
    });

    it.each([
      'example.com:4678',
      '10.example.com:4678',
      '192.168.example.com',
      '127.example.com',
      '172.32.0.1',
      '172.15.0.1',
      '8.8.8.8',
      '10.0.0.999',
      '300.1.1.1',
      '[2001:db8::1]:4678',
      '[fec0::1]',
      '[fd::1]',
      '[fe::1]',
      'fdab.example.com:4678',
      'fe80.example.com',
      '[::]',
      '[::2]',
      '[::ffff:8.8.8.8]',
      '[1:2:3:4:5:6:7:8:9]',
      '[1::2::3]',
      '[gggg::1]',
    ])('treats %s as TLS', (host) => {
      expect(isPlaintextHost(host)).toBe(false);
    });

    it('builds plain ws/http URLs for a bracketed IPv6 loopback', () => {
      expect(buildWebSocketUrl('[::1]:4678', '/status')).toBe('ws://[::1]:4678/status');
      expect(buildApiUrl('[::1]:4678', '/api/sessions')).toBe('http://[::1]:4678/api/sessions');
    });

    it('builds plain ws/http URLs for a unique-local IPv6 LAN agent', () => {
      expect(buildWebSocketUrl('[fd00::1]:4678', '/status')).toBe('ws://[fd00::1]:4678/status');
      expect(buildApiUrl('[fe80::1]:4678', '/api/sessions')).toBe(
        'http://[fe80::1]:4678/api/sessions'
      );
    });

    it('uses TLS for DNS names that merely start with a private octet', () => {
      expect(buildApiUrl('10.example.com:4678', '/api/sessions')).toBe(
        'https://10.example.com:4678/api/sessions'
      );
    });
  });

  describe('getLocalAgentHost', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function serveDashboardFrom(hostname: string) {
      vi.stubGlobal('location', { ...window.location, hostname });
    }

    it.each(['localhost', '127.0.0.1', '10.0.10.2', '192.168.1.5', 'macbook.local', '[::1]'])(
      'uses the dashboard host %s for self-hosted deployments',
      (hostname) => {
        serveDashboardFrom(hostname);
        expect(getLocalAgentHost()).toBe(hostname);
      }
    );

    it.each(['247.quivr.com', 'example.com', 'my-dashboard.vercel.app'])(
      'targets localhost when the dashboard is hosted on %s',
      (hostname) => {
        serveDashboardFrom(hostname);
        expect(getLocalAgentHost()).toBe('localhost');
      }
    );

    it('falls back to localhost when there is no hostname', () => {
      serveDashboardFrom('');
      expect(getLocalAgentHost()).toBe('localhost');
    });
  });

  describe('cn function', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      const showBar = true;
      const showBaz = false;
      expect(cn('foo', showBar && 'bar', showBaz && 'baz')).toBe('foo bar');
    });

    it('handles undefined values', () => {
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('handles null values', () => {
      expect(cn('foo', null, 'bar')).toBe('foo bar');
    });

    it('handles arrays of classes', () => {
      expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
    });

    it('handles object notation', () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });

    it('merges Tailwind classes correctly', () => {
      // tw-merge should keep only the last conflicting utility
      expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('merges color utilities correctly', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('keeps non-conflicting classes', () => {
      expect(cn('p-2', 'm-4', 'text-lg')).toBe('p-2 m-4 text-lg');
    });

    it('handles empty input', () => {
      expect(cn()).toBe('');
    });

    it('handles single class', () => {
      expect(cn('foo')).toBe('foo');
    });

    it('handles complex conditional expressions', () => {
      const isActive = true;
      const isDisabled = false;

      expect(
        cn('base-class', isActive && 'active-class', isDisabled && 'disabled-class', {
          'object-class': true,
          'hidden-class': false,
        })
      ).toBe('base-class active-class object-class');
    });

    it('handles Tailwind responsive utilities', () => {
      expect(cn('p-2', 'sm:p-4', 'md:p-6')).toBe('p-2 sm:p-4 md:p-6');
    });

    it('handles Tailwind state modifiers', () => {
      expect(cn('hover:bg-blue-500', 'focus:bg-blue-600')).toBe(
        'hover:bg-blue-500 focus:bg-blue-600'
      );
    });
  });

  describe('stripProtocol', () => {
    it('strips https:// protocol', () => {
      expect(stripProtocol('https://example.com')).toBe('example.com');
    });

    it('strips http:// protocol', () => {
      expect(stripProtocol('http://example.com')).toBe('example.com');
    });

    it('strips wss:// protocol', () => {
      expect(stripProtocol('wss://example.com')).toBe('example.com');
    });

    it('strips ws:// protocol', () => {
      expect(stripProtocol('ws://example.com')).toBe('example.com');
    });

    it('preserves port numbers', () => {
      expect(stripProtocol('https://example.com:4678')).toBe('example.com:4678');
    });

    it('preserves path', () => {
      expect(stripProtocol('https://example.com/path/to/resource')).toBe(
        'example.com/path/to/resource'
      );
    });

    it('returns unchanged URL without protocol', () => {
      expect(stripProtocol('example.com:4678')).toBe('example.com:4678');
    });

    it('handles localhost with protocol', () => {
      expect(stripProtocol('http://localhost:4678')).toBe('localhost:4678');
    });

    it('handles Tailscale URLs', () => {
      expect(stripProtocol('https://macbook-pro.tail5f910b.ts.net:4678')).toBe(
        'macbook-pro.tail5f910b.ts.net:4678'
      );
    });
  });

  describe('buildWebSocketUrl', () => {
    it('builds ws:// URL for localhost', () => {
      expect(buildWebSocketUrl('localhost:4678', '/status')).toBe('ws://localhost:4678/status');
    });

    it('builds ws:// URL for 127.0.0.1', () => {
      expect(buildWebSocketUrl('127.0.0.1:4678', '/status')).toBe('ws://127.0.0.1:4678/status');
    });

    it('builds wss:// URL for non-localhost domains', () => {
      expect(buildWebSocketUrl('example.com:4678', '/status')).toBe(
        'wss://example.com:4678/status'
      );
    });

    it('strips existing https:// protocol before building URL', () => {
      expect(buildWebSocketUrl('https://example.com:4678', '/status')).toBe(
        'wss://example.com:4678/status'
      );
    });

    it('strips existing http:// protocol before building URL', () => {
      expect(buildWebSocketUrl('http://localhost:4678', '/status')).toBe(
        'ws://localhost:4678/status'
      );
    });

    it('handles Tailscale URLs with protocol', () => {
      expect(buildWebSocketUrl('https://macbook-pro.tail5f910b.ts.net:4678', '/status')).toBe(
        'wss://macbook-pro.tail5f910b.ts.net:4678/status'
      );
    });

    it('handles Tailscale URLs without protocol', () => {
      expect(buildWebSocketUrl('macbook-pro.tail5f910b.ts.net:4678', '/status')).toBe(
        'wss://macbook-pro.tail5f910b.ts.net:4678/status'
      );
    });

    it('handles paths with query parameters', () => {
      expect(buildWebSocketUrl('localhost:4678', '/terminal?project=test&session=s1')).toBe(
        'ws://localhost:4678/terminal?project=test&session=s1'
      );
    });

    it('handles complex paths', () => {
      expect(buildWebSocketUrl('https://example.com:4678', '/api/v1/websocket')).toBe(
        'wss://example.com:4678/api/v1/websocket'
      );
    });
  });

  describe('buildApiUrl', () => {
    it('builds http:// URL for localhost', () => {
      expect(buildApiUrl('localhost:4678', '/api/sessions')).toBe(
        'http://localhost:4678/api/sessions'
      );
    });

    it('builds http:// URL for 127.0.0.1', () => {
      expect(buildApiUrl('127.0.0.1:4678', '/api/sessions')).toBe(
        'http://127.0.0.1:4678/api/sessions'
      );
    });

    it('builds https:// URL for non-localhost domains', () => {
      expect(buildApiUrl('example.com:4678', '/api/sessions')).toBe(
        'https://example.com:4678/api/sessions'
      );
    });

    it('strips existing https:// protocol before building URL', () => {
      expect(buildApiUrl('https://example.com:4678', '/api/sessions')).toBe(
        'https://example.com:4678/api/sessions'
      );
    });

    it('strips existing http:// protocol before building URL', () => {
      expect(buildApiUrl('http://localhost:4678', '/api/sessions')).toBe(
        'http://localhost:4678/api/sessions'
      );
    });

    it('handles Tailscale URLs with protocol', () => {
      expect(buildApiUrl('https://macbook-pro.tail5f910b.ts.net:4678', '/api/sessions')).toBe(
        'https://macbook-pro.tail5f910b.ts.net:4678/api/sessions'
      );
    });

    it('handles Tailscale URLs without protocol', () => {
      expect(buildApiUrl('macbook-pro.tail5f910b.ts.net:4678', '/api/sessions')).toBe(
        'https://macbook-pro.tail5f910b.ts.net:4678/api/sessions'
      );
    });

    it('handles paths with query parameters', () => {
      expect(buildApiUrl('localhost:4678', '/api/clone/preview?url=test')).toBe(
        'http://localhost:4678/api/clone/preview?url=test'
      );
    });

    it('handles complex paths', () => {
      expect(buildApiUrl('https://example.com:4678', '/api/sessions/test/archive')).toBe(
        'https://example.com:4678/api/sessions/test/archive'
      );
    });

    it('handles URL with double protocol correctly', () => {
      // This is the key bug fix - URLs with existing protocol should not double up
      expect(
        buildApiUrl('https://macbook-pro.tail5f910b.ts.net:4678', '/api/sessions/archived')
      ).toBe('https://macbook-pro.tail5f910b.ts.net:4678/api/sessions/archived');
    });
  });
});
