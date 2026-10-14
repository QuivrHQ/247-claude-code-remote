import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { FolderTree } from '@/components/layout/FolderTree';

function stubFolders(tree: Record<string, string[] | number>) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input);
    const path = url.searchParams.get('path') ?? '';
    const entry = tree[path];
    if (typeof entry === 'number') return { ok: false, status: entry, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => entry ?? [] };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FolderTree', () => {
  it('lists the top-level folders', async () => {
    stubFolders({ '': ['app', 'lib'] });

    render(<FolderTree agentUrl="localhost:4678" />);

    expect(await screen.findByText('app')).toBeTruthy();
    expect(screen.getByText('lib')).toBeTruthy();
  });

  it('shows subfolders after expanding a folder', async () => {
    const fetchMock = stubFolders({ '': ['app'], app: ['src', 'docs'] });
    render(<FolderTree agentUrl="localhost:4678" />);
    await screen.findByText('app');

    fireEvent.click(screen.getByRole('button', { name: 'Expand app' }));

    expect(await screen.findByText('src')).toBeTruthy();
    expect(screen.getByText('docs')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4678/api/folders?path=app');
    expect(screen.getByRole('button', { name: 'Collapse app' })).toBeTruthy();
    // Collapsing hides the children again.
    fireEvent.click(screen.getByRole('button', { name: 'Collapse app' }));
    expect(screen.queryByText('src')).toBeNull();
  });

  it('supports several levels of nesting', async () => {
    stubFolders({ '': ['app'], app: ['src'], 'app/src': ['components'] });
    render(<FolderTree agentUrl="localhost:4678" />);
    await screen.findByText('app');

    fireEvent.click(screen.getByRole('button', { name: 'Expand app' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Expand app/src' }));

    expect(await screen.findByText('components')).toBeTruthy();
  });

  it('reports the selected folder path', async () => {
    stubFolders({ '': ['app'], app: ['src'] });
    const onSelectFolder = vi.fn();
    render(<FolderTree agentUrl="localhost:4678" onSelectFolder={onSelectFolder} />);
    await screen.findByText('app');
    fireEvent.click(screen.getByRole('button', { name: 'Expand app' }));
    await screen.findByText('src');

    fireEvent.click(screen.getByText('src'));

    expect(onSelectFolder).toHaveBeenCalledWith('app/src');
  });

  it('starts a session in the chosen folder', async () => {
    stubFolders({ '': ['app'] });
    const onStartSession = vi.fn();
    render(<FolderTree agentUrl="localhost:4678" onStartSession={onStartSession} />);
    await screen.findByText('app');

    fireEvent.click(screen.getByRole('button', { name: 'New session in app' }));

    expect(onStartSession).toHaveBeenCalledWith('app');
  });

  it('shows the number of sessions under a folder', async () => {
    stubFolders({ '': ['app'] });
    render(
      <FolderTree
        agentUrl="localhost:4678"
        sessionCounts={{ app: 1, 'app/api': 2, other: 9 }}
      />
    );

    expect(await screen.findByText('3')).toBeTruthy();
  });

  it('marks the selected folder', async () => {
    stubFolders({ '': ['app', 'lib'] });
    render(<FolderTree agentUrl="localhost:4678" selectedPath="lib" />);
    await screen.findByText('lib');

    const items = screen.getAllByRole('treeitem');
    expect(items.map((item) => item.getAttribute('aria-selected'))).toEqual(['false', 'true']);
  });

  it('offers a retry when the folders cannot be loaded', async () => {
    const fetchMock = stubFolders({ '': 500 });
    render(<FolderTree agentUrl="localhost:4678" />);

    const retry = await screen.findByRole('button', { name: /retry/i });
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ['app'],
    }));
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText('app')).toBeTruthy());
  });

  it('shows an empty state when there are no folders', async () => {
    stubFolders({ '': [] });

    render(<FolderTree agentUrl="localhost:4678" />);

    expect(await screen.findByText(/no folders/i)).toBeTruthy();
  });
});
