import { Room, RoomId, UserToken, UserTokenInfo } from "./type.ts"

// KVのキー生成
export function roomKey(roomId: RoomId): Deno.KvKey {
  // 戻り値を Deno.KvKey に変更
  return ["rooms", roomId] // 文字列の配列として返す
}
export function userTokenKey(token: UserToken): Deno.KvKey {
  // 戻り値を Deno.KvKey に変更
  return ["user_tokens", token] // 文字列の配列として返す
}

// Room CRUD
export async function createRoom(kv: Deno.Kv, room: Room): Promise<void> {
  await kv
    .atomic()
    .set(roomKey(room.id), room) // 修正されたキー関数を使用
    .commit()
}
export async function getRoom(
  kv: Deno.Kv,
  roomId: RoomId,
): Promise<Room | null> {
  const res = await kv.get<Room>(roomKey(roomId)) // 修正されたキー関数を使用
  return res.value ?? null
}
export async function updateRoom(kv: Deno.Kv, room: Room): Promise<void> {
  await kv
    .atomic()
    .set(roomKey(room.id), room) // 修正されたキー関数を使用
    .commit()
}
export async function deleteRoom(kv: Deno.Kv, roomId: RoomId): Promise<void> {
  await kv
    .atomic()
    .delete(roomKey(roomId)) // 修正されたキー関数を使用
    .commit()
}

// UserToken CRUD
export async function createUserToken(
  kv: Deno.Kv,
  info: UserTokenInfo,
): Promise<void> {
  await kv
    .atomic()
    .set(userTokenKey(info.token), info) // 修正されたキー関数を使用
    .commit()
}
export async function getUserToken(
  kv: Deno.Kv,
  token: UserToken,
): Promise<UserTokenInfo | null> {
  const res = await kv.get<UserTokenInfo>(userTokenKey(token)) // 修正されたキー関数を使用
  return res.value ?? null
}
export async function updateUserToken(
  kv: Deno.Kv,
  info: UserTokenInfo,
): Promise<void> {
  await kv
    .atomic()
    .set(userTokenKey(info.token), info) // 修正されたキー関数を使用
    .commit()
}
export async function deleteUserToken(
  kv: Deno.Kv,
  token: UserToken,
): Promise<void> {
  await kv
    .atomic()
    .delete(userTokenKey(token)) // 修正されたキー関数を使用
    .commit()
}

export async function leaveRoom(
  kv: Deno.Kv,
  options: {
    room?: Room
    roomId?: RoomId
    userToken: UserToken
  },
): Promise<{ ok: boolean; error?: string }> {
  let { room, roomId, userToken } = options as { room: Room | null | undefined, roomId: RoomId | undefined, userToken: UserToken };
  // room, roomIdがなければuserTokenから取得
  if (!room || !roomId) {
    const userTokenInfo = await getUserToken(kv, userToken)
    if (!userTokenInfo || !userTokenInfo.currentRoomId) {
      return { ok: false, error: "Room or roomId not found for userToken" }
    }
    roomId = userTokenInfo.currentRoomId
    room = await getRoom(kv, roomId)
    if (!room) {
      return { ok: false, error: "Room not found" }
    }
  }
  // 指定ユーザーを除外したroomを作成
  const idx = room.participants.findIndex((p) => p.token === userToken)
  if (idx !== -1) {
    room.participants.splice(idx, 1)
    room.updatedAt = Date.now()
  }
  const atomic = kv.atomic()
  if (room.participants.length === 0) {
    atomic.delete(roomKey(roomId))
  } else {
    atomic.set(roomKey(roomId), room)
  }
  atomic.delete(userTokenKey(userToken))
  const result = await atomic.commit()
  if (!result.ok) {
    return { ok: false, error: "Failed to update room or delete user token" }
  }
  return { ok: true }
}
