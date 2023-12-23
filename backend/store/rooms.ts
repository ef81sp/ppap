import { Room, RoomId, UserToken } from "../../backend/type.ts"

const rooms: Map<RoomId, Room> = new Map()

const userRooms: Map<UserToken, RoomId> = new Map()

export const getRooms = () => rooms
export const createRoom = (userToken: UserToken, userName: string): Room => {
  const roomId = crypto.randomUUID()
  const room: Room = {
    id: roomId,
    participants: [
      {
        token: userToken,
        name: userName,
        answer: "",
      },
    ],
    isOpen: false,
  }
  rooms.set(roomId, room)
  userRooms.set(userToken, roomId)
  console.log("ROOM CREATED:", roomId)
  return room
}
export const closeEmptyRoom = () => {
  for (const [id, room] of rooms) {
    if (room.participants.length === 0) {
      rooms.delete(id)
    }
  }
}
export const isExistTheRoom = (roomId: RoomId) => {
  return rooms.has(roomId)
}
export const enterTheRoom = ({
  roomId,
  userName,
  userToken,
}: {
  roomId: RoomId
  userToken: UserToken
  userName: string
}) => {
  const room = rooms.get(roomId)
  if (room == undefined) return
  room.participants.push({
    token: userToken,
    name: userName,
    answer: "",
  })
  sortParticipants(room)
}
export const exit = (userToken: UserToken) => {
  const roomId = userRooms.get(userToken)
  if (roomId == undefined) return
  const room = rooms.get(roomId)
  if (room == undefined) return
  room.participants = room.participants.filter((v) => v.token !== userToken)
  sortParticipants(room)
}

const sortParticipants = (room: Room) => {
  room.participants.sort((a, b) => {
    if (a.token > b.token) return 1
    if (a.token < b.token) return -1
    return 0
  })
}
