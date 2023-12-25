import { isMsgFromClient } from "../wsMsg/msgFromClient.ts"
import {
  MsgFromServer,
  genMsgIsExistTheRoomResult,
  genMsgRoomCreated,
  genMsgRoomInfo,
} from "../wsMsg/msgFromServer.ts"
import {
  answer,
  clearAnswer,
  closeEmptyRoom,
  createRoom,
  enterTheRoom,
  exitRoom,
  isExistTheRoom,
} from "./store/rooms.ts"
import { deleteSocket, getSocket } from "./store/sockets.ts"
import { Room, RoomForClientSide, UserToken } from "./type.ts"

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
        const room = enterTheRoom(data)
        if (room == undefined) break
        broadcastRoomInfo(room)
        break
      }
      case "answer": {
        const room = answer(data)
        if (room == undefined) break
        broadcastRoomInfo(room)
        break
      }
      case "clearAnswer": {
        const room = clearAnswer(data.roomId)
        if (room == undefined) break
        broadcastRoomInfo(room)
        break
      }
      default:
        break
    }
  }
}

export const broadcastRoomInfo = (room: Room) => {
  const roomForResponse: RoomForClientSide = {
    ...room,
    participants: room.participants.map((p, i) => ({
      name: p.name,
      answer: p.answer,
      userNumber: i,
    })),
  }

  const msg = genMsgRoomInfo(roomForResponse)

  console.log("BROADCAST:", room.id, "/", msg)
  for (const participant of room.participants) {
    const socket = getSocket(participant.token)
    if (socket == undefined) continue

    socket.send(JSON.stringify(msg))
  }
}

export const closeHandler = (userToken: UserToken) => {
  console.log("DISCONNECTED:", userToken)
  deleteSocket(userToken)
  const room = exitRoom(userToken)
  if (room?.participants?.length) {
    broadcastRoomInfo(room)
  }
  closeEmptyRoom()
}