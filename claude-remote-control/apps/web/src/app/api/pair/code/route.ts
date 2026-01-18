import { NextResponse } from 'next/server';
import { registerPairingCode, lookupPairingCode } from '@/lib/pairing-codes';

/**
 * POST /api/pair/code - Register a pairing code from an agent
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, machineId, machineName, agentUrl } = body;

    if (!code || !machineId || !machineName || !agentUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: code, machineId, machineName, agentUrl' },
        { status: 400 }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be 6 digits' }, { status: 400 });
    }

    registerPairingCode({
      code,
      machineId,
      machineName,
      agentUrl,
    });

    return NextResponse.json({
      success: true,
      code,
      expiresIn: 10 * 60 * 1000, // 10 minutes
    });
  } catch (error) {
    console.error('Error registering pairing code:', error);
    return NextResponse.json({ error: 'Failed to register pairing code' }, { status: 500 });
  }
}

/**
 * GET /api/pair/code?code=123456 - Lookup a pairing code
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Code parameter is required' }, { status: 400 });
    }

    const codeInfo = lookupPairingCode(code);

    if (!codeInfo) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 404 });
    }

    return NextResponse.json({
      valid: true,
      machineId: codeInfo.machineId,
      machineName: codeInfo.machineName,
      agentUrl: codeInfo.agentUrl,
      expiresAt: codeInfo.expiresAt,
    });
  } catch (error) {
    console.error('Error looking up pairing code:', error);
    return NextResponse.json({ error: 'Failed to lookup pairing code' }, { status: 500 });
  }
}
