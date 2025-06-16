import { assertEquals } from "jsr:@std/assert";
import { handleWebSocket, handleAuthMessage } from "./wsHandlers.ts";

Deno.test("WebSocket: upgrade request returns response", () => {
  // モックのRequest（WebSocket Upgrade）
  const req = new Request("http://localhost/ws/rooms/testroom", {
    method: "GET",
    headers: {
      upgrade: "websocket",
      connection: "Upgrade",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
      "sec-websocket-version": "13",
    },
  });
  // モックのDeno.Kv
  const kv = {
    watch: () => ({
      async *[Symbol.asyncIterator]() {
        // 何も返さない
      },
    }),
  } as unknown as Deno.Kv;

  const res = handleWebSocket(req, "testroom", kv);
  assertEquals(res instanceof Response, true);
  assertEquals(res.status, 101); // Switching Protocols
});

Deno.test("handleAuthMessage: userToken認証メッセージでuserTokenが記憶される", () => {
  const socketObj = { userToken: null };
  const ok = handleAuthMessage(socketObj, JSON.stringify({ type: 'auth', userToken: 'tokentest' }));
  assertEquals(ok, true);
  assertEquals(socketObj.userToken, 'tokentest');
});

Deno.test("handleAuthMessage: 不正なメッセージは無視される", () => {
  const socketObj = { userToken: null };
  const ok = handleAuthMessage(socketObj, 'invalid json');
  assertEquals(ok, false);
  assertEquals(socketObj.userToken, null);
});

Deno.test("startRoomWatcherForRoom: room情報が更新されたらメッセージが送信される", async () => {
  // テスト用roomIdとroomデータ
  const roomId = "room1";
  const testRoom = {
    id: roomId,
    participants: [{ token: "tokentest", name: "user", answer: "" }],
    config: { allowSpectators: true, maxParticipants: 10 },
    createdAt: 1,
    updatedAt: 2,
  };
  // 送信されたメッセージを記録するモックWebSocket
  let sentMsg = null;
  const fakeSocket = {
    send: (msg: string) => { sentMsg = msg; },
    close: () => {},
    addEventListener: () => {},
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  // 型エラー回避のためsocketをunknownでキャスト
  const socketObj = { socket: fakeSocket as unknown as WebSocket, userToken: "tokentest" };
  // roomSocketsに登録
  const wsHandlers = await import("./wsHandlers.ts");
  // 型エラー回避のため@ts-ignoreを利用
  // @ts-ignore: テスト用の型不一致を許容
  wsHandlers.roomSockets.set(roomId, new Set([socketObj]));

  // モックのDeno.Kv
  const kv = {
    watch: () => ({
      async *[Symbol.asyncIterator]() {
        yield [{ key: ["rooms", roomId], value: testRoom }];
      },
    }),
  } as unknown as Deno.Kv;

  // startRoomWatcherForRoomを呼び出し
  await wsHandlers.startRoomWatcherForRoomOnce(roomId, kv);
  // メッセージが送信されたか確認
  assertEquals(typeof sentMsg, "string");
  const parsed = JSON.parse(sentMsg!);
  assertEquals(parsed.type, "room");
  assertEquals(parsed.room.id, roomId);
});
