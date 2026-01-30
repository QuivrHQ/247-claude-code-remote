import type { NextRequest } from 'next/server';

// Lazy handler to avoid build-time env var requirement
async function createHandler(method: string) {
  const { authApiHandler } = await import('@neondatabase/auth/next/server');
  const handlers = authApiHandler();
  return handlers[method as keyof typeof handlers];
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const handler = await createHandler('GET');
  return handler(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const handler = await createHandler('POST');
  const response = await handler(request, context);
  if (!response.ok) {
    const text = await response.clone().text();
    console.error('[Auth POST Error]', response.status, text);
  }
  return response;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const handler = await createHandler('PUT');
  return handler(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const handler = await createHandler('DELETE');
  return handler(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const handler = await createHandler('PATCH');
  return handler(request, context);
}
