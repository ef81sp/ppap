import { serveDir } from 'jsr:@std/http/file-server';
import {
  CreateRoomRequest,
  CreateRoomResponse,
  Room,
  UserTokenInfo,
} from './type.ts';
import { CreateRoomRequestSchema } from './validate.ts';
import { createRoom, createUserToken } from './kv.ts';
import { handleKvDebugRequest } from '../debug_kv_view/kv_debug_handler.ts';

const kv = await Deno.openKv();

async function handleCreateRoom(req: Request): Promise<Response> {
  let body: CreateRoomRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    });
  }
  const parse = CreateRoomRequestSchema.safeParse(body);
  if (!parse.success) {
    return new Response(JSON.stringify({ error: 'Validation error' }), {
      status: 400,
    });
  }
  const { roomName, userName } = parse.data;
  // const roomId = v4.generate();
  // const userToken = v4.generate();
  const roomId = crypto.randomUUID();
  const userToken = crypto.randomUUID();
  const now = Date.now();
  const room: Room = {
    id: roomId,
    name: roomName ?? 'ルーム',
    participants: [userToken],
    answers: {},
    config: { allowSpectators: true, maxParticipants: 50 },
    createdAt: now,
    updatedAt: now,
  };
  const userTokenInfo: UserTokenInfo = {
    token: userToken,
    currentRoomId: roomId,
    name: userName,
    isSpectator: false,
    lastAccessedAt: now,
  };
  try {
    await createRoom(kv, room);
    await createUserToken(kv, userTokenInfo);
    const res: CreateRoomResponse = {
      roomId,
      userToken,
      room,
    };
    return new Response(JSON.stringify(res), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
    });
  }
}

async function handleJoinRoom(req: Request, roomId: string): Promise<Response> {
  let body: { userName: string; userToken?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    });
  }
  // バリデーション
  if (
    !body.userName ||
    typeof body.userName !== 'string' ||
    body.userName.length > 24
  ) {
    return new Response(JSON.stringify({ error: 'Validation error' }), {
      status: 400,
    });
  }
  // ルーム取得
  const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
  const room = roomRes.value;
  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
    });
  }
  let userToken = body.userToken;
  if (!userToken) {
    userToken = crypto.randomUUID();
  }
  // UserTokenの検証・新規作成
  const userTokenInfoRes = await kv.get<UserTokenInfo>([
    `user_tokens:${userToken}`,
  ]);
  let userTokenInfo = userTokenInfoRes.value;
  if (!userTokenInfo) {
    userTokenInfo = {
      token: userToken,
      currentRoomId: roomId,
      name: body.userName,
      isSpectator: false,
      lastAccessedAt: Date.now(),
    };
    await kv
      .atomic()
      .set([`user_tokens:${userToken}`], userTokenInfo)
      .commit();
  } else {
    userTokenInfo = {
      ...userTokenInfo,
      currentRoomId: roomId,
      name: body.userName,
      lastAccessedAt: Date.now(),
    };
    await kv
      .atomic()
      .set([`user_tokens:${userToken}`], userTokenInfo)
      .commit();
  }
  // ルーム参加者に追加
  if (!room.participants.includes(userToken)) {
    room.participants.push(userToken);
    room.updatedAt = Date.now();
    await kv
      .atomic()
      .set([`rooms:${roomId}`], room)
      .commit();
  }
  return new Response(JSON.stringify({ userToken, room }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function handleLeaveRoom(
  req: Request,
  roomId: string
): Promise<Response> {
  let body: { userToken: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    });
  }
  if (!body.userToken || typeof body.userToken !== 'string') {
    return new Response(JSON.stringify({ error: 'Validation error' }), {
      status: 400,
    });
  }
  // ルーム取得
  const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
  const room = roomRes.value;
  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
    });
  }
  // UserToken検証
  const userTokenInfoRes = await kv.get<UserTokenInfo>([
    `user_tokens:${body.userToken}`,
  ]);
  const userTokenInfo = userTokenInfoRes.value;
  if (!userTokenInfo || userTokenInfo.currentRoomId !== roomId) {
    return new Response(JSON.stringify({ error: 'Invalid userToken' }), {
      status: 400,
    });
  }
  // 参加者から削除
  const idx = room.participants.indexOf(body.userToken);
  if (idx !== -1) {
    room.participants.splice(idx, 1);
    room.updatedAt = Date.now();
    await kv
      .atomic()
      .set([`rooms:${roomId}`], room)
      .commit();
  }
  // userTokenのcurrentRoomIdをnullに
  userTokenInfo.currentRoomId = null;
  userTokenInfo.lastAccessedAt = Date.now();
  await kv
    .atomic()
    .set([`user_tokens:${body.userToken}`], userTokenInfo)
    .commit();
  // WebSocket切断処理はここでは省略（後で実装）
  return new Response(
    JSON.stringify({ message: 'Successfully left the room' }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

// --- WebSocket接続管理・認証・ルーム存在確認・UserToken検証を追加 ---
const wsClients = new Map<string, WebSocket>(); // userToken -> WebSocket

function handleWebSocket(req: Request, roomId: string): Response {
  // Originヘッダー検証
  const allowedOrigins = [
    'http://localhost:5173',
    'https://your-production-domain.com',
  ];
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(req.url);
  const userToken = url.searchParams.get('userToken');
  if (!userToken) {
    return new Response('Missing userToken', { status: 400 });
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  (async () => {
    const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
    const userTokenRes = await kv.get<UserTokenInfo>([
      `user_tokens:${userToken}`,
    ]);
    if (!roomRes.value || !userTokenRes.value) {
      socket.close(4000, 'Invalid room or userToken');
      return;
    }
    wsClients.set(userToken, socket);
    // ここで初期room情報などを送信可能
  })();
  // --- WebSocketメッセージハンドリング雛形 ---
  // クライアントからのメッセージ形式に応じて分岐
  socket.onmessage = e => {
    if (typeof e.data === 'string' && e.data.length > 2048) {
      _sendError(socket, 'Message too large');
      socket.close(4001, 'Message too large');
      return;
    }
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'submit_answer') {
        // 回答送信処理
        (async () => {
          const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
          if (!roomRes.value) return _sendError(socket, 'Room not found');
          const room = roomRes.value;
          room.answers[userToken] = msg.payload.answer;
          room.updatedAt = Date.now();
          await kv
            .atomic()
            .set([`rooms:${roomId}`], room)
            .commit();
          // 通知はwatchで行う
        })();
      } else if (msg.type === 'toggle_spectator') {
        // 観覧者モード切替処理
        (async () => {
          const userTokenInfoRes = await kv.get<UserTokenInfo>([
            `user_tokens:${userToken}`,
          ]);
          if (!userTokenInfoRes.value)
            return _sendError(socket, 'UserToken not found');
          const info = userTokenInfoRes.value;
          info.isSpectator = msg.payload.isSpectator;
          info.lastAccessedAt = Date.now();
          await kv
            .atomic()
            .set([`user_tokens:${userToken}`], info)
            .commit();
          // 参加者リスト更新通知はwatch経由
        })();
      } else if (msg.type === 'clear_answers') {
        // 回答クリア処理
        (async () => {
          const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
          if (!roomRes.value) return _sendError(socket, 'Room not found');
          const room = roomRes.value;
          room.answers = {};
          room.updatedAt = Date.now();
          await kv
            .atomic()
            .set([`rooms:${roomId}`], room)
            .commit();
        })();
      } else {
        _sendError(socket, 'Unknown message type');
      }
    } catch {
      _sendError(socket, 'Invalid message format');
    }
  };
  socket.onclose = () => {
    wsClients.delete(userToken);
    // 切断時のクリーンアップ
  };
  socket.onerror = _e => {
    // エラーハンドリング
  };
  return response;
}

// --- Deno KV Watch雛形 ---
async function _watchRoomUpdates(roomId: string) {
  const iter = kv.watch([[`rooms:${roomId}`]]);
  for await (const _event of iter) {
    const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
    if (roomRes.value) {
      _broadcastRoomUpdate(roomId, roomRes.value);
    }
  }
}

function _broadcastRoomUpdate(_roomId: string, room: Room) {
  for (const [userToken, ws] of wsClients.entries()) {
    if (
      room.participants.includes(userToken) &&
      ws.readyState === WebSocket.OPEN
    ) {
      ws.send(JSON.stringify({ type: 'room_update', payload: room }));
    }
  }
}
function _sendError(ws: WebSocket, _message: string) {
  // クライアントには詳細なエラー内容を送らず、汎用的なメッセージのみ返す
  ws.send(
    JSON.stringify({
      type: 'error',
      payload: { message: 'An error occurred.' },
    })
  );
}

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
    return handleCreateRoom(request);
  }
  if (
    request.method === 'POST' &&
    pathname.match(/^\/api\/rooms\/(.+)\/join$/)
  ) {
    const roomId = pathname.match(/^\/api\/rooms\/(.+)\/join$/)?.[1] ?? '';
    return handleJoinRoom(request, roomId);
  }
  if (
    request.method === 'POST' &&
    pathname.match(/^\/api\/rooms\/(.+)\/leave$/)
  ) {
    const roomId = pathname.match(/^\/api\/rooms\/(.+)\/leave$/)?.[1] ?? '';
    return handleLeaveRoom(request, roomId);
  }
  if (request.method === 'GET' && pathname.match(/^\/ws\/rooms\/(.+)$/)) {
    const roomId = pathname.match(/^\/ws\/rooms\/(.+)$/)?.[1] ?? '';
    return handleWebSocket(request, roomId);
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
