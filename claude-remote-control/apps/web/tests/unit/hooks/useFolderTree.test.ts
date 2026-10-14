import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFolderTree } from '@/hooks/useFolderTree';

function makeLoader(tree: Record<string, string[]>) {
  return vi.fn(async (path: string) => {
    if (!(path in tree)) throw new Error(`missing ${path}`);
    return tree[path];
  });
}

describe('useFolderTree', () => {
  it('loads the base folder on mount', async () => {
    const loader = makeLoader({ '': ['app', 'lib'] });

    const { result } = renderHook(() => useFolderTree(loader));

    await waitFor(() => expect(result.current.nodes['']?.status).toBe('loaded'));
    expect(result.current.nodes[''].children).toEqual(['app', 'lib']);
    expect(loader).toHaveBeenCalledWith('');
  });

  it('expands a folder and loads its children once', async () => {
    const loader = makeLoader({ '': ['app'], app: ['src', 'docs'] });
    const { result } = renderHook(() => useFolderTree(loader));
    await waitFor(() => expect(result.current.nodes['']?.status).toBe('loaded'));

    act(() => result.current.toggle('app'));
    await waitFor(() => expect(result.current.nodes['app']?.status).toBe('loaded'));

    expect(result.current.expanded.has('app')).toBe(true);
    expect(result.current.nodes['app'].children).toEqual(['src', 'docs']);

    act(() => result.current.toggle('app'));
    act(() => result.current.toggle('app'));

    expect(loader.mock.calls.filter(([path]) => path === 'app')).toHaveLength(1);
  });

  it('collapses an expanded folder without refetching', async () => {
    const loader = makeLoader({ '': ['app'], app: [] });
    const { result } = renderHook(() => useFolderTree(loader));
    await waitFor(() => expect(result.current.nodes['']?.status).toBe('loaded'));

    act(() => result.current.toggle('app'));
    await waitFor(() => expect(result.current.nodes['app']?.status).toBe('loaded'));
    act(() => result.current.toggle('app'));

    expect(result.current.expanded.has('app')).toBe(false);
  });

  it('marks a folder as errored and retries on the next expand', async () => {
    const loader = vi
      .fn<(path: string) => Promise<string[]>>()
      .mockResolvedValueOnce(['app'])
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(['src']);
    const { result } = renderHook(() => useFolderTree(loader));
    await waitFor(() => expect(result.current.nodes['']?.status).toBe('loaded'));

    act(() => result.current.toggle('app'));
    await waitFor(() => expect(result.current.nodes['app']?.status).toBe('error'));

    act(() => result.current.toggle('app'));
    act(() => result.current.toggle('app'));
    await waitFor(() => expect(result.current.nodes['app']?.status).toBe('loaded'));
    expect(result.current.nodes['app'].children).toEqual(['src']);
  });

  it('reports a base-folder failure and allows retrying it', async () => {
    const loader = vi
      .fn<(path: string) => Promise<string[]>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(['app']);
    const { result } = renderHook(() => useFolderTree(loader));
    await waitFor(() => expect(result.current.nodes['']?.status).toBe('error'));

    act(() => result.current.retry(''));

    await waitFor(() => expect(result.current.nodes['']?.status).toBe('loaded'));
    expect(result.current.nodes[''].children).toEqual(['app']);
  });

  it('resets and reloads when the loader changes (machine switch)', async () => {
    const first = makeLoader({ '': ['one'], one: ['sub'] });
    const second = makeLoader({ '': ['two'] });
    const { result, rerender } = renderHook(({ loader }) => useFolderTree(loader), {
      initialProps: { loader: first },
    });
    await waitFor(() => expect(result.current.nodes['']?.children).toEqual(['one']));

    // Expand a folder so there is real expansion state to clear.
    act(() => result.current.toggle('one'));
    await waitFor(() => expect(result.current.nodes['one']?.status).toBe('loaded'));
    expect(result.current.expanded.has('one')).toBe(true);

    rerender({ loader: second });

    await waitFor(() => expect(result.current.nodes['']?.children).toEqual(['two']));
    expect(result.current.expanded.size).toBe(0);
    expect(result.current.nodes['one']).toBeUndefined();
  });
});
