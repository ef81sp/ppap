import { useWebSocket } from "@vueuse/core"

export const webSocket = useWebSocket("ws://localhost:8000", {
  // heartbeat: true,
})
