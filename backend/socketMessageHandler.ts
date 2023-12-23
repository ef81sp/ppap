import { isMsgFromClient } from "../wsMsg/msgFromClient.ts"
import { MsgFromServer, gemMsgRoomCreated } from "../wsMsg/msgFromServer.ts";
import { createRoom } from "./store/rooms.ts";

type msg = string

export const socketMessageHandler = (event: MessageEvent): MsgFromServer | void => {
  console.log(`RECEIVED: ${event.data}`)
  const data = JSON.parse(event.data)
  if (isMsgFromClient(data)) {
    switch (data.type) {
      case "createRoom": {
        const roomId = createRoom(data.userToken, data.userName)
        return gemMsgRoomCreated(roomId)
      }
      default:
        break
    }
  }
}
