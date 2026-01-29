import { assertEquals } from "jsr:@std/assert"
import { handleAuthMessage, handleWebSocket } from "./wsHandlers.ts"

Deno.test("WebSocket: upgrade request returns response", () => {
  const req = new Request("http://localhost/ws/rooms/testroom", {
    method: "GET",
    headers: {
      "upgrade": "websocket",
      "connection": "Upgrade",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
      "sec-websocket-version": "13",
    },
  })
  const kv = {
    watch: () => ({
      async *[Symbol.asyncIterator]() {},
    }),
  } as unknown as Deno.Kv

  const res = handleWebSocket(req, "testroom", kv)
  assertEquals(res instanceof Response, true)
  assertEquals(res.status, 101)
})

Deno.test(
  "handleAuthMessage: userToken認証メッセージでuserTokenが記憶される",
  () => {
    const socketObj = { userToken: null }
    const ok = handleAuthMessage(
      socketObj,
      JSON.stringify({ type: "auth", userToken: "tokentest" }),
    )
    assertEquals(ok, true)
    assertEquals(socketObj.userToken, "tokentest")
  },
)

Deno.test("handleAuthMessage: 不正なメッセージは無視される", () => {
  const socketObj = { userToken: null }
  const ok = handleAuthMessage(socketObj, "invalid json")
  assertEquals(ok, false)
  assertEquals(socketObj.userToken, null)
})

Deno.test(
  "startRoomWatcherForRoom: room情報が更新されたらメッセージが送信される",
  async () => {
    const roomId = "room1"
    const testRoom = {
      id: roomId,
      participants: [{ token: "tokentest", name: "user", answer: "" }],
      config: { allowSpectators: true, maxParticipants: 10 },
      createdAt: 1,
      updatedAt: 2,
    }
    let sentMsg = null
    const fakeSocket = {
      send: (msg: string) => {
        sentMsg = msg
      },
      close: () => {},
      addEventListener: () => {},
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    }
    const socketObj = {
      socket: fakeSocket as unknown as WebSocket,
      userToken: "tokentest",
    }
    const wsHandlers = await import("./wsHandlers.ts")
    wsHandlers.roomSockets.set(roomId, new Set([socketObj]))

    const kv = {
      watch: () => ({
        async *[Symbol.asyncIterator]() {
          yield [{ key: ["rooms", roomId], value: testRoom }]
        },
      }),
    } as unknown as Deno.Kv

    await wsHandlers.startRoomWatcherForRoomOnce(roomId, kv)
    assertEquals(typeof sentMsg, "string")
    const parsed = JSON.parse(sentMsg!)
    assertEquals(parsed.type, "room")
    assertEquals(parsed.room.id, roomId)
  },
)

Deno.test(
  "handleAuthMessage: 不正JSONでエラーは発生せず、falseを返す",
  () => {
    const socketObj = { userToken: null }
    const ok = handleAuthMessage(socketObj, "{invalid json}")
    assertEquals(ok, false)
    assertEquals(socketObj.userToken, null)
  },
)
