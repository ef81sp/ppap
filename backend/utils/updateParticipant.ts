import { Room } from "../type.ts"

type Participant = Room["participants"][number]

export async function updateParticipant(
  kv: Deno.Kv,
  roomId: string,
  userToken: string,
  updater: (participant: Participant) => void,
): Promise<boolean> {
  const roomRes = await kv.get<Room>(["rooms", roomId])
  const room = roomRes.value
  if (!room) return false

  const participant = room.participants.find((p) => p.token === userToken)
  if (!participant) return false

  updater(participant)
  room.updatedAt = Date.now()
  await kv.atomic().set(["rooms", roomId], room).commit()

  return true
}

export async function updateAllParticipants(
  kv: Deno.Kv,
  roomId: string,
  updater: (participant: Participant) => void,
): Promise<boolean> {
  const roomRes = await kv.get<Room>(["rooms", roomId])
  const room = roomRes.value
  if (!room) return false

  for (const participant of room.participants) {
    updater(participant)
  }
  room.updatedAt = Date.now()
  await kv.atomic().set(["rooms", roomId], room).commit()

  return true
}
