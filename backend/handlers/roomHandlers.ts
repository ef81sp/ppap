import { Room, UserTokenInfo } from '../type.ts';
import { CreateRoomRequest, CreateRoomResponse } from '../type.ts';
import { CreateRoomRequestSchema } from '../validate.ts';
import { createRoom, createUserToken } from '../kv.ts';

export async function handleCreateRoom(req: Request, kv: Deno.Kv): Promise<Response> {
  let body: CreateRoomRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    });
  }
  const parse = CreateRoomRequestSchema.safeParse(body);
  if (!parse.success) {
    return new Response(JSON.stringify({ error: 'Validation error' }), {
      status: 400,
    });
  }
  const { roomName, userName } = parse.data;
  const roomId = crypto.randomUUID();
  const userToken = crypto.randomUUID();
  const now = Date.now();
  const room: Room = {
    id: roomId,
    name: roomName ?? 'ルーム',
    participants: [userToken],
    answers: {},
    config: { allowSpectators: true, maxParticipants: 50 },
    createdAt: now,
    updatedAt: now,
  };
  const userTokenInfo: UserTokenInfo = {
    token: userToken,
    currentRoomId: roomId,
    name: userName,
    isSpectator: false,
    lastAccessedAt: now,
  };
  try {
    await createRoom(kv, room);
    await createUserToken(kv, userTokenInfo);
    const res: CreateRoomResponse = {
      roomId,
      userToken,
      room,
    };
    return new Response(JSON.stringify(res), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
    });
  }
}

export async function handleJoinRoom(req: Request, roomId: string, kv: Deno.Kv): Promise<Response> {
  let body: { userName: string; userToken?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    });
  }
  if (!body.userName || typeof body.userName !== 'string' || body.userName.length > 24) {
    return new Response(JSON.stringify({ error: 'Validation error' }), {
      status: 400,
    });
  }
  const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
  const room = roomRes.value;
  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
    });
  }
  let userToken = body.userToken;
  if (!userToken) {
    userToken = crypto.randomUUID();
  }
  const userTokenInfoRes = await kv.get<UserTokenInfo>([`user_tokens:${userToken}`]);
  let userTokenInfo = userTokenInfoRes.value;
  if (!userTokenInfo) {
    userTokenInfo = {
      token: userToken,
      currentRoomId: roomId,
      name: body.userName,
      isSpectator: false,
      lastAccessedAt: Date.now(),
    };
    await kv.atomic().set([`user_tokens:${userToken}`], userTokenInfo).commit();
  } else {
    userTokenInfo = {
      ...userTokenInfo,
      currentRoomId: roomId,
      name: body.userName,
      lastAccessedAt: Date.now(),
    };
    await kv.atomic().set([`user_tokens:${userToken}`], userTokenInfo).commit();
  }
  if (!room.participants.includes(userToken)) {
    room.participants.push(userToken);
    room.updatedAt = Date.now();
    await kv.atomic().set([`rooms:${roomId}`], room).commit();
  }
  return new Response(JSON.stringify({ userToken, room }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

export async function handleLeaveRoom(req: Request, roomId: string, kv: Deno.Kv): Promise<Response> {
  let body: { userToken: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
    });
  }
  if (!body.userToken || typeof body.userToken !== 'string') {
    return new Response(JSON.stringify({ error: 'Validation error' }), {
      status: 400,
    });
  }
  const roomRes = await kv.get<Room>([`rooms:${roomId}`]);
  const room = roomRes.value;
  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
    });
  }
  const userTokenInfoRes = await kv.get<UserTokenInfo>([`user_tokens:${body.userToken}`]);
  const userTokenInfo = userTokenInfoRes.value;
  if (!userTokenInfo || userTokenInfo.currentRoomId !== roomId) {
    return new Response(JSON.stringify({ error: 'Invalid userToken' }), {
      status: 400,
    });
  }
  const idx = room.participants.indexOf(body.userToken);
  if (idx !== -1) {
    room.participants.splice(idx, 1);
    room.updatedAt = Date.now();
    await kv.atomic().set([`rooms:${roomId}`], room).commit();
  }
  userTokenInfo.currentRoomId = null;
  userTokenInfo.lastAccessedAt = Date.now();
  await kv.atomic().set([`user_tokens:${body.userToken}`], userTokenInfo).commit();
  return new Response(
    JSON.stringify({ message: 'Successfully left the room' }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
