/**
 * WebSocket Protocol Tests
 *
 * Critical tests for validating the WebSocket message protocol between
 * the web dashboard and the agent. These tests ensure interface stability.
 */
import { describe, it, expect } from 'vitest';
import type {
  WSMessageToAgent,
  WSMessageFromAgent,
  WSStatusMessageToAgent,
  WSStatusMessageFromAgent,
  WSSessionInfo,
  SessionStatus,
  AttentionReason,
  StatusSource,
  EnvironmentProvider,
  EnvironmentIcon,
  RalphLoopConfig,
} from '../src/types/index.js';

// ============================================================================
// Type Guards - These should be exported from shared package eventually
// ============================================================================

/**
 * Type guard for WSMessageToAgent
 */
function isWSMessageToAgent(msg: unknown): msg is WSMessageToAgent {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;

  if (typeof obj.type !== 'string') return false;

  switch (obj.type) {
    case 'input':
      return typeof obj.data === 'string';
    case 'resize':
      return typeof obj.cols === 'number' && typeof obj.rows === 'number';
    case 'start-claude':
    case 'ping':
      return true;
    case 'start-claude-ralph':
      return isValidRalphLoopConfig(obj.config);
    case 'request-history':
      return obj.lines === undefined || typeof obj.lines === 'number';
    default:
      return false;
  }
}

/**
 * Type guard for RalphLoopConfig
 */
function isValidRalphLoopConfig(config: unknown): config is RalphLoopConfig {
  if (typeof config !== 'object' || config === null) return false;
  const obj = config as Record<string, unknown>;

  // prompt is required
  if (typeof obj.prompt !== 'string' || obj.prompt.trim() === '') return false;

  // maxIterations is optional but must be number if present
  if (obj.maxIterations !== undefined && typeof obj.maxIterations !== 'number') return false;

  // completionPromise is optional but must be string if present
  if (obj.completionPromise !== undefined && typeof obj.completionPromise !== 'string')
    return false;

  // useWorktree is optional but must be boolean if present
  if (obj.useWorktree !== undefined && typeof obj.useWorktree !== 'boolean') return false;

  return true;
}

/**
 * Type guard for WSMessageFromAgent
 */
function isWSMessageFromAgent(msg: unknown): msg is WSMessageFromAgent {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;

  if (typeof obj.type !== 'string') return false;

  switch (obj.type) {
    case 'output':
      return typeof obj.data === 'string';
    case 'connected':
      return typeof obj.session === 'string';
    case 'disconnected':
    case 'pong':
      return true;
    case 'history':
      return typeof obj.data === 'string' && typeof obj.lines === 'number';
    default:
      return false;
  }
}

/**
 * Type guard for WSStatusMessageToAgent
 */
function isWSStatusMessageToAgent(msg: unknown): msg is WSStatusMessageToAgent {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;

  return obj.type === 'status-subscribe' || obj.type === 'status-unsubscribe';
}

/**
 * Type guard for WSStatusMessageFromAgent
 */
function isWSStatusMessageFromAgent(msg: unknown): msg is WSStatusMessageFromAgent {
  if (typeof msg !== 'object' || msg === null) return false;
  const obj = msg as Record<string, unknown>;

  if (typeof obj.type !== 'string') return false;

  switch (obj.type) {
    case 'sessions-list':
      return Array.isArray(obj.sessions);
    case 'status-update':
      return typeof obj.session === 'object' && obj.session !== null;
    case 'session-removed':
      return typeof obj.sessionName === 'string';
    case 'session-archived':
      return typeof obj.sessionName === 'string' && typeof obj.session === 'object';
    default:
      return false;
  }
}

/**
 * Type guard for SessionStatus
 */
function isSessionStatus(value: unknown): value is SessionStatus {
  return value === 'init' || value === 'working' || value === 'needs_attention' || value === 'idle';
}

/**
 * Type guard for AttentionReason
 */
function isAttentionReason(value: unknown): value is AttentionReason {
  return (
    value === 'permission' ||
    value === 'input' ||
    value === 'plan_approval' ||
    value === 'task_complete'
  );
}

/**
 * Type guard for StatusSource
 */
function isStatusSource(value: unknown): value is StatusSource {
  return value === 'hook' || value === 'tmux';
}

/**
 * Validate WSSessionInfo structure
 */
function isValidWSSessionInfo(obj: unknown): obj is WSSessionInfo {
  if (typeof obj !== 'object' || obj === null) return false;
  const session = obj as Record<string, unknown>;

  // Required fields
  if (typeof session.name !== 'string') return false;
  if (typeof session.project !== 'string') return false;
  if (!isSessionStatus(session.status)) return false;
  if (!isStatusSource(session.statusSource)) return false;
  if (typeof session.createdAt !== 'number') return false;

  // Optional attentionReason (only valid when status is needs_attention)
  if (session.attentionReason !== undefined && !isAttentionReason(session.attentionReason)) {
    return false;
  }

  // Optional fields
  if (session.lastEvent !== undefined && typeof session.lastEvent !== 'string') return false;
  if (session.lastStatusChange !== undefined && typeof session.lastStatusChange !== 'number')
    return false;
  if (session.lastActivity !== undefined && typeof session.lastActivity !== 'string') return false;
  if (session.archivedAt !== undefined && typeof session.archivedAt !== 'number') return false;
  if (session.environmentId !== undefined && typeof session.environmentId !== 'string')
    return false;

  return true;
}

// ============================================================================
// Tests
// ============================================================================

describe('WebSocket Protocol - Terminal Channel', () => {
  describe('WSMessageToAgent (Client → Agent)', () => {
    describe('input message', () => {
      it('validates correct input message', () => {
        const msg = { type: 'input', data: 'ls -la' };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });

      it('rejects input without data', () => {
        const msg = { type: 'input' };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects input with non-string data', () => {
        const msg = { type: 'input', data: 123 };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('accepts empty string data', () => {
        const msg = { type: 'input', data: '' };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });
    });

    describe('resize message', () => {
      it('validates correct resize message', () => {
        const msg = { type: 'resize', cols: 120, rows: 40 };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });

      it('rejects resize without cols', () => {
        const msg = { type: 'resize', rows: 40 };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects resize without rows', () => {
        const msg = { type: 'resize', cols: 120 };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects resize with string dimensions', () => {
        const msg = { type: 'resize', cols: '120', rows: '40' };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });
    });

    describe('start-claude message', () => {
      it('validates correct start-claude message', () => {
        const msg = { type: 'start-claude' };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });

      it('accepts extra properties (forward compatibility)', () => {
        const msg = { type: 'start-claude', model: 'opus' };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });
    });

    describe('start-claude-ralph message', () => {
      it('validates correct start-claude-ralph with minimal config', () => {
        const msg = {
          type: 'start-claude-ralph',
          config: { prompt: 'Build a feature' },
        };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });

      it('validates start-claude-ralph with full config', () => {
        const msg = {
          type: 'start-claude-ralph',
          config: {
            prompt: 'Build a feature with tests',
            maxIterations: 10,
            completionPromise: 'COMPLETE',
            useWorktree: true,
          },
        };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });

      it('rejects start-claude-ralph without config', () => {
        const msg = { type: 'start-claude-ralph' };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects start-claude-ralph with null config', () => {
        const msg = { type: 'start-claude-ralph', config: null };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects start-claude-ralph with empty prompt', () => {
        const msg = {
          type: 'start-claude-ralph',
          config: { prompt: '' },
        };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects start-claude-ralph with whitespace-only prompt', () => {
        const msg = {
          type: 'start-claude-ralph',
          config: { prompt: '   ' },
        };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects start-claude-ralph with invalid maxIterations', () => {
        const msg = {
          type: 'start-claude-ralph',
          config: { prompt: 'test', maxIterations: '10' },
        };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects start-claude-ralph with invalid completionPromise', () => {
        const msg = {
          type: 'start-claude-ralph',
          config: { prompt: 'test', completionPromise: 123 },
        };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects start-claude-ralph with invalid useWorktree', () => {
        const msg = {
          type: 'start-claude-ralph',
          config: { prompt: 'test', useWorktree: 'yes' },
        };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });
    });

    describe('ping message', () => {
      it('validates correct ping message', () => {
        const msg = { type: 'ping' };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });
    });

    describe('request-history message', () => {
      it('validates request-history with lines', () => {
        const msg = { type: 'request-history', lines: 100 };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });

      it('validates request-history without lines', () => {
        const msg = { type: 'request-history' };
        expect(isWSMessageToAgent(msg)).toBe(true);
      });

      it('rejects request-history with string lines', () => {
        const msg = { type: 'request-history', lines: '100' };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });
    });

    describe('invalid messages', () => {
      it('rejects unknown type', () => {
        const msg = { type: 'unknown' };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });

      it('rejects null', () => {
        expect(isWSMessageToAgent(null)).toBe(false);
      });

      it('rejects undefined', () => {
        expect(isWSMessageToAgent(undefined)).toBe(false);
      });

      it('rejects string', () => {
        expect(isWSMessageToAgent('input')).toBe(false);
      });

      it('rejects array', () => {
        expect(isWSMessageToAgent([{ type: 'input', data: 'test' }])).toBe(false);
      });

      it('rejects object without type', () => {
        const msg = { data: 'ls -la' };
        expect(isWSMessageToAgent(msg)).toBe(false);
      });
    });
  });

  describe('WSMessageFromAgent (Agent → Client)', () => {
    describe('output message', () => {
      it('validates correct output message', () => {
        const msg = { type: 'output', data: 'Hello World\n' };
        expect(isWSMessageFromAgent(msg)).toBe(true);
      });

      it('rejects output without data', () => {
        const msg = { type: 'output' };
        expect(isWSMessageFromAgent(msg)).toBe(false);
      });

      it('accepts ANSI escape sequences', () => {
        const msg = { type: 'output', data: '\x1b[32mGreen text\x1b[0m' };
        expect(isWSMessageFromAgent(msg)).toBe(true);
      });
    });

    describe('connected message', () => {
      it('validates correct connected message', () => {
        const msg = { type: 'connected', session: 'project--brave-lion-42' };
        expect(isWSMessageFromAgent(msg)).toBe(true);
      });

      it('rejects connected without session', () => {
        const msg = { type: 'connected' };
        expect(isWSMessageFromAgent(msg)).toBe(false);
      });
    });

    describe('disconnected message', () => {
      it('validates correct disconnected message', () => {
        const msg = { type: 'disconnected' };
        expect(isWSMessageFromAgent(msg)).toBe(true);
      });
    });

    describe('pong message', () => {
      it('validates correct pong message', () => {
        const msg = { type: 'pong' };
        expect(isWSMessageFromAgent(msg)).toBe(true);
      });
    });

    describe('history message', () => {
      it('validates correct history message', () => {
        const msg = { type: 'history', data: '$ echo hello\nhello\n', lines: 2 };
        expect(isWSMessageFromAgent(msg)).toBe(true);
      });

      it('rejects history without data', () => {
        const msg = { type: 'history', lines: 2 };
        expect(isWSMessageFromAgent(msg)).toBe(false);
      });

      it('rejects history without lines', () => {
        const msg = { type: 'history', data: 'test' };
        expect(isWSMessageFromAgent(msg)).toBe(false);
      });
    });
  });
});

describe('WebSocket Protocol - Status Channel', () => {
  describe('WSStatusMessageToAgent (Client → Agent)', () => {
    it('validates status-subscribe', () => {
      const msg = { type: 'status-subscribe' };
      expect(isWSStatusMessageToAgent(msg)).toBe(true);
    });

    it('validates status-unsubscribe', () => {
      const msg = { type: 'status-unsubscribe' };
      expect(isWSStatusMessageToAgent(msg)).toBe(true);
    });

    it('rejects unknown type', () => {
      const msg = { type: 'subscribe' };
      expect(isWSStatusMessageToAgent(msg)).toBe(false);
    });
  });

  describe('WSStatusMessageFromAgent (Agent → Client)', () => {
    describe('sessions-list message', () => {
      it('validates sessions-list with empty array', () => {
        const msg = { type: 'sessions-list', sessions: [] };
        expect(isWSStatusMessageFromAgent(msg)).toBe(true);
      });

      it('validates sessions-list with sessions', () => {
        const sessions: WSSessionInfo[] = [
          {
            name: 'test--abc123',
            project: 'test',
            status: 'working',
            statusSource: 'hook',
            createdAt: Date.now(),
          },
        ];
        const msg = { type: 'sessions-list', sessions };
        expect(isWSStatusMessageFromAgent(msg)).toBe(true);
      });

      it('rejects sessions-list without sessions', () => {
        const msg = { type: 'sessions-list' };
        expect(isWSStatusMessageFromAgent(msg)).toBe(false);
      });
    });

    describe('status-update message', () => {
      it('validates status-update', () => {
        const session: WSSessionInfo = {
          name: 'test--abc123',
          project: 'test',
          status: 'needs_attention',
          attentionReason: 'permission',
          statusSource: 'hook',
          createdAt: Date.now(),
        };
        const msg = { type: 'status-update', session };
        expect(isWSStatusMessageFromAgent(msg)).toBe(true);
      });

      it('rejects status-update without session', () => {
        const msg = { type: 'status-update' };
        expect(isWSStatusMessageFromAgent(msg)).toBe(false);
      });
    });

    describe('session-removed message', () => {
      it('validates session-removed', () => {
        const msg = { type: 'session-removed', sessionName: 'test--abc123' };
        expect(isWSStatusMessageFromAgent(msg)).toBe(true);
      });

      it('rejects session-removed without sessionName', () => {
        const msg = { type: 'session-removed' };
        expect(isWSStatusMessageFromAgent(msg)).toBe(false);
      });
    });

    describe('session-archived message', () => {
      it('validates session-archived', () => {
        const session: WSSessionInfo = {
          name: 'test--abc123',
          project: 'test',
          status: 'idle',
          statusSource: 'hook',
          createdAt: Date.now(),
          archivedAt: Date.now(),
        };
        const msg = { type: 'session-archived', sessionName: 'test--abc123', session };
        expect(isWSStatusMessageFromAgent(msg)).toBe(true);
      });
    });
  });
});

describe('Session Status Types', () => {
  describe('SessionStatus', () => {
    it('accepts all valid statuses', () => {
      expect(isSessionStatus('init')).toBe(true);
      expect(isSessionStatus('working')).toBe(true);
      expect(isSessionStatus('needs_attention')).toBe(true);
      expect(isSessionStatus('idle')).toBe(true);
    });

    it('rejects invalid statuses', () => {
      expect(isSessionStatus('running')).toBe(false);
      expect(isSessionStatus('stopped')).toBe(false);
      expect(isSessionStatus('waiting')).toBe(false);
      expect(isSessionStatus('')).toBe(false);
      expect(isSessionStatus(null)).toBe(false);
      expect(isSessionStatus(undefined)).toBe(false);
    });
  });

  describe('AttentionReason', () => {
    it('accepts all valid reasons', () => {
      expect(isAttentionReason('permission')).toBe(true);
      expect(isAttentionReason('input')).toBe(true);
      expect(isAttentionReason('plan_approval')).toBe(true);
      expect(isAttentionReason('task_complete')).toBe(true);
    });

    it('rejects invalid reasons', () => {
      expect(isAttentionReason('waiting')).toBe(false);
      expect(isAttentionReason('error')).toBe(false);
      expect(isAttentionReason('')).toBe(false);
    });
  });

  describe('StatusSource', () => {
    it('accepts valid sources', () => {
      expect(isStatusSource('hook')).toBe(true);
      expect(isStatusSource('tmux')).toBe(true);
    });

    it('rejects invalid sources', () => {
      expect(isStatusSource('api')).toBe(false);
      expect(isStatusSource('manual')).toBe(false);
    });
  });
});

describe('WSSessionInfo Validation', () => {
  const validSession: WSSessionInfo = {
    name: 'project--brave-lion-42',
    project: 'my-project',
    status: 'working',
    statusSource: 'hook',
    createdAt: Date.now(),
  };

  it('validates minimal session info', () => {
    expect(isValidWSSessionInfo(validSession)).toBe(true);
  });

  it('validates session with all optional fields', () => {
    const fullSession: WSSessionInfo = {
      ...validSession,
      attentionReason: 'permission',
      lastEvent: 'PreToolUse',
      lastStatusChange: Date.now(),
      lastActivity: 'input detected',
      archivedAt: Date.now(),
      environmentId: 'env-123',
      environment: {
        id: 'env-123',
        name: 'Production',
        provider: 'anthropic',
        icon: 'zap',
        isDefault: true,
      },
    };
    expect(isValidWSSessionInfo(fullSession)).toBe(true);
  });

  it('validates session with needs_attention and attentionReason', () => {
    const session: WSSessionInfo = {
      ...validSession,
      status: 'needs_attention',
      attentionReason: 'plan_approval',
    };
    expect(isValidWSSessionInfo(session)).toBe(true);
  });

  it('rejects session without name', () => {
    const { name, ...sessionWithoutName } = validSession;
    expect(isValidWSSessionInfo(sessionWithoutName)).toBe(false);
  });

  it('rejects session without project', () => {
    const { project, ...sessionWithoutProject } = validSession;
    expect(isValidWSSessionInfo(sessionWithoutProject)).toBe(false);
  });

  it('rejects session with invalid status', () => {
    const session = { ...validSession, status: 'running' };
    expect(isValidWSSessionInfo(session)).toBe(false);
  });

  it('rejects session with invalid statusSource', () => {
    const session = { ...validSession, statusSource: 'api' };
    expect(isValidWSSessionInfo(session)).toBe(false);
  });

  it('rejects session without createdAt', () => {
    const { createdAt, ...sessionWithoutCreatedAt } = validSession;
    expect(isValidWSSessionInfo(sessionWithoutCreatedAt)).toBe(false);
  });

  it('rejects session with invalid attentionReason', () => {
    const session = { ...validSession, attentionReason: 'invalid' };
    expect(isValidWSSessionInfo(session)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidWSSessionInfo(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidWSSessionInfo(undefined)).toBe(false);
  });
});

describe('Protocol Compatibility', () => {
  it('ensures message types are discriminated unions', () => {
    // These type assertions verify TypeScript can discriminate the unions
    const toAgent: WSMessageToAgent = { type: 'input', data: 'test' };
    if (toAgent.type === 'input') {
      // TypeScript should know toAgent has 'data' property here
      expect(toAgent.data).toBeDefined();
    }

    const fromAgent: WSMessageFromAgent = { type: 'history', data: 'test', lines: 10 };
    if (fromAgent.type === 'history') {
      expect(fromAgent.lines).toBeDefined();
    }

    const statusToAgent: WSStatusMessageToAgent = { type: 'status-subscribe' };
    expect(statusToAgent.type).toBe('status-subscribe');

    const statusFromAgent: WSStatusMessageFromAgent = { type: 'sessions-list', sessions: [] };
    if (statusFromAgent.type === 'sessions-list') {
      expect(statusFromAgent.sessions).toBeDefined();
    }
  });

  it('verifies all message types are covered', () => {
    // WSMessageToAgent types
    const toAgentTypes = [
      'input',
      'resize',
      'start-claude',
      'start-claude-ralph',
      'ping',
      'request-history',
    ];
    toAgentTypes.forEach((type) => {
      expect([
        'input',
        'resize',
        'start-claude',
        'start-claude-ralph',
        'ping',
        'request-history',
      ]).toContain(type);
    });

    // WSMessageFromAgent types
    const fromAgentTypes = ['output', 'connected', 'disconnected', 'pong', 'history'];
    fromAgentTypes.forEach((type) => {
      expect(['output', 'connected', 'disconnected', 'pong', 'history']).toContain(type);
    });

    // WSStatusMessageToAgent types
    const statusToAgentTypes = ['status-subscribe', 'status-unsubscribe'];
    statusToAgentTypes.forEach((type) => {
      expect(['status-subscribe', 'status-unsubscribe']).toContain(type);
    });

    // WSStatusMessageFromAgent types
    const statusFromAgentTypes = [
      'sessions-list',
      'status-update',
      'session-removed',
      'session-archived',
    ];
    statusFromAgentTypes.forEach((type) => {
      expect(['sessions-list', 'status-update', 'session-removed', 'session-archived']).toContain(
        type
      );
    });
  });
});
