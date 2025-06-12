import {
  assertEquals,
  assert,
} from 'https://deno.land/std@0.203.0/assert/mod.ts';
import { Room, UserTokenInfo } from './type.ts';
import {
  createRoom,
  getRoom,
  updateRoom,
  deleteRoom,
  createUserToken,
  getUserToken,
  updateUserToken,
  deleteUserToken,
} from './kv.ts';

Deno.test('Room CRUD: 正常系', async () => {
  const kv = await Deno.openKv();
  try {
    const room: Room = {
      id: 'room1',
      name: 'ルーム1',
      participants: [],
      answers: {},
      config: { allowSpectators: true, maxParticipants: 50 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await createRoom(kv, room);
    const loaded = await getRoom(kv, room.id);
    assert(loaded);
    assertEquals(loaded.name, 'ルーム1');
    loaded.name = 'ルーム1-更新';
    await updateRoom(kv, loaded);
    const updated = await getRoom(kv, room.id);
    assert(updated);
    assertEquals(updated.name, 'ルーム1-更新');
    await deleteRoom(kv, room.id);
    const deleted = await getRoom(kv, room.id);
    assertEquals(deleted, null);
  } finally {
    kv.close();
  }
});

Deno.test('UserToken CRUD: 正常系', async () => {
  const kv = await Deno.openKv();
  try {
    const info: UserTokenInfo = {
      token: 'token1',
      currentRoomId: 'room1',
      name: 'ユーザー1',
      isSpectator: false,
      lastAccessedAt: Date.now(),
    };
    await createUserToken(kv, info);
    const loaded = await getUserToken(kv, info.token);
    assert(loaded);
    assertEquals(loaded.name, 'ユーザー1');
    loaded.name = 'ユーザー1-更新';
    await updateUserToken(kv, loaded);
    const updated = await getUserToken(kv, info.token);
    assert(updated);
    assertEquals(updated.name, 'ユーザー1-更新');
    await deleteUserToken(kv, info.token);
    const deleted = await getUserToken(kv, info.token);
    assertEquals(deleted, null);
  } finally {
    kv.close();
  }
});
