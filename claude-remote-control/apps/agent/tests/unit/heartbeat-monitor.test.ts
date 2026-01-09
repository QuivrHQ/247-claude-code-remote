/**
 * Heartbeat Monitor tests
 * Tests for timeout behavior - should transition to 'idle' not 'needs_attention'
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies before importing the module
vi.mock('../../src/routes/heartbeat.js', () => ({
  lastHeartbeat: new Map<string, number>(),
}));

vi.mock('../../src/status.js', () => ({
  tmuxSessionStatus: new Map(),
  broadcastStatusUpdate: vi.fn(),
}));

vi.mock('../../src/db/sessions.js', () => ({
  upsertSession: vi.fn().mockReturnValue({ created_at: Date.now() }),
  getSession: vi.fn().mockReturnValue({ created_at: Date.now() }),
}));

vi.mock('../../src/db/environments.js', () => ({
  getSessionEnvironment: vi.fn().mockReturnValue(null),
  getEnvironmentMetadata: vi.fn().mockReturnValue(null),
}));

describe('Heartbeat Monitor - Idle Transition', () => {
  let lastHeartbeat: Map<string, number>;
  let tmuxSessionStatus: Map<string, any>;
  let broadcastStatusUpdate: ReturnType<typeof vi.fn>;
  let upsertSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Get mocked modules
    const heartbeatModule = await import('../../src/routes/heartbeat.js');
    const statusModule = await import('../../src/status.js');
    const sessionsDbModule = await import('../../src/db/sessions.js');

    lastHeartbeat = heartbeatModule.lastHeartbeat;
    tmuxSessionStatus = statusModule.tmuxSessionStatus as Map<string, any>;
    broadcastStatusUpdate = statusModule.broadcastStatusUpdate as ReturnType<typeof vi.fn>;
    upsertSession = sessionsDbModule.upsertSession as ReturnType<typeof vi.fn>;

    // Clear maps
    lastHeartbeat.clear();
    tmuxSessionStatus.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT transition from working to idle if hasBeenWorking is true', async () => {
    const sessionName = 'project--test-session-42';
    const now = Date.now();

    // Set up a "working" session that HAS been working (received heartbeats)
    lastHeartbeat.set(sessionName, now);
    tmuxSessionStatus.set(sessionName, {
      status: 'working',
      hasBeenWorking: true, // Session has been working - should NOT transition to idle
      lastEvent: 'Heartbeat',
      lastActivity: now,
      lastStatusChange: now,
      project: 'project',
    });

    // Import and start the monitor
    const { startHeartbeatMonitor, stopHeartbeatMonitor } =
      await import('../../src/heartbeat-monitor.js');

    startHeartbeatMonitor();

    // Advance time past the timeout (3 seconds + 1 second check interval)
    vi.advanceTimersByTime(4000);

    // Status should remain 'working' because hasBeenWorking is true
    const updatedStatus = tmuxSessionStatus.get(sessionName);
    expect(updatedStatus?.status).toBe('working');

    // Database should NOT have been updated
    expect(upsertSession).not.toHaveBeenCalled();

    // No broadcast should have been sent
    expect(broadcastStatusUpdate).not.toHaveBeenCalled();

    stopHeartbeatMonitor();
  });

  it('transitions from working to idle if hasBeenWorking is false (fresh session)', async () => {
    const sessionName = 'project--fresh-session-42';
    const now = Date.now();

    // Set up a "working" session that has NOT been working yet
    // This is an edge case - normally hasBeenWorking would be true for working sessions
    lastHeartbeat.set(sessionName, now);
    tmuxSessionStatus.set(sessionName, {
      status: 'working',
      hasBeenWorking: false, // Session has not been working yet
      lastEvent: 'Heartbeat',
      lastActivity: now,
      lastStatusChange: now,
      project: 'project',
    });

    // Import and start the monitor
    const { startHeartbeatMonitor, stopHeartbeatMonitor } =
      await import('../../src/heartbeat-monitor.js');

    startHeartbeatMonitor();

    // Advance time past the timeout (3 seconds + 1 second check interval)
    vi.advanceTimersByTime(4000);

    // Verify status changed to 'idle' (NOT 'needs_attention')
    const updatedStatus = tmuxSessionStatus.get(sessionName);
    expect(updatedStatus?.status).toBe('idle');
    expect(updatedStatus?.lastEvent).toBe('HeartbeatTimeout');

    // Verify database was updated with 'idle'
    expect(upsertSession).toHaveBeenCalledWith(
      sessionName,
      expect.objectContaining({
        status: 'idle',
        lastEvent: 'HeartbeatTimeout',
      })
    );

    // Verify broadcast was sent with 'idle'
    expect(broadcastStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: sessionName,
        status: 'idle',
        lastEvent: 'HeartbeatTimeout',
      })
    );

    stopHeartbeatMonitor();
  });

  it('does not transition if session is not in working status', async () => {
    const sessionName = 'project--idle-session';
    const now = Date.now();

    // Set up an "init" session (not working)
    lastHeartbeat.set(sessionName, now - 5000); // Old heartbeat
    tmuxSessionStatus.set(sessionName, {
      status: 'init',
      lastEvent: 'SessionCreated',
      lastActivity: now,
      lastStatusChange: now,
      project: 'project',
    });

    const { startHeartbeatMonitor, stopHeartbeatMonitor } =
      await import('../../src/heartbeat-monitor.js');

    startHeartbeatMonitor();
    vi.advanceTimersByTime(4000);

    // Status should remain 'init'
    const updatedStatus = tmuxSessionStatus.get(sessionName);
    expect(updatedStatus?.status).toBe('init');

    stopHeartbeatMonitor();
  });

  it('does not transition if heartbeat is recent', async () => {
    const sessionName = 'project--active-session';
    const now = Date.now();

    // Set up a "working" session with recent heartbeat
    lastHeartbeat.set(sessionName, now);
    tmuxSessionStatus.set(sessionName, {
      status: 'working',
      lastEvent: 'Heartbeat',
      lastActivity: now,
      lastStatusChange: now,
      project: 'project',
    });

    const { startHeartbeatMonitor, stopHeartbeatMonitor } =
      await import('../../src/heartbeat-monitor.js');

    startHeartbeatMonitor();

    // Advance time but not past timeout (only 2 seconds)
    vi.advanceTimersByTime(2000);

    // Status should still be 'working'
    const updatedStatus = tmuxSessionStatus.get(sessionName);
    expect(updatedStatus?.status).toBe('working');

    stopHeartbeatMonitor();
  });

  it('preserves session metrics when transitioning to idle', async () => {
    const sessionName = 'project--metrics-session';
    const now = Date.now();

    // Set up a "working" session with metrics (hasBeenWorking: false to allow transition)
    lastHeartbeat.set(sessionName, now);
    tmuxSessionStatus.set(sessionName, {
      status: 'working',
      hasBeenWorking: false, // Allow transition for this test
      lastEvent: 'Heartbeat',
      lastActivity: now,
      lastStatusChange: now,
      project: 'project',
      model: 'Claude 3 Opus',
      costUsd: 0.5,
      contextUsage: 25,
      linesAdded: 100,
      linesRemoved: 50,
    });

    const { startHeartbeatMonitor, stopHeartbeatMonitor } =
      await import('../../src/heartbeat-monitor.js');

    startHeartbeatMonitor();
    vi.advanceTimersByTime(4000);

    // Verify metrics are preserved in broadcast
    expect(broadcastStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'idle',
        model: 'Claude 3 Opus',
        costUsd: 0.5,
        contextUsage: 25,
        linesAdded: 100,
        linesRemoved: 50,
      })
    );

    stopHeartbeatMonitor();
  });
});
