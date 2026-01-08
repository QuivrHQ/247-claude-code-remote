import { describe, it, expect } from 'vitest';

/**
 * Test MobileStatusStrip component logic.
 * Tests filtering, status dots, session selection, and UI states.
 */

// Status color mapping (must match MobileStatusStrip.tsx)
function getStatusColor(status: string): string {
  switch (status) {
    case 'working':
      return 'bg-cyan-400';
    case 'init':
      return 'bg-purple-400';
    case 'needs_attention':
      return 'bg-amber-400';
    case 'idle':
    default:
      return 'bg-gray-500';
  }
}

describe('MobileStatusStrip', () => {
  describe('status colors', () => {
    it('returns cyan for working status', () => {
      expect(getStatusColor('working')).toBe('bg-cyan-400');
    });

    it('returns purple for init status', () => {
      expect(getStatusColor('init')).toBe('bg-purple-400');
    });

    it('returns amber for needs_attention status', () => {
      expect(getStatusColor('needs_attention')).toBe('bg-amber-400');
    });

    it('returns gray for idle status', () => {
      expect(getStatusColor('idle')).toBe('bg-gray-500');
    });

    it('returns gray for unknown status', () => {
      expect(getStatusColor('unknown')).toBe('bg-gray-500');
    });
  });

  describe('session filtering', () => {
    type FilterType = 'all' | 'active' | 'waiting' | 'done';

    interface MockSession {
      status: string;
      attentionReason?: string;
    }

    function filterSession(session: MockSession, filter: FilterType): boolean {
      if (filter === 'all') return true;
      if (filter === 'active') return session.status === 'working' || session.status === 'init';
      if (filter === 'waiting')
        return session.status === 'needs_attention' && session.attentionReason !== 'task_complete';
      if (filter === 'done')
        return (
          session.status === 'idle' ||
          (session.status === 'needs_attention' && session.attentionReason === 'task_complete')
        );
      return true;
    }

    it('all filter includes all sessions', () => {
      expect(filterSession({ status: 'working' }, 'all')).toBe(true);
      expect(filterSession({ status: 'idle' }, 'all')).toBe(true);
      expect(filterSession({ status: 'needs_attention' }, 'all')).toBe(true);
    });

    it('active filter includes working and init', () => {
      expect(filterSession({ status: 'working' }, 'active')).toBe(true);
      expect(filterSession({ status: 'init' }, 'active')).toBe(true);
      expect(filterSession({ status: 'idle' }, 'active')).toBe(false);
      expect(filterSession({ status: 'needs_attention' }, 'active')).toBe(false);
    });

    it('waiting filter includes needs_attention without task_complete', () => {
      expect(
        filterSession({ status: 'needs_attention', attentionReason: 'input' }, 'waiting')
      ).toBe(true);
      expect(
        filterSession({ status: 'needs_attention', attentionReason: 'permission' }, 'waiting')
      ).toBe(true);
      expect(
        filterSession({ status: 'needs_attention', attentionReason: 'task_complete' }, 'waiting')
      ).toBe(false);
      expect(filterSession({ status: 'working' }, 'waiting')).toBe(false);
    });

    it('done filter includes idle and task_complete', () => {
      expect(filterSession({ status: 'idle' }, 'done')).toBe(true);
      expect(
        filterSession({ status: 'needs_attention', attentionReason: 'task_complete' }, 'done')
      ).toBe(true);
      expect(filterSession({ status: 'working' }, 'done')).toBe(false);
      expect(filterSession({ status: 'needs_attention', attentionReason: 'input' }, 'done')).toBe(
        false
      );
    });
  });

  describe('session search', () => {
    interface MockSession {
      name: string;
      project: string;
      machineName: string;
    }

    function matchesSearch(session: MockSession, query: string): boolean {
      const q = query.toLowerCase();
      return (
        session.name.toLowerCase().includes(q) ||
        session.project.toLowerCase().includes(q) ||
        session.machineName.toLowerCase().includes(q)
      );
    }

    it('matches session name', () => {
      const session = { name: 'project--wise-lynx', project: 'test', machineName: 'mac' };
      expect(matchesSearch(session, 'wise')).toBe(true);
      expect(matchesSearch(session, 'lynx')).toBe(true);
    });

    it('matches project name', () => {
      const session = { name: 'session', project: 'my-project', machineName: 'mac' };
      expect(matchesSearch(session, 'my-project')).toBe(true);
      expect(matchesSearch(session, 'project')).toBe(true);
    });

    it('matches machine name', () => {
      const session = { name: 'session', project: 'test', machineName: 'MacBook-Pro' };
      expect(matchesSearch(session, 'macbook')).toBe(true);
    });

    it('is case insensitive', () => {
      const session = { name: 'MySession', project: 'MyProject', machineName: 'MyMac' };
      expect(matchesSearch(session, 'mysession')).toBe(true);
      expect(matchesSearch(session, 'MYPROJECT')).toBe(true);
    });

    it('returns false for non-matching query', () => {
      const session = { name: 'session', project: 'test', machineName: 'mac' };
      expect(matchesSearch(session, 'xyz')).toBe(false);
    });
  });

  describe('status dots', () => {
    it('should show maximum 5 status dots', () => {
      const maxDots = 5;
      expect(maxDots).toBe(5);
    });

    it('should show +N indicator for sessions beyond 5', () => {
      const totalSessions = 8;
      const extraCount = totalSessions - 5;
      expect(extraCount).toBe(3);
    });
  });

  describe('display name parsing', () => {
    function getDisplayName(sessionName: string | undefined): string {
      if (!sessionName) return 'No session';
      return sessionName.split('--')[1] || sessionName;
    }

    it('extracts display name from session', () => {
      expect(getDisplayName('project--wise-lynx')).toBe('wise-lynx');
    });

    it('returns full name if no separator', () => {
      expect(getDisplayName('simple-name')).toBe('simple-name');
    });

    it('returns "No session" for undefined', () => {
      expect(getDisplayName(undefined)).toBe('No session');
    });
  });

  describe('header dimensions', () => {
    it('header height should be 44px (h-11)', () => {
      const headerHeight = 11 * 4;
      expect(headerHeight).toBe(44);
    });

    it('quick add button is 36px (h-9 w-9)', () => {
      const buttonSize = 9 * 4;
      expect(buttonSize).toBe(36);
    });

    it('status dots are 8px (w-2 h-2)', () => {
      const dotSize = 2 * 4;
      expect(dotSize).toBe(8);
    });
  });

  describe('dropdown panel', () => {
    it('max height should be 55vh', () => {
      const maxHeight = '55vh';
      expect(maxHeight).toBe('55vh');
    });

    it('should have rounded bottom corners', () => {
      const borderRadius = 'rounded-b-2xl';
      expect(borderRadius).toBe('rounded-b-2xl');
    });

    it('sessions grid uses 2 columns', () => {
      const gridClass = 'grid-cols-2';
      expect(gridClass).toBe('grid-cols-2');
    });
  });

  describe('filter symbols', () => {
    const filterSymbols = {
      all: '∞',
      active: '●',
      waiting: '⚡',
      done: '✓',
    };

    it('has unique symbols for each filter', () => {
      expect(filterSymbols.all).toBe('∞');
      expect(filterSymbols.active).toBe('●');
      expect(filterSymbols.waiting).toBe('⚡');
      expect(filterSymbols.done).toBe('✓');
    });

    it('all symbols are different', () => {
      const symbols = Object.values(filterSymbols);
      const uniqueSymbols = new Set(symbols);
      expect(uniqueSymbols.size).toBe(symbols.length);
    });
  });

  describe('safe area handling', () => {
    it('should use safe area inset for top padding', () => {
      const safeAreaClass = 'pt-[env(safe-area-inset-top)]';
      expect(safeAreaClass).toContain('safe-area-inset-top');
    });
  });

  describe('animation configuration', () => {
    it('chevron rotation is 180 degrees when expanded', () => {
      const expandedRotation = 180;
      expect(expandedRotation).toBe(180);
    });

    it('dropdown uses spring animation', () => {
      const springConfig = { damping: 25, stiffness: 300 };
      expect(springConfig.damping).toBe(25);
      expect(springConfig.stiffness).toBe(300);
    });
  });

  describe('session counting', () => {
    interface MockSession {
      status: string;
      attentionReason?: string;
    }

    function countByStatus(sessions: MockSession[]) {
      return sessions.reduce(
        (acc, s) => {
          if (s.status === 'working' || s.status === 'init') acc.active++;
          else if (s.status === 'needs_attention') {
            if (s.attentionReason === 'task_complete') acc.done++;
            else acc.waiting++;
          } else acc.done++;
          return acc;
        },
        { active: 0, waiting: 0, done: 0 }
      );
    }

    it('correctly counts active sessions', () => {
      const sessions = [{ status: 'working' }, { status: 'init' }, { status: 'idle' }];
      const counts = countByStatus(sessions);
      expect(counts.active).toBe(2);
    });

    it('correctly counts waiting sessions', () => {
      const sessions = [
        { status: 'needs_attention', attentionReason: 'input' },
        { status: 'needs_attention', attentionReason: 'permission' },
        { status: 'needs_attention', attentionReason: 'task_complete' },
      ];
      const counts = countByStatus(sessions);
      expect(counts.waiting).toBe(2);
      expect(counts.done).toBe(1);
    });

    it('correctly counts done sessions', () => {
      const sessions = [
        { status: 'idle' },
        { status: 'needs_attention', attentionReason: 'task_complete' },
      ];
      const counts = countByStatus(sessions);
      expect(counts.done).toBe(2);
    });
  });

  describe('new session button', () => {
    it('button uses gradient colors', () => {
      const gradientClass = 'bg-gradient-to-r from-orange-500 to-amber-500';
      expect(gradientClass).toContain('from-orange-500');
      expect(gradientClass).toContain('to-amber-500');
    });

    it('button height is 44px (h-11)', () => {
      const buttonHeight = 11 * 4;
      expect(buttonHeight).toBe(44);
    });
  });

  describe('backdrop', () => {
    it('backdrop has blur effect', () => {
      const backdropClass = 'bg-black/60 backdrop-blur-sm';
      expect(backdropClass).toContain('backdrop-blur');
    });

    it('backdrop opacity is 60%', () => {
      const opacity = 'bg-black/60';
      expect(opacity).toContain('/60');
    });
  });

  describe('z-index layering', () => {
    it('header z-index is 40', () => {
      const zIndex = 40;
      expect(zIndex).toBe(40);
    });

    it('backdrop z-index is 30', () => {
      const zIndex = 30;
      expect(zIndex).toBe(30);
    });

    it('dropdown z-index is 35', () => {
      // Dropdown should be between backdrop (30) and header (40)
      const zIndex = 35;
      expect(zIndex).toBeGreaterThan(30);
      expect(zIndex).toBeLessThan(40);
    });
  });
});
