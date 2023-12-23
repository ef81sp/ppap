import { Room, RoomId, UserToken } from "../../backend/type.ts"

const rooms: Map<RoomId, Room> = new Map()

export const getRooms = () => rooms
export const createRoom = (userToken: UserToken, userName: string): RoomId => {
  const roomId = crypto.randomUUID()
  const room: Room = {
    id: roomId,
    participants: [
      {
        token: userToken,
        name: userName,
        answer: ""
      },
    ],
    answers: new Map(),
  }
  rooms.set(roomId, room)
  console.log("ROOM CREATED:", roomId)
  return roomId
}
export const closeEmptyRoom = () => {
  for (const [id, room] of rooms) {
    if (room.participants.length === 0) {
      rooms.delete(id)
    }
  }
}
