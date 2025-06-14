import { Room, RoomId, UserToken, UserTokenInfo } from './type.ts';

// KVのキー生成
export function roomKey(roomId: RoomId): Deno.KvKey {
  // 戻り値を Deno.KvKey に変更
  return ['rooms', roomId]; // 文字列の配列として返す
}
export function userTokenKey(token: UserToken): Deno.KvKey {
  // 戻り値を Deno.KvKey に変更
  return ['user_tokens', token]; // 文字列の配列として返す
}

// Room CRUD
export async function createRoom(kv: Deno.Kv, room: Room): Promise<void> {
  await kv
    .atomic()
    .set(roomKey(room.id), room) // 修正されたキー関数を使用
    .commit();
}
export async function getRoom(
  kv: Deno.Kv,
  roomId: RoomId
): Promise<Room | null> {
  const res = await kv.get<Room>(roomKey(roomId)); // 修正されたキー関数を使用
  return res.value ?? null;
}
export async function updateRoom(kv: Deno.Kv, room: Room): Promise<void> {
  await kv
    .atomic()
    .set(roomKey(room.id), room) // 修正されたキー関数を使用
    .commit();
}
export async function deleteRoom(kv: Deno.Kv, roomId: RoomId): Promise<void> {
  await kv
    .atomic()
    .delete(roomKey(roomId)) // 修正されたキー関数を使用
    .commit();
}

// UserToken CRUD
export async function createUserToken(
  kv: Deno.Kv,
  info: UserTokenInfo
): Promise<void> {
  await kv
    .atomic()
    .set(userTokenKey(info.token), info) // 修正されたキー関数を使用
    .commit();
}
export async function getUserToken(
  kv: Deno.Kv,
  token: UserToken
): Promise<UserTokenInfo | null> {
  const res = await kv.get<UserTokenInfo>(userTokenKey(token)); // 修正されたキー関数を使用
  return res.value ?? null;
}
export async function updateUserToken(
  kv: Deno.Kv,
  info: UserTokenInfo
): Promise<void> {
  await kv
    .atomic()
    .set(userTokenKey(info.token), info) // 修正されたキー関数を使用
    .commit();
}
export async function deleteUserToken(
  kv: Deno.Kv,
  token: UserToken
): Promise<void> {
  await kv
    .atomic()
    .delete(userTokenKey(token)) // 修正されたキー関数を使用
    .commit();
}

export async function leaveRoom(
  kv: Deno.Kv,
  room: Room,
  roomId: RoomId,
  userToken: UserToken
): Promise<{ ok: boolean; error?: string }> {
  const atomic = kv.atomic();
  if (room.participants.length === 0) {
    // 参加者が0人ならroom自体も削除
    atomic.delete(roomKey(roomId));
  } else {
    atomic.set(roomKey(roomId), room);
  }
  atomic.delete(userTokenKey(userToken));
  atomic.delete([`user_rooms:${userToken}`]);
  const result = await atomic.commit();
  if (!result.ok) {
    return { ok: false, error: 'Failed to update room or delete user token' };
  }
  return { ok: true };
}
