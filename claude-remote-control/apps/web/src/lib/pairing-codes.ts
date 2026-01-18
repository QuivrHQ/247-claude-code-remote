/**
 * In-memory pairing code storage for dashboard.
 * Codes are registered by agents and looked up by users.
 * TTL: 10 minutes, single-use (deleted after lookup).
 */

export interface PairingCodeInfo {
  code: string;
  machineId: string;
  machineName: string;
  agentUrl: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory store - codes expire after 10 minutes
const pairingCodes = new Map<string, PairingCodeInfo>();

// Cleanup interval - remove expired codes every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [code, data] of pairingCodes.entries()) {
      if (data.expiresAt < now) {
        pairingCodes.delete(code);
      }
    }
  }, 60 * 1000);
}

/**
 * Register a pairing code from an agent
 */
export function registerPairingCode(info: Omit<PairingCodeInfo, 'createdAt' | 'expiresAt'>): void {
  // Remove any existing code for this machine
  for (const [existingCode, data] of pairingCodes.entries()) {
    if (data.machineId === info.machineId) {
      pairingCodes.delete(existingCode);
    }
  }

  const now = Date.now();
  pairingCodes.set(info.code, {
    ...info,
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Lookup a pairing code - returns info if valid, null if not found or expired
 * Does NOT consume the code (allows multiple lookups)
 */
export function lookupPairingCode(code: string): PairingCodeInfo | null {
  const data = pairingCodes.get(code);

  if (!data) {
    return null;
  }

  // Check expiry
  if (data.expiresAt < Date.now()) {
    pairingCodes.delete(code);
    return null;
  }

  return data;
}

/**
 * Consume a pairing code - returns info and removes it (single-use)
 */
export function consumePairingCode(code: string): PairingCodeInfo | null {
  const data = lookupPairingCode(code);

  if (data) {
    pairingCodes.delete(code);
  }

  return data;
}

/**
 * Get all active pairing codes (for debugging)
 */
export function getActivePairingCodes(): PairingCodeInfo[] {
  const now = Date.now();
  const active: PairingCodeInfo[] = [];

  for (const data of pairingCodes.values()) {
    if (data.expiresAt > now) {
      active.push(data);
    }
  }

  return active;
}
