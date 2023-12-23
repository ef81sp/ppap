import { isMsgFromClient } from "../wsMsg/msgFromClient.ts"
import {
  MsgFromServer,
  genMsgIsExistTheRoomResult,
  genMsgRoomCreated,
  genMsgRoomInfo,
} from "../wsMsg/msgFromServer.ts"
import { createRoom, enterTheRoom, getRooms, isExistTheRoom } from "./store/rooms.ts"
import { getSocket } from "./store/sockets.ts"
import { Room, RoomForClientSide } from "./type.ts"

export const socketMessageHandler = (
  event: MessageEvent,
  socket: WebSocket
): MsgFromServer | void => {
  console.log(`RECEIVED: ${event.data}`)
  const data = JSON.parse(event.data)
  if (isMsgFromClient(data)) {
    switch (data.type) {
      case "createRoom": {
        const room = createRoom(data.userToken, data.userName)
        const msg = genMsgRoomCreated(room.id)
        console.log("SEND:", msg)
        socket.send(JSON.stringify(msg))
        broadcastRoomInfo(room)
        break
      }
      case "isExistTheRoom": {
        const msg = genMsgIsExistTheRoomResult(isExistTheRoom(data.roomId))
        console.log("SEND:", msg)
        socket.send(JSON.stringify(msg))
        break
      }
      case "enterTheRoom": {
        enterTheRoom(data)
        const room = getRooms().get(data.roomId)
        if (room == undefined) break
        broadcastRoomInfo(room)
        break
      }
      case "answer": {
        const room = getRooms().get(data.roomId)
        if (room == undefined) break
        const user = room.participants.find(u=>u.token === data.userToken)
        if (user == undefined) break
        user.answer = data.answer
        if (room.participants.every(u=>u.answer !== "")) {
          room.isOpen = true
        }
        broadcastRoomInfo(room)
        break
      }
      case "clearAnswer": {
        const room = getRooms().get(data.roomId)
        if (room == undefined) break
        for (const p of room.participants) {
          p.answer = ""
        }
        room.isOpen = false
        broadcastRoomInfo(room)
        break
      }
      default:
        break
    }
  }
}

const broadcastRoomInfo = (room: Room) => {
  const roomForresponse: RoomForClientSide = {
    ...room,
    participants: room.participants.map((p, i) => ({
      name: p.name,
      answer: p.answer,
      userNumber: i
    })),
  }
  const msg = genMsgRoomInfo(roomForresponse)
  console.log("BROADCAST:", room.id, "/", msg)
  for (const participant of room.participants) {
    const socket = getSocket(participant.token)
    if (socket == undefined) continue
    socket.send(JSON.stringify(msg))
  }
}
