import { Room, RoomId, UserToken } from "../../backend/type.ts"
import { deleteSocket, getSocket } from "./sockets.ts"

const rooms: Map<RoomId, Room> = new Map()

const roomsUserAt: Map<UserToken, RoomId> = new Map()
const latestUpdateOfRoom: Map<RoomId, Date> = new Map()

// 5分に1回、30分間更新のないルームを閉じる
const thresholdMs = 30 * 1000 * 60
setInterval(() => {
  console.log("polling...")
  const now = Date.now()
  const idleRoomIds = [...latestUpdateOfRoom]
    .filter(([, date]) => now - date.getTime() > thresholdMs)
    .map(([roomId]) => roomId)
  for (const roomId of idleRoomIds) {
    console.log("room closed:", roomId)
    closeRoom(roomId)
  }
}, 5 * 1000 * 60)

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
  roomsUserAt.set(userToken, roomId)
  console.log("room created:", roomId)
  latestUpdateOfRoom.set(roomId, new Date())
  return room
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
}): Room | void => {
  const room = rooms.get(roomId)
  if (room == undefined) return
  room.participants.push({
    token: userToken,
    name: userName,
    answer: "",
  })
  sortParticipants(room)
  latestUpdateOfRoom.set(roomId, new Date())
  roomsUserAt.set(userToken, roomId)

  return room
}

export const answer = ({
  roomId,
  userToken,
  answer,
}: {
  roomId: RoomId
  userToken: UserToken
  answer: string
}): Room | void => {
  const room = rooms.get(roomId)
  if (room == undefined) return
  const user = room.participants.find((u) => u.token === userToken)
  if (user == undefined) return
  user.answer = answer
  if (room.participants.every((u) => u.answer !== "")) {
    room.isOpen = true
  }
  latestUpdateOfRoom.set(roomId, new Date())
  return room
}
export const clearAnswer = (roomId: RoomId): Room | void => {
  const room = rooms.get(roomId)
  if (room == undefined) return
  for (const p of room.participants) {
    p.answer = ""
  }
  room.isOpen = false
  latestUpdateOfRoom.set(roomId, new Date())
  return room
}

export const exitRoom = (userToken: UserToken): Room | void => {
  const roomId = roomsUserAt.get(userToken)
  if (roomId == undefined) return
  const room = rooms.get(roomId)
  if (room == undefined) return
  room.participants = room.participants.filter((v) => v.token !== userToken)
  sortParticipants(room)
  roomsUserAt.delete(userToken)
  latestUpdateOfRoom.set(roomId, new Date())
  return room
}
export const closeEmptyRoom = () => {
  for (const [id, room] of rooms) {
    if (room.participants.length === 0) {
      rooms.delete(id)
      latestUpdateOfRoom.delete(id)
    }
  }
}
const closeRoom = (roomId: RoomId) => {
  const room = rooms.get(roomId)
  if (room == undefined) return
  // 残っているユーザーを全員切断
  for (const p of room.participants) {
    const socket = getSocket(p.token)
    if (socket == undefined) continue
    socket.close()
    deleteSocket(p.token)
    roomsUserAt.delete(p.token)
  }
  latestUpdateOfRoom.delete(roomId)
  rooms.delete(roomId)
}

const sortParticipants = (room: Room) => {
  room.participants.sort((a, b) => {
    if (a.token > b.token) return 1
    if (a.token < b.token) return -1
    return 0
  })
}
