import { useWebSocket } from "@vueuse/core"
import { setRoom, user } from "./store.ts"

export function useRoomWebSocket(roomId: string) {
  // サーバーのWebSocketエンドポイントに接続
  const wsUrl = `${
    location.protocol === "https:" ? "wss" : "ws"
  }://${location.host}/ws/rooms/${roomId}`
  const { status, data, send, open, close, ws } = useWebSocket(wsUrl, {
    immediate: false, // 明示的にopen()するまで接続しない
    autoReconnect: true,
    heartbeat: { message: "ping", interval: 30000 },
    onConnected: () => {
      // 接続時にuserTokenをサーバーへ送信
      if (user.token.value) {
        send(JSON.stringify({ type: "auth", userToken: user.token.value }))
      }
    },
    onMessage: (_ws, event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "room" && msg.room) {
          setRoom(msg.room)
        }
      } catch (_e) {
        // パース失敗時は何もしない
      }
    },
  })
  return { status, data, send, open, close, ws }
}
