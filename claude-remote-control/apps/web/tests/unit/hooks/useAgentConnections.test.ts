import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentConnections, LOCAL_DEFAULT_ID } from '@/hooks/useAgentConnections';

const STORAGE_KEY = '247-local-connections';

function storedConnections(): Array<{ id: string; url: string; name: string }> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
}

async function renderLoaded() {
  const hook = renderHook(() => useAgentConnections());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useAgentConnections', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.removeItem(STORAGE_KEY);
  });

  describe('first-run seeding', () => {
    it('seeds a default local connection when nothing is stored', async () => {
      const { result } = await renderLoaded();

      expect(result.current.connections).toHaveLength(1);
      expect(result.current.connections[0].id).toBe(LOCAL_DEFAULT_ID);
      expect(result.current.connections[0].url).toMatch(/:4678$/);
      expect(storedConnections()).toHaveLength(1);
    });

    it('does not re-seed after the last connection was removed', async () => {
      const first = await renderLoaded();
      await act(async () => {
        await first.result.current.removeConnection(LOCAL_DEFAULT_ID);
      });
      expect(first.result.current.connections).toEqual([]);
      first.unmount();

      const second = await renderLoaded();

      expect(second.result.current.connections).toEqual([]);
      expect(storedConnections()).toEqual([]);
    });

    it('re-seeds when the stored value is corrupt', async () => {
      window.localStorage.setItem(STORAGE_KEY, '{not json');

      const { result } = await renderLoaded();

      expect(result.current.connections).toHaveLength(1);
      expect(result.current.connections[0].id).toBe(LOCAL_DEFAULT_ID);
    });
  });

  describe('addConnection', () => {
    it('adds a new connection and persists it', async () => {
      const { result } = await renderLoaded();

      let added;
      await act(async () => {
        added = await result.current.addConnection({ url: 'mac.example.com:4678', name: 'Mac' });
      });

      expect(added).toMatchObject({ url: 'mac.example.com:4678', name: 'Mac', method: 'custom' });
      expect(storedConnections().map((c) => c.url)).toContain('mac.example.com:4678');
    });

    it('dedupes by URL ignoring protocol and host case', async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.addConnection({ url: 'Mac.Example.com:4678', name: 'First' });
        await result.current.addConnection({ url: 'https://mac.example.com:4678', name: 'Second' });
      });

      const matching = storedConnections().filter(
        (c) => c.url.toLowerCase().replace(/^https:\/\//, '') === 'mac.example.com:4678'
      );
      expect(matching).toHaveLength(1);
      expect(matching[0].name).toBe('Second');
    });

    it('keeps URLs that differ only in path case distinct', async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.addConnection({ url: 'host.example.com:4678/Alpha', name: 'A' });
        await result.current.addConnection({ url: 'host.example.com:4678/alpha', name: 'B' });
      });

      const paths = storedConnections().filter((c) => c.url.startsWith('host.example.com'));
      expect(paths).toHaveLength(2);
    });

    it('rejects and reports an error when storage cannot be written', async () => {
      const { result } = await renderLoaded();
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        removeItem: () => undefined,
        setItem: () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        },
      });

      await act(async () => {
        await expect(
          result.current.addConnection({ url: 'fail.example.com:4678', name: 'Fail' })
        ).rejects.toThrow(/Could not save connections/);
      });

      expect(result.current.error).toMatch(/Could not save connections/);
      expect(result.current.connections.map((c) => c.url)).not.toContain('fail.example.com:4678');
    });
  });

  describe('updateConnection', () => {
    it('updates name and color of an existing connection', async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await result.current.updateConnection(LOCAL_DEFAULT_ID, { name: 'Renamed', color: '#fff' });
      });

      expect(storedConnections()[0].name).toBe('Renamed');
    });

    it('throws when the connection does not exist', async () => {
      const { result } = await renderLoaded();

      await act(async () => {
        await expect(result.current.updateConnection('missing', { name: 'x' })).rejects.toThrow(
          'Connection not found'
        );
      });
    });
  });

  describe('multi-tab merge', () => {
    it('merges changes made by another tab instead of overwriting them', async () => {
      const { result } = await renderLoaded();
      const other = [
        ...storedConnections(),
        { id: 'other-tab', url: 'other.example.com:4678', name: 'Other', method: 'custom' },
      ];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(other));

      await act(async () => {
        await result.current.addConnection({ url: 'mine.example.com:4678', name: 'Mine' });
      });

      const urls = storedConnections().map((c) => c.url);
      expect(urls).toContain('other.example.com:4678');
      expect(urls).toContain('mine.example.com:4678');
    });
  });
});
