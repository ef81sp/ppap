import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleRejoinRoom,
} from './roomHandlers.ts';
import {
  assertEquals,
  assert,
  assertExists,
} from 'https://deno.land/std@0.203.0/assert/mod.ts';

Deno.test({
  name: 'handleCreateRoom',
  fn: async t => {
    let kv: Deno.Kv;
    let res: Response;
    let json: CreateRoomResponse;
    await t.step('setup', async () => {
      kv = await Deno.openKv('./test');
      await clearKvAll(kv);
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
      assertEquals(json.userNumber, 0);
      assert(json.room.participants.every(p => !('token' in p)));
      assertEquals(json.room.participants[0].userNumber, 0);
      assertEquals(json.room.participants[0].isMe, true);
      assertEquals(json.room.participants[0].name, 'テストユーザー');
      assertEquals(json.room.participants[0].answer, '');
    });
    await t.step('KV: 登録内容の妥当性', async () => {
      const room = await getRoom(kv, json.roomId);
      assertExists(room);
      assertEquals(room?.participants.length, 1);
      assertEquals(room?.participants[0].token, json.userToken);
      assertEquals(room?.participants[0].name, 'テストユーザー');
      assertEquals(room?.participants[0].answer, '');
      const userToken = await getUserToken(kv, json.userToken);
      assertExists(userToken);
      assertEquals(userToken?.name, 'テストユーザー');
      assertEquals(userToken?.currentRoomId, json.roomId);
      await clearKvAll(kv);
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
    let joinJson: JoinRoomResponse;
    let userToken: string;
    await t.step('setup', async () => {
      kv = await Deno.openKv('./test');
      await clearKvAll(kv);
      const reqBody: CreateRoomRequest = { userName: '参加者1' };
      const createReq = new Request('http://localhost/rooms', {
        method: 'POST',
        body: JSON.stringify(reqBody),
        headers: { 'content-type': 'application/json' },
      });
      const createRes = await handleCreateRoom(createReq, kv);
      const createJson = await createRes.json();
      roomId = createJson.roomId;
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
      assertEquals(joinJson.room.participants.length, 2);
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
    let leaveJson: LeaveRoomResponse;
    await t.step('setup', async () => {
      kv = await Deno.openKv('./test');
      await clearKvAll(kv);
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
      await clearKvAll(kv);
      kv.close();
    });
  },
});

Deno.test({
  name: 'handleRejoinRoom',
  fn: async t => {
    let kv: Deno.Kv | undefined;
    let roomId: string = '';
    let userToken: string = '';
    let rejoinRes: Response | undefined;
    let rejoinJson: RejoinRoomResponse | { error: string };
    await t.step('setup', async () => {
      kv = await Deno.openKv('./test');
      await clearKvAll(kv);
      const reqBody = { userName: '再入場ユーザー' };
      const createReq = new Request('http://localhost/rooms', {
        method: 'POST',
        body: JSON.stringify(reqBody),
        headers: { 'content-type': 'application/json' },
      });
      const createRes = await handleCreateRoom(createReq, kv);
      const createJson = await createRes.json();
      roomId = createJson.roomId;
      userToken = createJson.userToken;
    });
    await t.step('未参加者がrejoinした場合404', async () => {
      if (!kv) throw new Error('kv not initialized');
      const newUserToken = crypto.randomUUID();
      const rejoinReq = new Request(
        'http://localhost/rooms/' + roomId + '/rejoin',
        {
          method: 'POST',
          body: JSON.stringify({ userToken: newUserToken }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const res = await handleRejoinRoom(rejoinReq, roomId, kv);
      assertEquals(res.status, 404);
      const json = await res.json();
      assert('error' in json);
    });
    await t.step('参加済みユーザーがrejoinした場合200', async () => {
      if (!kv) throw new Error('kv not initialized');
      const rejoinReq = new Request(
        'http://localhost/rooms/' + roomId + '/rejoin',
        {
          method: 'POST',
          body: JSON.stringify({ userToken }),
          headers: { 'content-type': 'application/json' },
        }
      );
      rejoinRes = await handleRejoinRoom(rejoinReq, roomId, kv);
      rejoinJson = await rejoinRes.json();
      assertEquals(rejoinRes.status, 200);
      assertEquals(
        'userToken' in rejoinJson ? rejoinJson.userToken : undefined,
        userToken
      );
      assertEquals(
        'userNumber' in rejoinJson ? typeof rejoinJson.userNumber : undefined,
        'number'
      );
      assertExists('room' in rejoinJson ? rejoinJson.room : undefined);
    });
    if (kv) {
      await clearKvAll(kv);
      kv.close();
    }
  },
});

Deno.test({
  name: 'isAudienceフラグの初期値と反映',
  fn: async t => {
    let kv: Deno.Kv;
    await t.step('参加時はisAudience=false', async () => {
      kv = await Deno.openKv('./test');
      await clearKvAll(kv);
      const reqBody: CreateRoomRequest = { userName: 'A' };
      const createReq = new Request('http://localhost/rooms', {
        method: 'POST',
        body: JSON.stringify(reqBody),
        headers: { 'content-type': 'application/json' },
      });
      const createRes = await handleCreateRoom(createReq, kv);
      const createJson = await createRes.json();
      const joinReq = new Request(
        'http://localhost/rooms/' + createJson.roomId + '/join',
        {
          method: 'POST',
          body: JSON.stringify({ userName: 'B' }),
          headers: { 'content-type': 'application/json' },
        }
      );
      const joinRes = await handleJoinRoom(joinReq, createJson.roomId, kv);
      const joinJson = await joinRes.json();
      assertEquals(joinJson.room.participants[0].isAudience, false);
      assertEquals(joinJson.room.participants[1].isAudience, false);
      await clearKvAll(kv);
      kv.close();
    });
    await t.step(
      'isAudience=trueで保存した場合toRoomForClientで反映',
      async () => {
        kv = await Deno.openKv('./test');
        await clearKvAll(kv);
        const reqBody: CreateRoomRequest = { userName: 'A' };
        const createReq = new Request('http://localhost/rooms', {
          method: 'POST',
          body: JSON.stringify(reqBody),
          headers: { 'content-type': 'application/json' },
        });
        const createRes = await handleCreateRoom(createReq, kv);
        const createJson = await createRes.json();
        const room = await getRoom(kv, createJson.roomId);
        if (room) {
          room.participants[0].isAudience = true;
          await kv.atomic().set(['rooms', createJson.roomId], room).commit();
        }
        const rejoinReq = new Request(
          'http://localhost/rooms/' + createJson.roomId + '/rejoin',
          {
            method: 'POST',
            body: JSON.stringify({ userToken: createJson.userToken }),
            headers: { 'content-type': 'application/json' },
          }
        );
        const rejoinRes = await handleRejoinRoom(
          rejoinReq,
          createJson.roomId,
          kv
        );
        const rejoinJson = await rejoinRes.json();
        assertEquals(rejoinJson.room.participants[0].isAudience, true);
        await clearKvAll(kv);
        kv.close();
      }
    );
  },
});
