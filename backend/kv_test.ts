import {
  createRoom,
  createUserToken,
  createUserTokenWithTTL,
  deleteRoom,
  deleteUserToken,
  getRoom,
  getUserToken,
  updateRoom,
  updateUserToken,
  DEFAULT_TOKEN_TTL_MS,
} from "./kv.ts"
import { Room, UserTokenInfo } from "./type.ts"

Deno.test("Room CRUD", async () => {
  const kv = await Deno.openKv()
  try {
    const room: Room = {
      id: "testroom",
      participants: [],
      config: { allowSpectators: true, maxParticipants: 50 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await createRoom(kv, room)
    const loaded = await getRoom(kv, room.id)
    if (!loaded) throw new Error("Room not found")
    await updateRoom(kv, loaded)
    const updated = await getRoom(kv, room.id)
    if (!updated) throw new Error("Room update failed")
    await deleteRoom(kv, room.id)
    const deleted = await getRoom(kv, room.id)
    if (deleted) throw new Error("Room delete failed")
  } finally {
    kv.close()
  }
})

Deno.test("UserToken CRUD", async () => {
  const kv = await Deno.openKv()
  try {
    const info: UserTokenInfo = {
      token: "usertoken1",
      currentRoomId: "testroom",
      name: "テストユーザー",
      isSpectator: false,
      lastAccessedAt: Date.now(),
    }
    await createUserToken(kv, info)
    const loaded = await getUserToken(kv, info.token)
    if (!loaded || loaded.name !== "テストユーザー") {
      throw new Error("UserToken get failed")
    }
    loaded.name = "変更後"
    await updateUserToken(kv, loaded)
    const updated = await getUserToken(kv, info.token)
    if (!updated || updated.name !== "変更後") {
      throw new Error("UserToken update failed")
    }
    await deleteUserToken(kv, info.token)
    const deleted = await getUserToken(kv, info.token)
    if (deleted) throw new Error("UserToken delete failed")
  } finally {
    kv.close()
  }
})

Deno.test("UserToken TTL", async (t) => {
  const kv = await Deno.openKv()
  try {
    await t.step("DEFAULT_TOKEN_TTL_MSが24時間である", () => {
      const expectedMs = 24 * 60 * 60 * 1000 // 24時間
      if (DEFAULT_TOKEN_TTL_MS !== expectedMs) {
        throw new Error(`Expected ${expectedMs}ms but got ${DEFAULT_TOKEN_TTL_MS}ms`)
      }
    })

    await t.step("createUserTokenWithTTLでTTL付きトークンが作成できる", async () => {
      const info: UserTokenInfo = {
        token: "ttl-test-token-" + Date.now(),
        currentRoomId: "testroom",
        name: "TTLテスト",
        isSpectator: false,
        lastAccessedAt: Date.now(),
      }
      // TTL付きで作成してもエラーにならない
      await createUserTokenWithTTL(kv, info, 60000)

      // 作成直後は取得できる
      const loaded = await getUserToken(kv, info.token)
      if (!loaded) {
        throw new Error("Token should exist after creation")
      }
      if (loaded.name !== "TTLテスト") {
        throw new Error("Token data should match")
      }

      // クリーンアップ
      await deleteUserToken(kv, info.token)
    })
  } finally {
    kv.close()
  }
})
