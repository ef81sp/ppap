import { Room, UserTokenInfo } from "../type.ts"
import { CreateRoomRequest, CreateRoomResponse, RoomForClient } from "../type.ts"
import { CreateRoomRequestSchema } from "../validate.ts"
import { createRoom, createUserToken, leaveRoom, roomKey, userTokenKey } from "../kv.ts"

export function toRoomForClient(room: Room, userToken: string): RoomForClient {
  return {
    id: room.id,
    participants: room.participants.map((p, i) => ({
      name: p.name,
      userNumber: i,
      isMe: p.token === userToken,
      answer: p.answer,
      isAudience: p.isAudience ?? false,
    })),
    config: room.config,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  }
}

export async function handleCreateRoom(
  req: Request,
  kv: Deno.Kv,
): Promise<Response> {
  let body: CreateRoomRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    })
  }
  const parse = CreateRoomRequestSchema.safeParse(body)
  if (!parse.success) {
    return new Response(JSON.stringify({ error: "Validation error" }), {
      status: 400,
    })
  }
  const { userName } = parse.data
  const roomId = crypto.randomUUID()
  const userToken = crypto.randomUUID()
  const now = Date.now()
  const room: Room = {
    id: roomId,
    participants: [
      { token: userToken, name: userName, answer: "", isAudience: false },
    ],
    config: { allowSpectators: true, maxParticipants: 50 },
    createdAt: now,
    updatedAt: now,
  }
  const userTokenInfo: UserTokenInfo = {
    token: userToken,
    currentRoomId: roomId,
    name: userName,
    isSpectator: false,
    lastAccessedAt: now,
  }
  try {
    await createRoom(kv, room)
    await createUserToken(kv, userTokenInfo)
    const userNumber = 0
    const res = {
      roomId,
      userToken,
      userNumber,
      room: toRoomForClient(room, userToken),
    }
    return new Response(JSON.stringify(res), {
      status: 201,
      headers: { "content-type": "application/json" },
    })
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
    })
  }
}

export async function handleJoinRoom(
  req: Request,
  roomId: string,
  kv: Deno.Kv,
): Promise<Response> {
  let body: { userName: string; userToken?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    })
  }
  if (
    !body.userName ||
    typeof body.userName !== "string" ||
    body.userName.length > 24
  ) {
    return new Response(JSON.stringify({ error: "Validation error" }), {
      status: 400,
    })
  }
  const roomRes = await kv.get<Room>(roomKey(roomId))
  const room = roomRes.value
  if (!room) {
    return new Response(JSON.stringify({ error: "Room not found" }), {
      status: 404,
    })
  }
  let userToken = body.userToken
  if (!userToken) {
    userToken = crypto.randomUUID()
  }
  const userTokenInfoRes = await kv.get<UserTokenInfo>(userTokenKey(userToken))
  let userTokenInfo = userTokenInfoRes.value
  if (!userTokenInfo) {
    userTokenInfo = {
      token: userToken,
      currentRoomId: roomId,
      name: body.userName,
      isSpectator: false,
      lastAccessedAt: Date.now(),
    }
    await kv.atomic().set(userTokenKey(userToken), userTokenInfo).commit()
  } else {
    userTokenInfo = {
      ...userTokenInfo,
      currentRoomId: roomId,
      name: body.userName,
      lastAccessedAt: Date.now(),
    }
    await kv.atomic().set(userTokenKey(userToken), userTokenInfo).commit()
  }
  if (!room.participants.some((p) => p.token === userToken)) {
    room.participants.push({
      token: userToken,
      name: body.userName,
      answer: "",
      isAudience: false,
    })
    room.updatedAt = Date.now()
    await kv.atomic().set(roomKey(roomId), room).commit()
  }
  const userNumber = room.participants.findIndex((p) => p.token === userToken)
  return new Response(
    JSON.stringify({
      userToken,
      userNumber,
      room: toRoomForClient(room, userToken),
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  )
}

export async function handleLeaveRoom(
  req: Request,
  roomId: string,
  kv: Deno.Kv,
): Promise<Response> {
  let body: { userToken: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    })
  }
  if (!body.userToken || typeof body.userToken !== "string") {
    return new Response(JSON.stringify({ error: "Validation error" }), {
      status: 400,
    })
  }
  // leaveRoomの新しい呼び出し方に対応
  const result = await leaveRoom(kv, { roomId, userToken: body.userToken })
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 500,
    })
  }
  return new Response(
    JSON.stringify({ message: "Successfully left the room" }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  )
}

export async function handleRejoinRoom(
  req: Request,
  roomId: string,
  kv: Deno.Kv,
): Promise<Response> {
  let body: { userToken: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    })
  }
  const userToken = body.userToken
  if (!userToken || typeof userToken !== "string") {
    return new Response(JSON.stringify({ error: "Validation error" }), {
      status: 400,
    })
  }
  const userTokenInfoRes = await kv.get<UserTokenInfo>(userTokenKey(userToken))
  const userTokenInfo = userTokenInfoRes.value
  if (!userTokenInfo) {
    return new Response(
      JSON.stringify({ error: "User not found or invalid token" }),
      {
        status: 404,
      },
    )
  }
  const roomRes = await kv.get<Room>(roomKey(roomId))
  const room = roomRes.value
  if (!room) {
    return new Response(JSON.stringify({ error: "Room not found" }), {
      status: 404,
    })
  }
  const participant = room.participants.find((p) => p.token === userToken)
  if (!participant) {
    return new Response(
      JSON.stringify({ error: "User not joined in this room" }),
      {
        status: 404,
      },
    )
  }
  const userNumber = room.participants.findIndex((p) => p.token === userToken)
  return new Response(
    JSON.stringify({
      userToken,
      userNumber,
      room: toRoomForClient(room, userToken),
      userName: participant.name,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  )
}
