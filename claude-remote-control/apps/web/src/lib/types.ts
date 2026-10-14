/**
 * Type definitions for web app
 */
import type { WSSessionInfo } from '247-shared';

/**
 * Session info with optional additional fields from StatusLine
 */
export interface SessionInfo extends WSSessionInfo {
  /** Model name from StatusLine */
  model?: string;
  /** Cost in USD from StatusLine */
  costUsd?: number;
}

/**
 * Session info with machine context
 */
export interface SessionWithMachine extends SessionInfo {
  machineId: string;
  machineName: string;
  agentUrl: string;
  authToken?: string;
}
