import { assertEquals } from "jsr:@std/assert"
import { extractRoomId } from "./extractRoomId.ts"

Deno.test("extractRoomId", async (t) => {
  await t.step("join URLからroomIdを抽出できる", () => {
    const result = extractRoomId("/api/rooms/abc-123/join")
    assertEquals(result, "abc-123")
  })

  await t.step("leave URLからroomIdを抽出できる", () => {
    const result = extractRoomId("/api/rooms/room-456/leave")
    assertEquals(result, "room-456")
  })

  await t.step("rejoin URLからroomIdを抽出できる", () => {
    const result = extractRoomId("/api/rooms/xyz-789/rejoin")
    assertEquals(result, "xyz-789")
  })

  await t.step("WebSocket URLからroomIdを抽出できる", () => {
    const result = extractRoomId("/ws/rooms/ws-room-id")
    assertEquals(result, "ws-room-id")
  })

  await t.step("UUID形式のroomIdを抽出できる", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    const result = extractRoomId(`/api/rooms/${uuid}/join`)
    assertEquals(result, uuid)
  })

  await t.step("マッチしないURLはnullを返す", () => {
    assertEquals(extractRoomId("/api/rooms"), null)
    assertEquals(extractRoomId("/api/rooms/"), null)
    assertEquals(extractRoomId("/api/users/123"), null)
    assertEquals(extractRoomId("/other/path"), null)
  })

  await t.step("空文字列はnullを返す", () => {
    assertEquals(extractRoomId(""), null)
  })
})
