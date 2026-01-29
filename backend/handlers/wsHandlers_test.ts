import { assertEquals } from "jsr:@std/assert"
import { handleAuthMessage, handleWebSocket, sendCurrentRoomState } from "./wsHandlers.ts"
import { Room } from "../type.ts"
import { clearKvAll } from "../clear_kv.ts"

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

Deno.test({
  name: "sendCurrentRoomState: Room情報を正しく送信する",
  fn: async () => {
    const kv = await Deno.openKv("./test")
    await clearKvAll(kv)

    // Room作成
    const room: Room = {
      id: "test-room",
      participants: [{ token: "user1", name: "テスト", answer: "", isAudience: false }],
      config: { allowSpectators: true, maxParticipants: 50 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await kv.set(["rooms", "test-room"], room)

    // モックWebSocket
    const sentMessages: string[] = []
    const mockSocket = {
      send: (data: string) => sentMessages.push(data),
    } as unknown as WebSocket

    const socketObj = { socket: mockSocket, userToken: "user1" as string | null }

    await sendCurrentRoomState(kv, "test-room", socketObj)

    assertEquals(sentMessages.length, 1)
    const msg = JSON.parse(sentMessages[0])
    assertEquals(msg.type, "room")
    assertEquals(msg.room.id, "test-room")
    assertEquals(msg.room.participants.length, 1)

    await clearKvAll(kv)
    kv.close()
  },
})

Deno.test({
  name: "sendCurrentRoomState: userTokenがnullの場合は送信しない",
  fn: async () => {
    const kv = await Deno.openKv("./test")

    const sentMessages: string[] = []
    const mockSocket = {
      send: (data: string) => sentMessages.push(data),
    } as unknown as WebSocket

    const socketObj = { socket: mockSocket, userToken: null as string | null }

    await sendCurrentRoomState(kv, "test-room", socketObj)

    assertEquals(sentMessages.length, 0)

    kv.close()
  },
})
