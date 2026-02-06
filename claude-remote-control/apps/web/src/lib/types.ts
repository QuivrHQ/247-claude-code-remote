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

