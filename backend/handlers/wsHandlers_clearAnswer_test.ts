import { assertEquals } from 'jsr:@std/assert';
import { handleWebSocket } from './wsHandlers.ts';
import { genMsgClearAnswer } from '../../wsMsg/msgFromClient.ts';
import type { Room } from '../type.ts';

Deno.test('WebSocket: clearAnswerメッセージで回答が消去される', async () => {
  // テスト用roomIdとroomデータ
  const roomId = 'room_clear_test';
  const userToken = 'tokentest';
  const testRoom: Room = {
    id: roomId,
    participants: [
      { token: userToken, name: 'user', answer: '5', isAudience: false },
      { token: 'tokentest2', name: 'user2', answer: '8', isAudience: false },
    ],
    config: { allowSpectators: true, maxParticipants: 10 },
    createdAt: 1,
    updatedAt: 2,
  };
  let savedRoom: Room | null = null;
  // モックのDeno.Kv
  const kv = {
    get: async () => await Promise.resolve({ value: testRoom }),
    atomic: () => ({
      set: (_key: unknown, room: Room) => {
        savedRoom = JSON.parse(JSON.stringify(room));
        return { commit: async () => {} };
      },
    }),
    watch: () => ({ async *[Symbol.asyncIterator]() {} }),
  } as unknown as Deno.Kv;

  // モックWebSocket
  let onmessageHandler: ((event: { data: string }) => void) | undefined;
  const fakeSocket: Partial<WebSocket> = {
    send: (_msg: string) => {},
    close: () => {},
    addEventListener: () => {},
    onopen: null,
    onclose: null,
    onerror: null,
  };
  Object.defineProperty(fakeSocket, 'onmessage', {
    set(fn) {
      onmessageHandler = fn;
    },
    get() {
      return onmessageHandler;
    },
    configurable: true,
  });
  const socketObj = { socket: fakeSocket as WebSocket, userToken };
  const wsHandlers = await import('./wsHandlers.ts');
  // @ts-ignore: テスト用に型不一致を許容
  wsHandlers.roomSockets.set(roomId, new Set([socketObj]));

  // WebSocketリクエストを作成
  const req = new Request('http://localhost/ws/rooms/' + roomId, {
    method: 'GET',
    headers: {
      'upgrade': 'websocket',
      'connection': 'Upgrade',
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'sec-websocket-version': '13',
    },
  });
  // WebSocketハンドラを起動
  handleWebSocket(req, roomId, kv, () => ({
    socket: fakeSocket as unknown as WebSocket,
    response: new Response(null, { status: 101 }),
  }));

  // onmessageハンドラを取得して直接呼び出す
  if (typeof onmessageHandler !== 'function')
    throw new Error('onmessage not set');
  // 認証メッセージを送信してuserTokenをセット
  const authMsg = { type: 'auth', userToken };
  await onmessageHandler!({ data: JSON.stringify(authMsg) });
  // clearAnswerメッセージを送信
  const clearMsg = genMsgClearAnswer();
  await onmessageHandler!({ data: JSON.stringify(clearMsg) });
  await new Promise(r => setTimeout(r, 10)); // 非同期処理の完了を少し待つ

  // 回答が消去されたか確認
  if (!savedRoom) throw new Error('Room not saved');
  for (const p of (savedRoom as Room).participants) {
    assertEquals(p.answer, '');
  }
});
