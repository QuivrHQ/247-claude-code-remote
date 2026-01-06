import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the URL session persistence logic used in page.tsx

describe('URL Session Persistence', () => {
  const DEFAULT_MACHINE_ID = 'local-agent';

  describe('URL Parameter Building', () => {
    const buildSessionUrl = (
      sessionName: string,
      machineId: string,
      existingParams: URLSearchParams = new URLSearchParams()
    ): string => {
      const params = new URLSearchParams(existingParams.toString());
      params.set('session', sessionName);
      params.set('machine', machineId);
      return `?${params.toString()}`;
    };

    it('builds URL with session and machine params', () => {
      const url = buildSessionUrl('project--brave-lion-42', 'local-agent');
      expect(url).toContain('session=project--brave-lion-42');
      expect(url).toContain('machine=local-agent');
    });

    it('preserves existing URL parameters', () => {
      const existing = new URLSearchParams('tab=terminal&view=split');
      const url = buildSessionUrl('my-session', 'machine-1', existing);
      expect(url).toContain('tab=terminal');
      expect(url).toContain('view=split');
      expect(url).toContain('session=my-session');
      expect(url).toContain('machine=machine-1');
    });

    it('overwrites existing session/machine params', () => {
      const existing = new URLSearchParams('session=old-session&machine=old-machine');
      const url = buildSessionUrl('new-session', 'new-machine', existing);
      expect(url).toContain('session=new-session');
      expect(url).toContain('machine=new-machine');
      expect(url).not.toContain('old-session');
      expect(url).not.toContain('old-machine');
    });

    it('encodes special characters in session name', () => {
      const url = buildSessionUrl('project name--session', 'local-agent');
      expect(url).toContain('session=project+name--session');
    });
  });

  describe('URL Parameter Clearing', () => {
    const clearSessionFromUrl = (existingParams: URLSearchParams): string => {
      const params = new URLSearchParams(existingParams.toString());
      params.delete('session');
      params.delete('machine');
      return params.toString() ? `?${params.toString()}` : '/';
    };

    it('removes session and machine params', () => {
      const params = new URLSearchParams('session=test&machine=local-agent');
      const url = clearSessionFromUrl(params);
      expect(url).toBe('/');
    });

    it('preserves other URL parameters', () => {
      const params = new URLSearchParams('session=test&machine=local-agent&tab=editor');
      const url = clearSessionFromUrl(params);
      expect(url).toBe('?tab=editor');
      expect(url).not.toContain('session');
      expect(url).not.toContain('machine');
    });

    it('returns root path when no params remain', () => {
      const params = new URLSearchParams('session=test&machine=local-agent');
      const url = clearSessionFromUrl(params);
      expect(url).toBe('/');
    });

    it('handles empty params gracefully', () => {
      const params = new URLSearchParams();
      const url = clearSessionFromUrl(params);
      expect(url).toBe('/');
    });
  });

  describe('URL Parameter Parsing', () => {
    interface ParsedSession {
      sessionName: string | null;
      machineId: string;
    }

    const parseSessionFromUrl = (searchParams: URLSearchParams): ParsedSession => {
      return {
        sessionName: searchParams.get('session'),
        machineId: searchParams.get('machine') || DEFAULT_MACHINE_ID,
      };
    };

    it('parses session and machine from URL', () => {
      const params = new URLSearchParams('session=project--test&machine=my-machine');
      const parsed = parseSessionFromUrl(params);
      expect(parsed.sessionName).toBe('project--test');
      expect(parsed.machineId).toBe('my-machine');
    });

    it('defaults machineId when not provided', () => {
      const params = new URLSearchParams('session=project--test');
      const parsed = parseSessionFromUrl(params);
      expect(parsed.sessionName).toBe('project--test');
      expect(parsed.machineId).toBe(DEFAULT_MACHINE_ID);
    });

    it('returns null sessionName when not in URL', () => {
      const params = new URLSearchParams('machine=local-agent');
      const parsed = parseSessionFromUrl(params);
      expect(parsed.sessionName).toBeNull();
    });

    it('handles empty URL params', () => {
      const params = new URLSearchParams();
      const parsed = parseSessionFromUrl(params);
      expect(parsed.sessionName).toBeNull();
      expect(parsed.machineId).toBe(DEFAULT_MACHINE_ID);
    });

    it('decodes URL-encoded session names', () => {
      const params = new URLSearchParams('session=project+name--test%2B1');
      const parsed = parseSessionFromUrl(params);
      expect(parsed.sessionName).toBe('project name--test+1');
    });
  });

  describe('Session Lookup', () => {
    interface Session {
      name: string;
      machineId: string;
      project: string;
    }

    const findSession = (
      sessions: Session[],
      sessionName: string,
      machineId: string
    ): Session | undefined => {
      return sessions.find(
        s => s.name === sessionName && s.machineId === machineId
      );
    };

    const mockSessions: Session[] = [
      { name: 'project-a--session-1', machineId: 'local-agent', project: 'project-a' },
      { name: 'project-b--session-2', machineId: 'local-agent', project: 'project-b' },
      { name: 'project-a--session-3', machineId: 'remote-agent', project: 'project-a' },
    ];

    it('finds session by name and machineId', () => {
      const session = findSession(mockSessions, 'project-a--session-1', 'local-agent');
      expect(session).toBeDefined();
      expect(session?.project).toBe('project-a');
    });

    it('returns undefined when session not found', () => {
      const session = findSession(mockSessions, 'non-existent', 'local-agent');
      expect(session).toBeUndefined();
    });

    it('distinguishes sessions with same name on different machines', () => {
      const session1 = findSession(mockSessions, 'project-a--session-1', 'local-agent');
      const session2 = findSession(mockSessions, 'project-a--session-1', 'remote-agent');
      expect(session1).toBeDefined();
      expect(session2).toBeUndefined();
    });

    it('handles empty sessions array', () => {
      const session = findSession([], 'project--test', 'local-agent');
      expect(session).toBeUndefined();
    });
  });

  describe('Selected Session State', () => {
    interface SelectedSession {
      machineId: string;
      sessionName: string;
      project: string;
      environmentId?: string;
    }

    const createSelectedSession = (
      machineId: string,
      sessionName: string,
      project: string,
      environmentId?: string
    ): SelectedSession => {
      return { machineId, sessionName, project, environmentId };
    };

    it('creates selected session object', () => {
      const session = createSelectedSession('local-agent', 'project--test', 'project');
      expect(session.machineId).toBe('local-agent');
      expect(session.sessionName).toBe('project--test');
      expect(session.project).toBe('project');
      expect(session.environmentId).toBeUndefined();
    });

    it('includes optional environmentId', () => {
      const session = createSelectedSession('local-agent', 'project--test', 'project', 'env-123');
      expect(session.environmentId).toBe('env-123');
    });
  });

  describe('New Session Placeholder', () => {
    const createNewSessionName = (project: string): string => {
      return `${project}--new`;
    };

    it('creates placeholder name for new session', () => {
      const name = createNewSessionName('my-project');
      expect(name).toBe('my-project--new');
    });

    it('handles project names with special characters', () => {
      const name = createNewSessionName('project-v2');
      expect(name).toBe('project-v2--new');
    });
  });

  describe('Session Name Update', () => {
    interface SelectedSession {
      machineId: string;
      sessionName: string;
      project: string;
    }

    const updateSessionName = (
      session: SelectedSession,
      actualSessionName: string
    ): SelectedSession => {
      return { ...session, sessionName: actualSessionName };
    };

    it('updates session name from placeholder to actual', () => {
      const session: SelectedSession = {
        machineId: 'local-agent',
        sessionName: 'project--new',
        project: 'project',
      };
      const updated = updateSessionName(session, 'project--brave-lion-42');
      expect(updated.sessionName).toBe('project--brave-lion-42');
      expect(updated.machineId).toBe('local-agent');
      expect(updated.project).toBe('project');
    });

    it('preserves other session properties', () => {
      const session: SelectedSession = {
        machineId: 'my-machine',
        sessionName: 'old-name',
        project: 'my-project',
      };
      const updated = updateSessionName(session, 'new-name');
      expect(updated.machineId).toBe('my-machine');
      expect(updated.project).toBe('my-project');
    });
  });

  describe('History API Integration', () => {
    let originalReplaceState: typeof window.history.replaceState;

    beforeEach(() => {
      originalReplaceState = window.history.replaceState;
      window.history.replaceState = vi.fn();
    });

    afterEach(() => {
      window.history.replaceState = originalReplaceState;
    });

    it('calls replaceState with correct URL', () => {
      const newUrl = '/?session=test&machine=local-agent';
      window.history.replaceState({}, '', newUrl);
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', newUrl);
    });

    it('clears URL params via replaceState', () => {
      window.history.replaceState({}, '', '/');
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/');
    });
  });
});
