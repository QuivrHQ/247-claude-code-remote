import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  countSessionsUnder,
  fetchAgentFolders,
  isSameProject,
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

  it('matches the flattened slug form used in session names', () => {
    expect(matchesProjectFilter('group__app', 'group')).toBe(true);
    expect(matchesProjectFilter('group__app', 'group/app')).toBe(true);
    expect(matchesProjectFilter('group__app__api', 'group/app')).toBe(true);
  });

  it('does not match a different nested folder', () => {
    expect(matchesProjectFilter('group__app', 'group/lib')).toBe(false);
  });
});

describe('isSameProject', () => {
  it('treats the path and slug of one folder as equal', () => {
    expect(isSameProject('group/app', 'group__app')).toBe(true);
  });

  it('distinguishes a folder from its parent', () => {
    expect(isSameProject('group/app', 'group')).toBe(false);
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
