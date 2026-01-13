/**
 * getAgentUrl Logic Tests
 *
 * Tests for the agent URL selection logic that ensures the correct agent
 * connection URL is returned based on the selected session's machineId.
 */
import { describe, it, expect } from 'vitest';

interface AgentConnection {
  id: string;
  url: string;
  name: string;
  method: 'localhost' | 'tailscale' | 'custom' | 'cloud';
  isCloud?: boolean;
  cloudAgentId?: string;
}

interface SelectedSession {
  machineId: string;
  sessionName: string;
}

// Simulates the getAgentUrl logic from useHomeState.ts
function getAgentUrl(
  selectedSession: SelectedSession | null,
  agentConnections: AgentConnection[]
): string {
  if (!selectedSession) return '';
  const connection = agentConnections.find((c) => c.id === selectedSession.machineId);
  return connection?.url || '';
}

const mockConnections: AgentConnection[] = [
  {
    id: 'local',
    url: 'ws://localhost:4678',
    name: 'Same Computer',
    method: 'localhost',
  },
  {
    id: 'cloud-agent-cdg',
    url: 'wss://agent-hks2ss-2f.fly.dev',
    name: 'Cloud Agent (cdg)',
    method: 'cloud',
    isCloud: true,
    cloudAgentId: 'agent-123',
  },
  {
    id: 'tailscale-agent',
    url: 'wss://my-mac.tailnet-xxx.ts.net:4678',
    name: 'Home Mac',
    method: 'tailscale',
  },
];

describe('getAgentUrl logic', () => {
  describe('when no session is selected', () => {
    it('should return empty string when selectedSession is null', () => {
      const result = getAgentUrl(null, mockConnections);
      expect(result).toBe('');
    });
  });

  describe('when selecting different agents', () => {
    it('should return URL for local agent when local is selected', () => {
      const session: SelectedSession = { machineId: 'local', sessionName: 'test-session' };
      const result = getAgentUrl(session, mockConnections);
      expect(result).toBe('ws://localhost:4678');
    });

    it('should return URL for cloud agent when cloud is selected', () => {
      const session: SelectedSession = {
        machineId: 'cloud-agent-cdg',
        sessionName: 'test-session',
      };
      const result = getAgentUrl(session, mockConnections);
      expect(result).toBe('wss://agent-hks2ss-2f.fly.dev');
    });

    it('should return URL for tailscale agent when tailscale is selected', () => {
      const session: SelectedSession = {
        machineId: 'tailscale-agent',
        sessionName: 'test-session',
      };
      const result = getAgentUrl(session, mockConnections);
      expect(result).toBe('wss://my-mac.tailnet-xxx.ts.net:4678');
    });
  });

  describe('edge cases', () => {
    it('should return empty string when machineId does not match any connection', () => {
      const session: SelectedSession = { machineId: 'non-existent', sessionName: 'test-session' };
      const result = getAgentUrl(session, mockConnections);
      expect(result).toBe('');
    });

    it('should return empty string when agentConnections is empty', () => {
      const session: SelectedSession = { machineId: 'local', sessionName: 'test-session' };
      const result = getAgentUrl(session, []);
      expect(result).toBe('');
    });

    it('should find correct connection when it is not the first in the list', () => {
      // This is the key test for the bug fix - previously it always returned first connection
      const session: SelectedSession = {
        machineId: 'cloud-agent-cdg',
        sessionName: 'test-session',
      };
      const result = getAgentUrl(session, mockConnections);

      // Should NOT be the first connection's URL
      expect(result).not.toBe(mockConnections[0].url);
      // Should be the second connection's URL
      expect(result).toBe(mockConnections[1].url);
    });
  });

  describe('with single connection', () => {
    it('should return URL when single connection matches', () => {
      const singleConnection: AgentConnection[] = [
        { id: 'only-one', url: 'ws://only.dev', name: 'Only', method: 'custom' },
      ];
      const session: SelectedSession = { machineId: 'only-one', sessionName: 'test' };
      const result = getAgentUrl(session, singleConnection);
      expect(result).toBe('ws://only.dev');
    });

    it('should return empty when single connection does not match', () => {
      const singleConnection: AgentConnection[] = [
        { id: 'only-one', url: 'ws://only.dev', name: 'Only', method: 'custom' },
      ];
      const session: SelectedSession = { machineId: 'different-id', sessionName: 'test' };
      const result = getAgentUrl(session, singleConnection);
      expect(result).toBe('');
    });
  });
});
