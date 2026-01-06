import { describe, it, expect } from 'vitest';
import type { SessionInfo } from '@/lib/notifications';
import type { SessionStatus, AttentionReason } from '@claude-remote/shared';

// Simplified sorting logic - just createdAt (oldest first)
const sortSessions = (sessions: SessionInfo[]): SessionInfo[] => {
  return [...sessions].sort((a, b) => a.createdAt - b.createdAt);
};

// Extract the filter logic from SessionSidebar for testing
type FilterType = 'all' | 'active' | 'waiting' | 'done';

const filterSessions = (sessions: SessionInfo[], filter: FilterType): SessionInfo[] => {
  if (filter === 'all') return sessions;
  return sessions.filter((s) => {
    if (filter === 'active') return s.status === 'working';
    if (filter === 'waiting')
      return s.status === 'needs_attention' && s.attentionReason !== 'task_complete';
    if (filter === 'done')
      return s.status === 'idle' ||
        (s.status === 'needs_attention' && s.attentionReason === 'task_complete');
    return true;
  });
};

// Extract counting logic
const countByStatus = (sessions: SessionInfo[]): { active: number; waiting: number; done: number } => {
  return sessions.reduce(
    (acc, s) => {
      if (s.status === 'working') acc.active++;
      else if (s.status === 'needs_attention') {
        if (s.attentionReason === 'task_complete') acc.done++;
        else acc.waiting++;
      } else acc.done++;
      return acc;
    },
    { active: 0, waiting: 0, done: 0 }
  );
};

// Helper to create test sessions
const createSession = (
  name: string,
  status: SessionStatus,
  createdAt: number,
  attentionReason?: AttentionReason,
  lastStatusChange?: number
): SessionInfo => ({
  name,
  project: 'test-project',
  status,
  createdAt,
  attentionReason,
  lastStatusChange,
});

describe('Session Sorting', () => {
  describe('sortSessions - chronological order only', () => {
    it('sorts by createdAt (oldest first)', () => {
      const sessions = [
        createSession('c', 'working', 3000),
        createSession('a', 'idle', 1000),
        createSession('b', 'needs_attention', 2000, 'permission'),
      ];

      const sorted = sortSessions(sessions);
      expect(sorted[0].name).toBe('a'); // createdAt: 1000
      expect(sorted[1].name).toBe('b'); // createdAt: 2000
      expect(sorted[2].name).toBe('c'); // createdAt: 3000
    });

    it('ignores status when sorting', () => {
      const sessions = [
        createSession('idle', 'idle', 1000),
        createSession('working', 'working', 2000),
        createSession('waiting', 'needs_attention', 3000, 'permission'),
      ];

      const sorted = sortSessions(sessions);
      // Should be in createdAt order, not status order
      expect(sorted[0].name).toBe('idle');
      expect(sorted[1].name).toBe('working');
      expect(sorted[2].name).toBe('waiting');
    });

    it('ignores lastStatusChange when sorting', () => {
      const sessions = [
        createSession('old-created-recent-change', 'working', 1000, undefined, 9999),
        createSession('new-created-old-change', 'working', 2000, undefined, 100),
      ];

      const sorted = sortSessions(sessions);
      // Should sort by createdAt, not lastStatusChange
      expect(sorted[0].name).toBe('old-created-recent-change');
      expect(sorted[1].name).toBe('new-created-old-change');
    });

    it('handles empty array', () => {
      const sorted = sortSessions([]);
      expect(sorted).toEqual([]);
    });

    it('handles single session', () => {
      const sessions = [createSession('only', 'working', 1000)];
      const sorted = sortSessions(sessions);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].name).toBe('only');
    });

    it('maintains stable order for identical createdAt', () => {
      const sessions = [
        createSession('a', 'working', 1000),
        createSession('b', 'working', 1000),
        createSession('c', 'working', 1000),
      ];

      const sorted1 = sortSessions(sessions);
      const sorted2 = sortSessions(sessions);

      expect(sorted1.map((s) => s.name)).toEqual(sorted2.map((s) => s.name));
    });
  });
});

describe('Session Filtering', () => {
  const sessions = [
    createSession('waiting1', 'needs_attention', 1000, 'permission'),
    createSession('waiting2', 'needs_attention', 2000, 'input'),
    createSession('working1', 'working', 3000),
    createSession('working2', 'working', 4000),
    createSession('done1', 'needs_attention', 5000, 'task_complete'),
    createSession('idle1', 'idle', 6000),
  ];

  describe('filter: all', () => {
    it('returns all sessions', () => {
      const filtered = filterSessions(sessions, 'all');
      expect(filtered).toHaveLength(6);
    });
  });

  describe('filter: active', () => {
    it('returns only working sessions', () => {
      const filtered = filterSessions(sessions, 'active');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((s) => s.status === 'working')).toBe(true);
    });
  });

  describe('filter: waiting', () => {
    it('returns needs_attention sessions except task_complete', () => {
      const filtered = filterSessions(sessions, 'waiting');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((s) => s.status === 'needs_attention')).toBe(true);
      expect(filtered.every((s) => s.attentionReason !== 'task_complete')).toBe(true);
    });

    it('excludes task_complete from waiting', () => {
      const filtered = filterSessions(sessions, 'waiting');
      expect(filtered.find((s) => s.name === 'done1')).toBeUndefined();
    });
  });

  describe('filter: done', () => {
    it('returns idle sessions', () => {
      const filtered = filterSessions(sessions, 'done');
      expect(filtered.find((s) => s.name === 'idle1')).toBeDefined();
    });

    it('returns task_complete sessions', () => {
      const filtered = filterSessions(sessions, 'done');
      expect(filtered.find((s) => s.name === 'done1')).toBeDefined();
    });

    it('returns both idle and task_complete', () => {
      const filtered = filterSessions(sessions, 'done');
      expect(filtered).toHaveLength(2);
    });

    it('excludes working sessions', () => {
      const filtered = filterSessions(sessions, 'done');
      expect(filtered.find((s) => s.status === 'working')).toBeUndefined();
    });

    it('excludes non-task_complete needs_attention sessions', () => {
      const filtered = filterSessions(sessions, 'done');
      expect(filtered.find((s) => s.name === 'waiting1')).toBeUndefined();
      expect(filtered.find((s) => s.name === 'waiting2')).toBeUndefined();
    });
  });
});

describe('Session Counting', () => {
  it('counts working sessions as active', () => {
    const sessions = [
      createSession('w1', 'working', 1000),
      createSession('w2', 'working', 2000),
    ];
    const counts = countByStatus(sessions);
    expect(counts.active).toBe(2);
    expect(counts.waiting).toBe(0);
    expect(counts.done).toBe(0);
  });

  it('counts needs_attention with permission/input/plan_approval as waiting', () => {
    const sessions = [
      createSession('s1', 'needs_attention', 1000, 'permission'),
      createSession('s2', 'needs_attention', 2000, 'input'),
      createSession('s3', 'needs_attention', 3000, 'plan_approval'),
    ];
    const counts = countByStatus(sessions);
    expect(counts.active).toBe(0);
    expect(counts.waiting).toBe(3);
    expect(counts.done).toBe(0);
  });

  it('counts needs_attention with task_complete as done', () => {
    const sessions = [
      createSession('s1', 'needs_attention', 1000, 'task_complete'),
    ];
    const counts = countByStatus(sessions);
    expect(counts.active).toBe(0);
    expect(counts.waiting).toBe(0);
    expect(counts.done).toBe(1);
  });

  it('counts idle as done', () => {
    const sessions = [
      createSession('s1', 'idle', 1000),
    ];
    const counts = countByStatus(sessions);
    expect(counts.done).toBe(1);
  });

  it('counts mixed statuses correctly', () => {
    const sessions = [
      createSession('w1', 'working', 1000),
      createSession('w2', 'working', 2000),
      createSession('wait1', 'needs_attention', 3000, 'permission'),
      createSession('wait2', 'needs_attention', 4000, 'input'),
      createSession('done1', 'needs_attention', 5000, 'task_complete'),
      createSession('idle1', 'idle', 6000),
      createSession('idle2', 'idle', 7000),
    ];
    const counts = countByStatus(sessions);
    expect(counts.active).toBe(2);
    expect(counts.waiting).toBe(2);
    expect(counts.done).toBe(3); // 1 task_complete + 2 idle
  });

  it('handles empty array', () => {
    const counts = countByStatus([]);
    expect(counts.active).toBe(0);
    expect(counts.waiting).toBe(0);
    expect(counts.done).toBe(0);
  });
});

describe('Sort Stability', () => {
  it('order never changes when lastStatusChange updates', () => {
    const sessionsBeforeChange = [
      createSession('a', 'working', 1000, undefined, 1000),
      createSession('b', 'working', 2000, undefined, 2000),
      createSession('c', 'working', 3000, undefined, 3000),
    ];

    // Simulate status change on session 'a' - lastStatusChange updates
    const sessionsAfterChange = [
      createSession('a', 'working', 1000, undefined, 9999),
      createSession('b', 'working', 2000, undefined, 2000),
      createSession('c', 'working', 3000, undefined, 3000),
    ];

    const sortedBefore = sortSessions(sessionsBeforeChange);
    const sortedAfter = sortSessions(sessionsAfterChange);

    expect(sortedBefore.map((s) => s.name)).toEqual(['a', 'b', 'c']);
    expect(sortedAfter.map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('order never changes when status changes', () => {
    const sessionsBefore = [
      createSession('a', 'working', 1000),
      createSession('b', 'working', 2000),
      createSession('c', 'working', 3000),
    ];

    // Session 'b' changes from working to needs_attention
    const sessionsAfter = [
      createSession('a', 'working', 1000),
      createSession('b', 'needs_attention', 2000, 'permission'),
      createSession('c', 'working', 3000),
    ];

    const sortedBefore = sortSessions(sessionsBefore);
    const sortedAfter = sortSessions(sessionsAfter);

    // Order should be identical - 'b' should NOT jump to the top
    expect(sortedBefore.map((s) => s.name)).toEqual(['a', 'b', 'c']);
    expect(sortedAfter.map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('produces identical results regardless of input order', () => {
    const sessions = [
      createSession('c', 'idle', 3000),
      createSession('a', 'working', 1000),
      createSession('b', 'needs_attention', 2000, 'permission'),
    ];

    const sorted1 = sortSessions(sessions);
    const sorted2 = sortSessions([...sessions].reverse());

    expect(sorted1.map((s) => s.name)).toEqual(['a', 'b', 'c']);
    expect(sorted2.map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });
});
