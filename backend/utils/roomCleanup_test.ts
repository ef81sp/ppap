import { assertEquals } from "std/assert/mod.ts"
import { cleanupEmptyRoom, getRoomSocketCount } from "./roomCleanup.ts"

Deno.test("cleanupEmptyRoom", async (t) => {
  await t.step("空のルームを削除する", () => {
    const roomSockets = new Map<string, Set<unknown>>()
    const roomWatchers = new Map<string, boolean>()

    // 空のSetを持つルームを追加
    roomSockets.set("room1", new Set())
    roomWatchers.set("room1", true)

    const cleaned = cleanupEmptyRoom("room1", roomSockets, roomWatchers)

    assertEquals(cleaned, true)
    assertEquals(roomSockets.has("room1"), false)
    assertEquals(roomWatchers.has("room1"), false)
  })

  await t.step("ソケットがあるルームは削除しない", () => {
    const roomSockets = new Map<string, Set<unknown>>()
    const roomWatchers = new Map<string, boolean>()

    // ソケットがあるルーム
    const sockets = new Set<unknown>()
    sockets.add({ socket: {}, userToken: "token1" })
    roomSockets.set("room1", sockets)
    roomWatchers.set("room1", true)

    const cleaned = cleanupEmptyRoom("room1", roomSockets, roomWatchers)

    assertEquals(cleaned, false)
    assertEquals(roomSockets.has("room1"), true)
    assertEquals(roomWatchers.has("room1"), true)
  })

  await t.step("存在しないルームはfalseを返す", () => {
    const roomSockets = new Map<string, Set<unknown>>()
    const roomWatchers = new Map<string, boolean>()

    const cleaned = cleanupEmptyRoom("nonexistent", roomSockets, roomWatchers)

    assertEquals(cleaned, false)
  })
})

Deno.test("getRoomSocketCount", async (t) => {
  await t.step("ルームのソケット数を取得する", () => {
    const roomSockets = new Map<string, Set<unknown>>()
    const sockets = new Set<unknown>()
    sockets.add({ socket: {}, userToken: "token1" })
    sockets.add({ socket: {}, userToken: "token2" })
    roomSockets.set("room1", sockets)

    assertEquals(getRoomSocketCount("room1", roomSockets), 2)
  })

  await t.step("存在しないルームは0を返す", () => {
    const roomSockets = new Map<string, Set<unknown>>()

    assertEquals(getRoomSocketCount("nonexistent", roomSockets), 0)
  })

  await t.step("空のルームは0を返す", () => {
    const roomSockets = new Map<string, Set<unknown>>()
    roomSockets.set("room1", new Set())

    assertEquals(getRoomSocketCount("room1", roomSockets), 0)
  })
})
