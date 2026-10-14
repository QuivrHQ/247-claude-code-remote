/**
 * AgentConnectionSettings Tests
 *
 * Tests for agent connection management including localStorage persistence.
 *
 * Note: The storage format changed to support multiple agents:
 * - Old: 'agentConnection' key with single AgentConnection object
 * - New: '247-local-connections' key with array of StoredAgentConnection objects,
 *   shared with the useAgentConnections hook
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadAgentConnection,
  loadAgentConnections,
  saveAgentConnection,
  addAgentConnection,
  clearAllAgentConnections,
  type AgentConnection,
  type StoredAgentConnection,
} from '@/components/AgentConnectionSettings';

// Storage keys
const OLD_STORAGE_KEY = 'agentConnection';
const STORAGE_KEY = '247-local-connections';

describe('AgentConnectionSettings', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('loadAgentConnection (legacy)', () => {
    it('returns null when no connection is stored', () => {
      expect(loadAgentConnection()).toBeNull();
    });

    it('returns first stored connection when present (new format)', () => {
      const storedConnection: StoredAgentConnection = {
        id: 'test-id',
        url: 'localhost:4678',
        name: 'Test Agent',
        method: 'localhost',
        createdAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([storedConnection]));

      const result = loadAgentConnection();
      expect(result).toEqual({
        url: 'localhost:4678',
        name: 'Test Agent',
        method: 'localhost',
      });
    });

    it('migrates old format to new format', () => {
      const oldConnection: AgentConnection = {
        url: 'localhost:4678',
        name: 'Test Agent',
        method: 'localhost',
      };
      localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(oldConnection));

      const result = loadAgentConnection();
      expect(result).toEqual(oldConnection);

      // Old key should be removed after migration
      expect(localStorage.getItem(OLD_STORAGE_KEY)).toBeNull();
      // New format should exist
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it('returns null for invalid JSON in new format', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');
      expect(loadAgentConnection()).toBeNull();
    });
  });

  describe('loadAgentConnections', () => {
    it('returns empty array when no connections stored', () => {
      expect(loadAgentConnections()).toEqual([]);
    });

    it('returns all stored connections', () => {
      const connections: StoredAgentConnection[] = [
        { id: '1', url: 'localhost:4678', name: 'Local', method: 'localhost', createdAt: 1 },
        { id: '2', url: 'remote.example.com', name: 'Remote', method: 'custom', createdAt: 2 },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));

      expect(loadAgentConnections()).toEqual(connections);
    });
  });

  describe('saveAgentConnection (legacy)', () => {
    it('saves connection to localStorage in new format', () => {
      const connection: AgentConnection = {
        url: 'localhost:4678',
        name: 'Same Computer',
        method: 'localhost',
      };

      saveAgentConnection(connection);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].url).toBe('localhost:4678');
      expect(stored[0].name).toBe('Same Computer');
      expect(stored[0].method).toBe('localhost');
      expect(stored[0].id).toBeDefined();
      expect(stored[0].createdAt).toBeDefined();
    });

    it('returns the saved connection', () => {
      const connection: AgentConnection = {
        url: 'localhost:4679',
        method: 'localhost',
      };

      const result = saveAgentConnection(connection);

      expect(result).toEqual(connection);
    });

    it('adds multiple connections with different URLs', () => {
      const connection1: AgentConnection = {
        url: 'localhost:4678',
        method: 'localhost',
      };
      const connection2: AgentConnection = {
        url: 'machine.tailnet.ts.net',
        name: 'New Connection',
        method: 'tailscale',
      };

      saveAgentConnection(connection1);
      saveAgentConnection(connection2);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(2);
    });

    it('updates existing connection with same URL', () => {
      const connection1: AgentConnection = {
        url: 'localhost:4678',
        name: 'Original',
        method: 'localhost',
      };
      const connection2: AgentConnection = {
        url: 'localhost:4678',
        name: 'Updated',
        method: 'localhost',
      };

      saveAgentConnection(connection1);
      saveAgentConnection(connection2);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Updated');
    });
  });

  describe('addAgentConnection', () => {
    it('adds a new connection and returns it with id', () => {
      const result = addAgentConnection({
        url: 'localhost:4678',
        name: 'Test',
        method: 'localhost',
      });

      expect(result.id).toBeDefined();
      expect(result.url).toBe('localhost:4678');
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('clearAllAgentConnections', () => {
    it('removes all connections', () => {
      addAgentConnection({ url: 'localhost:4678', name: 'A', method: 'localhost' });
      addAgentConnection({ url: 'remote.example.com', name: 'B', method: 'custom' });

      clearAllAgentConnections();

      expect(loadAgentConnections()).toEqual([]);
    });
  });

  describe('connect flow', () => {
    it('full connect cycle works correctly', () => {
      // Initially no connection
      expect(loadAgentConnection()).toBeNull();

      // Save a connection
      const connection: AgentConnection = {
        url: 'localhost:4678',
        name: 'Same Computer',
        method: 'localhost',
      };
      saveAgentConnection(connection);
      expect(loadAgentConnection()).toEqual(connection);

      // Clear all connections
      clearAllAgentConnections();
      expect(loadAgentConnection()).toBeNull();

      // Can save a new connection after clearing
      const newConnection: AgentConnection = {
        url: 'new-machine.tailnet.ts.net',
        name: 'Tailscale Funnel',
        method: 'tailscale',
      };
      saveAgentConnection(newConnection);
      expect(loadAgentConnection()).toEqual(newConnection);
    });
  });
});
