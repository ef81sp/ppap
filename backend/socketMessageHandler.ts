import { isMsgFromClient } from "@/wsMsg/msgFromClient.ts"
import {
  genMsgIsExistTheRoomResult,
  genMsgRoomCreated,
  genMsgRoomInfo,
  MsgFromServer,
} from "@/wsMsg/msgFromServer.ts"
import {
  answer,
  clearAnswer,
  closeEmptyRoom,
  createRoom,
  enterTheRoom,
  exitRoom,
  isExistTheRoom,
} from "./store/index.ts"
import { deleteSocket, getSocket, getStoreManager } from "./store/index.ts"
import { Room, RoomForClientSide, UserToken } from "./type.ts"

export const socketMessageHandler = async (
  event: MessageEvent,
  socket: WebSocket,
): Promise<MsgFromServer | void> => {
  console.log(`RECEIVED: ${event.data}`)
  const data = JSON.parse(event.data)
  if (isMsgFromClient(data)) {
    switch (data.type) {
      case "createRoom": {
        if (!data.userName) break
        const room = await createRoom(data.userToken, data.userName)
        const msg = genMsgRoomCreated(room.id)
        console.log("SEND:", msg)
        socket.send(JSON.stringify(msg))
        broadcastRoomInfo(room) // awaitを削除
        break
      }
      case "isExistTheRoom": {
        const exists = await isExistTheRoom(data.roomId)
        const msg = genMsgIsExistTheRoomResult(exists)
        console.log("SEND:", msg)
        socket.send(JSON.stringify(msg))
        break
      }
      case "enterTheRoom": {
        if (!data.userName) break
        const room = await enterTheRoom(data)
        if (room == undefined) break
        broadcastRoomInfo(room) // awaitを削除
        break
      }
      case "answer": {
        const room = await answer(data)
        if (room == undefined) break
        broadcastRoomInfo(room) // awaitを削除
        break
      }
      case "clearAnswer": {
        const room = await clearAnswer(data.roomId)
        if (room == undefined) break
        broadcastRoomInfo(room) // awaitを削除
        break
      }
      default:
        break
    }
  }
}

export const broadcastRoomInfo = (room: Room) => {
  const genRoomForClientSide = (
    room: Room,
    userToken: UserToken,
  ): RoomForClientSide => ({
    ...room,
    participants: room.participants.map((p, i) => ({
      name: p.name,
      answer: p.answer,
      userNumber: i,
      isMe: p.token === userToken,
    })),
  })

  // StoreManagerからKVモードかどうか確認
  const storeManager = getStoreManager()
  const isKVMode = storeManager.isUsingKV()

  console.log(`BROADCAST: ${room.id} (${isKVMode ? "KV mode" : "Memory mode"})`)

  // KVモードではWatch API経由で通知するためローカルインスタンスのユーザーにのみ直接通知
  // メモリモードでは全てのユーザーに直接通知
  if (isKVMode) {
    // KVモードでは、ローカルインスタンスに接続しているユーザーにのみ直接通知
    for (const participant of room.participants) {
      const socket = getSocket(participant.token)
      if (socket == undefined) continue
      const msg = genMsgRoomInfo(genRoomForClientSide(room, participant.token))
      console.log(`Direct notify to local user: ${participant.token.slice(0, 6)}...`)
      socket.send(JSON.stringify(msg))
    }
  } else {
    // メモリモードでは全ユーザーに直接通知
    for (const participant of room.participants) {
      const socket = getSocket(participant.token)
      if (socket == undefined) continue
      const msg = genMsgRoomInfo(genRoomForClientSide(room, participant.token))
      socket.send(JSON.stringify(msg))
    }
  }
}

export const closeHandler = async (userToken: UserToken) => {
  console.log("DISCONNECTED:", userToken)
  await deleteSocket(userToken)
  const room = await exitRoom(userToken)
  if (room?.participants?.length) {
    broadcastRoomInfo(room) // awaitを削除
  }
  await closeEmptyRoom()
}
