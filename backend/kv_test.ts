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
import { Room, UserTokenInfo } from './type.ts';

Deno.test('Room CRUD', async () => {
  const kv = await Deno.openKv();
  try {
    const room: Room = {
      id: 'testroom',
      participants: [],
      config: { allowSpectators: true, maxParticipants: 50 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await createRoom(kv, room);
    const loaded = await getRoom(kv, room.id);
    if (!loaded) throw new Error('Room not found');
    await updateRoom(kv, loaded);
    const updated = await getRoom(kv, room.id);
    if (!updated) throw new Error('Room update failed');
    await deleteRoom(kv, room.id);
    const deleted = await getRoom(kv, room.id);
    if (deleted) throw new Error('Room delete failed');
  } finally {
    kv.close();
  }
});

Deno.test('UserToken CRUD', async () => {
  const kv = await Deno.openKv();
  try {
    const info: UserTokenInfo = {
      token: 'usertoken1',
      currentRoomId: 'testroom',
      name: 'テストユーザー',
      isSpectator: false,
      lastAccessedAt: Date.now(),
    };
    await createUserToken(kv, info);
    const loaded = await getUserToken(kv, info.token);
    if (!loaded || loaded.name !== 'テストユーザー')
      throw new Error('UserToken get failed');
    loaded.name = '変更後';
    await updateUserToken(kv, loaded);
    const updated = await getUserToken(kv, info.token);
    if (!updated || updated.name !== '変更後')
      throw new Error('UserToken update failed');
    await deleteUserToken(kv, info.token);
    const deleted = await getUserToken(kv, info.token);
    if (deleted) throw new Error('UserToken delete failed');
  } finally {
    kv.close();
  }
});
