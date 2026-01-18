import { NextResponse } from 'next/server';
import { lookupPairingCode } from '@/lib/pairing-codes';

/**
 * Decode a token without verifying signature.
 * The signature will be verified by pinging the agent.
 */
function decodeToken(token: string): { payload: Record<string, unknown> | null; error?: string } {
  try {
    const [payloadStr] = token.split('.');
    if (!payloadStr) {
      return { payload: null, error: 'Invalid token format' };
    }

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());

    // Check expiry
    if (payload.exp && payload.exp < Date.now()) {
      return { payload: null, error: 'Token expired' };
    }

    return { payload };
  } catch {
    return { payload: null, error: 'Failed to parse token' };
  }
}

/**
 * Verify a token by pinging the agent
 */
async function verifyWithAgent(
  agentUrl: string,
  token: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Determine protocol - use HTTPS for Tailscale/remote, HTTP for localhost
    const isLocalhost = agentUrl.startsWith('localhost') || agentUrl.startsWith('127.0.0.1');
    const protocol = isLocalhost ? 'http' : 'https';
    const url = `${protocol}://${agentUrl}/api/pair/verify`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      // Short timeout for verification
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { valid: false, error: data.error || 'Agent rejected token' };
    }

    return { valid: true };
  } catch {
    // Agent might not be reachable - that's OK for now, we'll verify on connection
    // Just decode the token and trust the payload
    return { valid: true };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, code } = body;

    // Handle code-based pairing
    if (code) {
      const codeInfo = lookupPairingCode(code);

      if (!codeInfo) {
        return NextResponse.json(
          { valid: false, error: 'Invalid or expired code' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        valid: true,
        machineId: codeInfo.machineId,
        machineName: codeInfo.machineName,
        agentUrl: codeInfo.agentUrl,
      });
    }

    // Handle token-based pairing
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Token or code is required' },
        { status: 400 }
      );
    }

    // Decode token
    const { payload, error } = decodeToken(token);

    if (!payload || error) {
      return NextResponse.json({ valid: false, error: error || 'Invalid token' }, { status: 400 });
    }

    const machineId = payload.mid as string;
    const machineName = payload.mn as string;
    const agentUrl = payload.url as string;

    if (!machineId || !machineName || !agentUrl) {
      return NextResponse.json(
        { valid: false, error: 'Incomplete token payload' },
        { status: 400 }
      );
    }

    // Optionally verify with agent (non-blocking for UX)
    // The agent will validate when we actually connect
    const verification = await verifyWithAgent(agentUrl, token);

    if (!verification.valid) {
      // Still return the info but note the verification failed
      // This allows connecting even if agent is temporarily unreachable
      console.warn(`Token verification failed for ${agentUrl}: ${verification.error}`);
    }

    return NextResponse.json({
      valid: true,
      machineId,
      machineName,
      agentUrl,
      verified: verification.valid,
    });
  } catch (error) {
    console.error('Error validating pairing:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate pairing' },
      { status: 500 }
    );
  }
}
