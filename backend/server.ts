import { serveDir } from 'jsr:@std/http/file-server';
import { handleKvDebugRequest } from '../debug_kv_view/kv_debug_handler.ts';
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleRejoinRoom, // 追加
} from './handlers/roomHandlers.ts';
import {
  handleWebSocket,
} from './handlers/wsHandlers.ts';

const kv = await Deno.openKv();

async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  // KV Debug Viewer (Development Only)
  if (Deno.env.get('APP_ENV') === 'development') {
    const debugResponse = await handleKvDebugRequest(request);
    if (debugResponse) {
      return debugResponse;
    }
  }

  if (request.method === 'POST' && pathname === '/api/rooms') {
    return handleCreateRoom(request, kv);
  }
  if (
    request.method === 'POST' &&
    pathname.match(/^\/api\/rooms\/(.+)\/join$/)
  ) {
    const roomId = pathname.match(/^\/api\/rooms\/(.+)\/join$/)?.[1] ?? '';
    return handleJoinRoom(request, roomId, kv);
  }
  if (
    request.method === 'POST' &&
    pathname.match(/^\/api\/rooms\/(.+)\/leave$/)
  ) {
    const roomId = pathname.match(/^\/api\/rooms\/(.+)\/leave$/)?.[1] ?? '';
    return handleLeaveRoom(request, roomId, kv);
  }
  if (
    request.method === 'POST' &&
    pathname.match(/^\/api\/rooms\/(.+)\/rejoin$/)
  ) {
    const roomId = pathname.match(/^\/api\/rooms\/(.+)\/rejoin$/)?.[1] ?? '';
    return handleRejoinRoom(request, roomId, kv);
  }
  if (request.method === 'GET' && pathname.match(/^\/ws\/rooms\/(.+)$/)) {
    const roomId = pathname.match(/^\/ws\/rooms\/(.+)$/)?.[1] ?? '';
    return handleWebSocket(request, roomId, kv);
  }
  if (
    pathname === '/' ||
    pathname.startsWith('/assets') ||
    pathname.endsWith('.png')
  ) {
    return serveDir(request, { fsRoot: './dist/' });
  }
  return Promise.resolve(
    new Response('Not found', {
      status: 404,
      statusText: 'Not found',
      headers: {
        'content-type': 'text/plain',
      },
    })
  );
}

Deno.serve(
  {
    port: Number(Deno.env.get('PORT')) || 8000,
  },
  handler
);
