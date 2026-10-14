import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  countSessionsUnder,
  countSessionsByMachine,
  fetchAgentFolders,
  joinFolderPath,
  matchesProjectFilter,
} from '@/lib/folders';

describe('joinFolderPath', () => {
  it('returns the name for the base folder', () => {
    expect(joinFolderPath('', 'app')).toBe('app');
  });

  it('joins nested paths with a slash', () => {
    expect(joinFolderPath('group', 'app')).toBe('group/app');
  });
});

describe('matchesProjectFilter', () => {
  it('matches the folder itself', () => {
    expect(matchesProjectFilter('group', 'group')).toBe(true);
  });

  it('matches nested projects under the folder', () => {
    expect(matchesProjectFilter('group/app', 'group')).toBe(true);
  });

  it('does not match siblings that merely share a prefix', () => {
    expect(matchesProjectFilter('group-two', 'group')).toBe(false);
  });

  it('does not match unrelated projects', () => {
    expect(matchesProjectFilter('other', 'group')).toBe(false);
  });

  it('does not match a different nested folder', () => {
    expect(matchesProjectFilter('group/app', 'group/lib')).toBe(false);
  });

  it('does not confuse a literal "__" in a folder name with a path separator', () => {
    expect(matchesProjectFilter('group__app', 'group')).toBe(false);
    expect(matchesProjectFilter('group/app', 'group__app')).toBe(false);
  });
});

describe('countSessionsByMachine', () => {
  it('groups counts per machine and project', () => {
    const result = countSessionsByMachine([
      { machineId: 'a', project: 'app' },
      { machineId: 'a', project: 'app' },
      { machineId: 'a', project: 'lib' },
      { machineId: 'b', project: 'app' },
    ]);
    expect(result.a).toEqual({ app: 2, lib: 1 });
    expect(result.b).toEqual({ app: 1 });
  });

  it('handles folder and machine names like __proto__ without polluting prototypes', () => {
    const result = countSessionsByMachine([
      { machineId: '__proto__', project: '__proto__' },
      { machineId: '__proto__', project: '__proto__' },
    ]);
    // The reserved name is a real, countable key…
    expect(result['__proto__']['__proto__']).toBe(2);
    // …and nothing leaked onto Object.prototype.
    expect(({} as Record<string, unknown>).__proto__).toBe(Object.prototype);
  });

  it('returns an empty grouping for no sessions', () => {
    expect(Object.keys(countSessionsByMachine([]))).toEqual([]);
  });
});

describe('countSessionsUnder', () => {
  const counts = { group: 1, 'group/app': 2, 'group/lib': 3, 'group-two': 5, other: 7 };

  it('sums the folder and everything nested under it', () => {
    expect(countSessionsUnder(counts, 'group')).toBe(6);
  });

  it('counts a leaf folder on its own', () => {
    expect(countSessionsUnder(counts, 'group/app')).toBe(2);
  });

  it('returns zero when nothing matches', () => {
    expect(countSessionsUnder(counts, 'missing')).toBe(0);
  });
});

describe('fetchAgentFolders', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('requests the base folders without a query', async () => {
    const fetchMock = stubFetch({ json: async () => ['a', 'b'] });

    const result = await fetchAgentFolders('localhost:4678', '');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4678/api/folders');
    expect(result).toEqual(['a', 'b']);
  });

  it('encodes the nested path in the query string', async () => {
    const fetchMock = stubFetch({ json: async () => ['src'] });

    await fetchAgentFolders('localhost:4678', 'group/my app');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4678/api/folders?path=group%2Fmy%20app'
    );
  });

  it('throws on a non-OK response', async () => {
    stubFetch({ ok: false, status: 404, json: async () => ({}) });

    await expect(fetchAgentFolders('localhost:4678', 'gone')).rejects.toThrow('404');
  });

  it('ignores non-string entries in the response', async () => {
    stubFetch({ json: async () => ['a', 1, null, 'b'] });

    await expect(fetchAgentFolders('localhost:4678', '')).resolves.toEqual(['a', 'b']);
  });

  it('returns an empty list when the response is not an array', async () => {
    stubFetch({ json: async () => ({ error: 'nope' }) });

    await expect(fetchAgentFolders('localhost:4678', '')).resolves.toEqual([]);
  });
});
