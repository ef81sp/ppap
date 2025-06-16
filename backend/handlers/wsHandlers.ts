import { Room } from '../type.ts';
import { toRoomForClient } from './roomHandlers.ts';

// --- ルームごとのWebSocket接続管理 ---
type SocketWithToken = { socket: WebSocket; userToken: string | null };
const roomSockets = new Map<string, Set<SocketWithToken>>();
// --- ルームごとのwatcher起動管理 ---
const roomWatchers = new Map<string, boolean>();

export function handleWebSocket(
  request: Request,
  roomId: string,
  kv: Deno.Kv
): Response {
  if (request.headers.get('upgrade') != 'websocket') {
    return new Response('Not a websocket request', { status: 400 });
  }
  const { socket, response } = Deno.upgradeWebSocket(request);
  // ルームごとにソケットを管理
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  // userTokenは最初はnull、後でクライアントから受信してセット
  const socketObj: SocketWithToken = { socket, userToken: null };
  roomSockets.get(roomId)!.add(socketObj);

  socket.onopen = () => {
    console.log(`WebSocket connected for room: ${roomId}`);
    // ルームごとに一度だけwatcherを起動
    if (!roomWatchers.has(roomId)) {
      startRoomWatcherForRoom(roomId, kv);
      roomWatchers.set(roomId, true);
    }
  };
  socket.onmessage = event => {
    if (handleAuthMessage(socketObj, event.data)) return;
    if (event.data === 'ping') {
      socket.send('pong');
      return;
    }
  };
  socket.onclose = () => {
    roomSockets.get(roomId)?.delete(socketObj);
    console.log(`WebSocket closed for room: ${roomId}`);
  };
  socket.onerror = e => {
    console.error(`WebSocket error:`, e);
  };
  return response;
}

// --- テストしやすいようuserToken認証処理を分離 ---
export function handleAuthMessage(
  socketObj: { userToken: string | null },
  data: string
) {
  try {
    const msg = JSON.parse(data);
    if (msg.type === 'auth' && typeof msg.userToken === 'string') {
      socketObj.userToken = msg.userToken;
      return true;
    }
  } catch {}
  return false;
}

// --- ルームごとに個別にwatcherを起動 ---
function startRoomWatcherForRoom(roomId: string, kv: Deno.Kv) {
  (async () => {
    const iter = kv.watch([['rooms', roomId]]);
    for await (const entries of iter) {
      for (const entry of entries) {
        const key = entry.key;
        const value = entry.value;
        if (!Array.isArray(key) || key[0] !== 'rooms' || key[1] !== roomId)
          continue;
        const sockets = roomSockets.get(roomId);
        if (!sockets || sockets.size === 0) continue;
        for (const wsObj of sockets) {
          if (!wsObj.userToken) continue; // userToken未登録はスキップ
          try {
            const roomForClient = toRoomForClient(
              value as import('../type.ts').Room,
              wsObj.userToken
            );
            const msg = JSON.stringify({ type: 'room', room: roomForClient });
            wsObj.socket.send(msg);
          } catch (_e) {}
        }
      }
    }
  })();
}

// --- テスト用: 1回だけ監視して終了するwatcher ---
export async function startRoomWatcherForRoomOnce(roomId: string, kv: Deno.Kv) {
  const iter = kv.watch({ prefix: ['rooms', roomId] } as any);
  for await (const entries of iter) {
    for (const entry of entries) {
      const key = entry.key;
      const value = entry.value;
      if (!Array.isArray(key) || key[0] !== 'rooms' || key[1] !== roomId)
        continue;
      const sockets = roomSockets.get(roomId);
      if (!sockets || sockets.size === 0) continue;
      for (const wsObj of sockets) {
        if (!wsObj.userToken) continue;
        try {
          const roomForClient = toRoomForClient(
            value as import('../type.ts').Room,
            wsObj.userToken
          );
          const msg = JSON.stringify({ type: 'room', room: roomForClient });
          wsObj.socket.send(msg);
        } catch (_e) {}
      }
    }
    break; // 1回だけで終了
  }
}

// --- テスト用にエクスポート ---
export { roomSockets, startRoomWatcherForRoom };
