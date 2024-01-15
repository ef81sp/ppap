import { useWebSocket } from "@vueuse/core"
import { isMsgFromServer } from "../../wsMsg/msgFromServer.ts"
import { room, setName, setRoom, setRoomId, setToken, user } from "./store.ts"
import router from "../router/router.ts"
import { ref, watch } from "vue"
import {
  genMsgAnswer,
  genMsgClearAnswer,
  genMsgCreateRoom,
  genMsgEnterTheRoom,
  genMsgIsExistTheRoom,
} from "../../wsMsg/msgFromClient.ts"
import { RoomId } from "../../backend/type.ts"

const protocol = location.protocol === "https:" ? "wss:" : "ws:"
const url = import.meta.env.DEV
  ? `${protocol}${import.meta.env.VITE_WEBSOCKET_HOST}`
  : `${protocol}${location.host}`

export const webSocket = useWebSocket<string>(url, {
  heartbeat: true,
  autoReconnect: true,
})

watch(webSocket.data, (newData) => {
  msgHandler(newData)
})
watch(webSocket.status, (newStatus) => {
  if (newStatus === "CLOSED") location.href = "/"
})

export const isRoomCreator = ref(false)

const msgHandler = (data: string | null) => {
  if (data === null) return
  if (data === "pong") return
  const msg = JSON.parse(data)
  if (!isMsgFromServer(msg)) return
  switch (msg.type) {
    case "connected": {
      setToken(msg.userToken)
      break
    }
    case "roomCreated": {
      setRoomId(msg.roomId)

      sessionStorage.setItem("roomId", msg.roomId)
      sessionStorage.setItem("userName", user.name.value)
      router.push(`/${msg.roomId}`)
      break
    }
    case "isExistTheRoomResult": {
      if (!msg.isExistTheRoom) {
        sessionStorage.clear()
        router.push("/")
      }
      break
    }
    case "roomInfo": {
      setRoom(msg.room)
      break
    }
    default:
      break
  }
}

// ====================

export const sendCreateRoom = (name: string) => {
  setName(name)
  isRoomCreator.value = true
  webSocket.send(
    JSON.stringify(genMsgCreateRoom(user.token.value, user.name.value)),
  )
}
export const sendIsExistTheRoom = (roomId: RoomId) => {
  webSocket.send(JSON.stringify(genMsgIsExistTheRoom(roomId)))
}
export const sendEnterTheRoom = (roomId: RoomId, userName: string) => {
  webSocket.send(
    JSON.stringify(
      genMsgEnterTheRoom({
        roomId,
        userToken: user.token.value,
        userName: userName,
      }),
    ),
  )
}
export const sendAnswer = (answer: string) => {
  webSocket.send(
    JSON.stringify(
      genMsgAnswer({
        userToken: user.token.value,
        roomId: room.value.id,
        answer,
      }),
    ),
  )
}
export const sendClearAnswer = () => {
  webSocket.send(JSON.stringify(genMsgClearAnswer(room.value.id)))
}
