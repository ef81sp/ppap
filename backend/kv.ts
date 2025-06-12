import { Room, RoomId, UserToken, UserTokenInfo } from './type.ts';

// KVのキー生成
export function roomKey(roomId: RoomId): string {
  return `rooms:${roomId}`;
}
export function userTokenKey(token: UserToken): string {
  return `user_tokens:${token}`;
}

// Room CRUD
export async function createRoom(kv: Deno.Kv, room: Room): Promise<void> {
  await kv
    .atomic()
    .set([roomKey(room.id)], room)
    .commit();
}
export async function getRoom(
  kv: Deno.Kv,
  roomId: RoomId
): Promise<Room | null> {
  const res = await kv.get<Room>([roomKey(roomId)]);
  return res.value ?? null;
}
export async function updateRoom(kv: Deno.Kv, room: Room): Promise<void> {
  await kv
    .atomic()
    .set([roomKey(room.id)], room)
    .commit();
}
export async function deleteRoom(kv: Deno.Kv, roomId: RoomId): Promise<void> {
  await kv
    .atomic()
    .delete([roomKey(roomId)])
    .commit();
}

// UserToken CRUD
export async function createUserToken(
  kv: Deno.Kv,
  info: UserTokenInfo
): Promise<void> {
  await kv
    .atomic()
    .set([userTokenKey(info.token)], info)
    .commit();
}
export async function getUserToken(
  kv: Deno.Kv,
  token: UserToken
): Promise<UserTokenInfo | null> {
  const res = await kv.get<UserTokenInfo>([userTokenKey(token)]);
  return res.value ?? null;
}
export async function updateUserToken(
  kv: Deno.Kv,
  info: UserTokenInfo
): Promise<void> {
  await kv
    .atomic()
    .set([userTokenKey(info.token)], info)
    .commit();
}
export async function deleteUserToken(
  kv: Deno.Kv,
  token: UserToken
): Promise<void> {
  await kv
    .atomic()
    .delete([userTokenKey(token)])
    .commit();
}
