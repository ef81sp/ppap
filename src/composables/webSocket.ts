import { useWebSocket } from "@vueuse/core"
import { isMsgFromServer } from "@/wsMsg/msgFromServer.ts"
import { room, setRoom, setToken, user } from "./store.ts"
import { ref, watch } from "vue"
import { genMsgAnswer, genMsgClearAnswer } from "../../wsMsg/msgFromClient.ts"

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
    case "roomInfo": {
      setRoom(msg.room)
      break
    }
    default:
      break
  }
}

// ====================

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
