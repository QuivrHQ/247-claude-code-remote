import { NextResponse } from 'next/server';
import { db, agentConnection } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { neonAuth } = await import('@neondatabase/auth/next/server');
    const { user } = await neonAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await db
      .delete(agentConnection)
      .where(and(eq(agentConnection.id, id), eq(agentConnection.userId, user.id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { neonAuth } = await import('@neondatabase/auth/next/server');
    const { user } = await neonAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const [connection] = await db
      .update(agentConnection)
      .set({
        name: body.name,
        url: body.url,
        method: body.method,
        color: body.color,
        // Only overwrite the token when the request actually carries one, so
        // editing a connection's name/color does not wipe its stored token.
        ...(body.authToken !== undefined ? { authToken: body.authToken } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(agentConnection.id, id), eq(agentConnection.userId, user.id)))
      .returning();

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json(connection);
  } catch (error) {
    console.error('Error updating connection:', error);
    return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
  }
}
