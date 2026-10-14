import { NextResponse } from 'next/server';
import { db, agentConnection } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const { neonAuth } = await import('@neondatabase/auth/next/server');
    const { user } = await neonAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connections = await db
      .select()
      .from(agentConnection)
      .where(eq(agentConnection.userId, user.id));

    return NextResponse.json(connections);
  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { neonAuth } = await import('@neondatabase/auth/next/server');
    const { user } = await neonAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const id = crypto.randomUUID();

    const [connection] = await db
      .insert(agentConnection)
      .values({
        id,
        userId: user.id,
        url: body.url,
        name: body.name,
        machineId: body.machineId,
        method: body.method || 'tailscale',
        color: body.color,
        authToken: body.authToken,
      })
      .returning();

    return NextResponse.json(connection);
  } catch (error) {
    console.error('Error creating connection:', error);
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 });
  }
}
