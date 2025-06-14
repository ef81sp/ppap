import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
} from './roomHandlers.ts';
import {
  assertEquals,
  assert,
  assertExists,
} from 'https://deno.land/std@0.203.0/assert/mod.ts';
import { CreateRoomRequest } from '../type.ts';
import { getRoom, getUserToken } from '../kv.ts';

Deno.test({
  name: 'handleCreateRoom',
  fn: async t => {
    let kv: Deno.Kv;
    let res: Response;
    let json: any;
    await t.step('setup', async () => {
      kv = await Deno.openKv();
      const reqBody: CreateRoomRequest = {
        userName: 'テストユーザー',
      };
      const req = new Request('http://localhost/rooms', {
        method: 'POST',
        body: JSON.stringify(reqBody),
        headers: { 'content-type': 'application/json' },
      });
      res = await handleCreateRoom(req, kv);
      json = await res.json();
    });
    await t.step('レスポンス: 正常系', () => {
      assertEquals(res.status, 201);
      assertExists(json.roomId);
      assertExists(json.userToken);
      assertExists(json.room);
    });
    await t.step('KV: 登録内容の妥当性', async () => {
      const room = await getRoom(kv, json.roomId);
      assertExists(room);
      assertEquals(room?.participants.length, 1);
      const userToken = await getUserToken(kv, json.userToken);
      assertExists(userToken);
      assertEquals(userToken?.name, 'テストユーザー');
      assertEquals(userToken?.currentRoomId, json.roomId);
      kv.close();
    });
  },
});

Deno.test({
  name: 'handleJoinRoom',
  fn: async t => {
    let kv: Deno.Kv;
    let roomId: string;
    let joinRes: Response;
    let joinJson: any;
    let userToken: string;
    await t.step('setup', async () => {
      kv = await Deno.openKv();
      // ルーム作成
      const reqBody: CreateRoomRequest = { userName: '参加者1' };
      const createReq = new Request('http://localhost/rooms', {
        method: 'POST',
        body: JSON.stringify(reqBody),
        headers: { 'content-type': 'application/json' },
      });
      const createRes = await handleCreateRoom(createReq, kv);
      const createJson = await createRes.json();
      roomId = createJson.roomId;
      // 参加
      const req = new Request('http://localhost/rooms/' + roomId + '/join', {
        method: 'POST',
        body: JSON.stringify({ userName: '参加者2' }),
        headers: { 'content-type': 'application/json' },
      });
      joinRes = await handleJoinRoom(req, roomId, kv);
      joinJson = await joinRes.json();
      userToken = joinJson.userToken;
    });
    await t.step('レスポンス: 正常系', () => {
      assertEquals(joinRes.status, 200);
      assertExists(joinJson.userToken);
      assertExists(joinJson.room);
      assertEquals(joinJson.room.id, roomId);
      assert(joinJson.room.participants.includes(joinJson.userToken));
      assertEquals(joinJson.room.participants.length, 2);
    });
    await t.step('KV: 参加後の内容', async () => {
      const room = await getRoom(kv, roomId);
      assertExists(room);
      assert(room?.participants.includes(userToken));
      assertEquals(room?.participants.length, 2);
      const user = await getUserToken(kv, userToken);
      assertExists(user);
      assertEquals(user?.name, '参加者2');
      assertEquals(user?.currentRoomId, roomId);
      kv.close();
    });
  },
});

Deno.test({
  name: 'handleLeaveRoom',
  fn: async t => {
    let kv: Deno.Kv;
    let roomId: string;
    let userToken: string;
    let leaveRes: Response;
    let leaveJson: any;
    await t.step('setup', async () => {
      kv = await Deno.openKv();
      // ルーム作成
      const reqBody: CreateRoomRequest = { userName: '離脱ユーザー' };
      const createReq = new Request('http://localhost/rooms', {
        method: 'POST',
        body: JSON.stringify(reqBody),
        headers: { 'content-type': 'application/json' },
      });
      const createRes = await handleCreateRoom(createReq, kv);
      const createJson = await createRes.json();
      roomId = createJson.roomId;
      userToken = createJson.userToken;
      // 離脱
      const req = new Request('http://localhost/rooms/' + roomId + '/leave', {
        method: 'POST',
        body: JSON.stringify({ userToken }),
        headers: { 'content-type': 'application/json' },
      });
      leaveRes = await handleLeaveRoom(req, roomId, kv);
      leaveJson = await leaveRes.json();
    });
    await t.step('レスポンス: 正常系', () => {
      assertEquals(leaveRes.status, 200);
      assertEquals(leaveJson.message, 'Successfully left the room');
    });
    await t.step('KV: 離脱後の内容', async () => {
      const room = await getRoom(kv, roomId);
      assertEquals(room, null);
      const user = await getUserToken(kv, userToken);
      assertEquals(user, null);
      kv.close();
    });
  },
});
