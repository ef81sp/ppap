import { Room, UserTokenInfo } from "../type.ts"
import { CreateRoomRequest, CreateRoomResponse, RoomForClient } from "../type.ts"
import { CreateRoomRequestSchema, JoinRoomRequestSchema } from "../validate.ts"
import { createRoom, createUserToken, DEFAULT_TOKEN_TTL_MS, leaveRoom, roomKey, userTokenKey } from "../kv.ts"
import { JsonParseError, parseJsonBody } from "../utils/parseJsonBody.ts"

const invalidJsonResponse = () =>
  new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })

// 競合発生時の最大リトライ回数
const JOIN_ROOM_MAX_RETRIES = 3

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
    body = await parseJsonBody<CreateRoomRequest>(req)
  } catch (e) {
    if (e instanceof JsonParseError) return invalidJsonResponse()
    throw e
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
  } catch (e) {
    console.error(
      "Failed to create room:",
      e instanceof Error ? e.message : "Unknown error",
    )
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
  let body: unknown
  try {
    body = await parseJsonBody<unknown>(req)
  } catch (e) {
    if (e instanceof JsonParseError) return invalidJsonResponse()
    throw e
  }
  const parse = JoinRoomRequestSchema.safeParse(body)
  if (!parse.success) {
    return new Response(JSON.stringify({ error: "Validation error" }), {
      status: 400,
    })
  }
  const { userName, userToken: bodyUserToken } = parse.data
  const userToken = bodyUserToken ?? crypto.randomUUID()

  for (let attempt = 0; attempt < JOIN_ROOM_MAX_RETRIES; attempt++) {
    const roomRes = await kv.get<Room>(roomKey(roomId))
    const room = roomRes.value
    if (!room) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
      })
    }

    const now = Date.now()
    const existingTokenInfo = (await kv.get<UserTokenInfo>(userTokenKey(userToken))).value
    const userTokenInfo: UserTokenInfo = {
      token: userToken,
      currentRoomId: roomId,
      name: userName,
      isSpectator: existingTokenInfo?.isSpectator ?? false,
      lastAccessedAt: now,
    }

    const alreadyJoined = room.participants.some((p) => p.token === userToken)
    if (!alreadyJoined) {
      room.participants.push({
        token: userToken,
        name: userName,
        answer: "",
        isAudience: false,
      })
      room.updatedAt = now
    }

    const atomic = kv.atomic()
    atomic.check({ key: roomKey(roomId), versionstamp: roomRes.versionstamp })
    atomic.set(userTokenKey(userToken), userTokenInfo, { expireIn: DEFAULT_TOKEN_TTL_MS })
    if (!alreadyJoined) {
      atomic.set(roomKey(roomId), room)
    }

    const result = await atomic.commit()
    if (result.ok) {
      const userNumber = room.participants.findIndex((p) => p.token === userToken)
      return new Response(
        JSON.stringify({
          userToken,
          userNumber,
          room: toRoomForClient(room, userToken),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    console.log(`Join room conflict, retrying (attempt ${attempt + 1}/${JOIN_ROOM_MAX_RETRIES})`)
  }

  return new Response(
    JSON.stringify({ error: "Server busy, please try again" }),
    { status: 503 },
  )
}

export async function handleLeaveRoom(
  req: Request,
  roomId: string,
  kv: Deno.Kv,
): Promise<Response> {
  let body: { userToken: string }
  try {
    body = await parseJsonBody<{ userToken: string }>(req)
  } catch (e) {
    if (e instanceof JsonParseError) return invalidJsonResponse()
    throw e
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
    body = await parseJsonBody<{ userToken: string }>(req)
  } catch (e) {
    if (e instanceof JsonParseError) return invalidJsonResponse()
    throw e
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
