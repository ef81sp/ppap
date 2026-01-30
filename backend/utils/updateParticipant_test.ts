import { assertEquals } from "jsr:@std/assert"
import { updateParticipant, updateAllParticipants } from "./updateParticipant.ts"
import { Room } from "../type.ts"

function createMockKv(initialRoom: Room | null) {
  let storedRoom = initialRoom
  return {
    get: async (_key: Deno.KvKey) => ({
      value: storedRoom,
      key: ["rooms", "test-room"],
      versionstamp: "1",
    }),
    atomic: () => ({
      set: (_key: Deno.KvKey, value: Room) => {
        storedRoom = value
        return {
          commit: async () => ({ ok: true, versionstamp: "2" }),
        }
      },
    }),
    getStoredRoom: () => storedRoom,
  } as unknown as Deno.Kv & { getStoredRoom: () => Room | null }
}

const createTestRoom = (): Room => ({
  id: "test-room",
  participants: [
    { token: "user1", name: "User 1", answer: "", isAudience: false },
    { token: "user2", name: "User 2", answer: "", isAudience: false },
  ],
  config: { allowSpectators: true, maxParticipants: 10 },
  createdAt: 1000,
  updatedAt: 1000,
})

Deno.test("updateParticipant", async (t) => {
  await t.step("参加者のanswerを更新できる", async () => {
    const room = createTestRoom()
    const kv = createMockKv(room)

    const result = await updateParticipant(kv, "test-room", "user1", (p) => {
      p.answer = "5"
    })

    assertEquals(result, true)
    assertEquals(kv.getStoredRoom()?.participants[0].answer, "5")
    assertEquals(kv.getStoredRoom()?.participants[1].answer, "")
  })

  await t.step("参加者のisAudienceを更新できる", async () => {
    const room = createTestRoom()
    const kv = createMockKv(room)

    const result = await updateParticipant(kv, "test-room", "user2", (p) => {
      p.isAudience = true
    })

    assertEquals(result, true)
    assertEquals(kv.getStoredRoom()?.participants[1].isAudience, true)
  })

  await t.step("存在しないルームの場合falseを返す", async () => {
    const kv = createMockKv(null)

    const result = await updateParticipant(kv, "test-room", "user1", (p) => {
      p.answer = "5"
    })

    assertEquals(result, false)
  })

  await t.step("存在しない参加者の場合falseを返す", async () => {
    const room = createTestRoom()
    const kv = createMockKv(room)

    const result = await updateParticipant(kv, "test-room", "nonexistent", (p) => {
      p.answer = "5"
    })

    assertEquals(result, false)
  })

  await t.step("updatedAtが更新される", async () => {
    const room = createTestRoom()
    const kv = createMockKv(room)

    await updateParticipant(kv, "test-room", "user1", (p) => {
      p.answer = "5"
    })

    assertEquals(kv.getStoredRoom()!.updatedAt > 1000, true)
  })
})

Deno.test("updateAllParticipants", async (t) => {
  await t.step("全参加者のanswerをクリアできる", async () => {
    const room = createTestRoom()
    room.participants[0].answer = "3"
    room.participants[1].answer = "5"
    const kv = createMockKv(room)

    const result = await updateAllParticipants(kv, "test-room", (p) => {
      p.answer = ""
    })

    assertEquals(result, true)
    assertEquals(kv.getStoredRoom()?.participants[0].answer, "")
    assertEquals(kv.getStoredRoom()?.participants[1].answer, "")
  })

  await t.step("存在しないルームの場合falseを返す", async () => {
    const kv = createMockKv(null)

    const result = await updateAllParticipants(kv, "test-room", (p) => {
      p.answer = ""
    })

    assertEquals(result, false)
  })
})
