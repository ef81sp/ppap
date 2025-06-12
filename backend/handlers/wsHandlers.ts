import { Room, UserTokenInfo } from '../type.ts';

const wsClients = new Map<string, WebSocket>(); // userToken -> WebSocket

function _sendError(ws: WebSocket, _message: string) {
  ws.send(
    JSON.stringify({
      type: 'error',
      payload: { message: 'An error occurred.' },
    })
  );
}

export function handleWebSocket(
  req: Request,
  roomId: string,
  kv: Deno.Kv
): Response {
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
  socket.onmessage = e => {
    if (typeof e.data === 'string' && e.data.length > 2048) {
      _sendError(socket, 'Message too large');
      socket.close(4001, 'Message too large');
      return;
    }
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'submit_answer') {
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
        })();
      } else if (msg.type === 'toggle_spectator') {
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
        })();
      } else if (msg.type === 'clear_answers') {
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
  };
  socket.onerror = _e => {
    // エラーハンドリング
  };
  return response;
}

export async function _watchRoomUpdates(roomId: string, kv: Deno.Kv) {
  const iter = kv.watch([[`rooms:${roomId}`]]);
  for await (const _event of iter) {
    const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
    if (roomRes.value) {
      _broadcastRoomUpdate(roomId, roomRes.value);
    }
  }
}

export function _broadcastRoomUpdate(_roomId: string, room: Room) {
  for (const [userToken, ws] of wsClients.entries()) {
    if (
      room.participants.includes(userToken) &&
      ws.readyState === WebSocket.OPEN
    ) {
      ws.send(JSON.stringify({ type: 'room_update', payload: room }));
    }
  }
}
