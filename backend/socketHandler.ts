import { isMsgFromClient } from "@/wsMsg/msgFromClient.ts"


const rooms: Map<RoomId, Room> = new Map()

export const socketHandler = (request: Request): Promise<Response> => {
  const { socket, response } = Deno.upgradeWebSocket(request)


  socket.onopen = () => {
    console.log("CONNECTED")
  }
  socket.onmessage = (event) => {
    if (event.data.includes("ping")) {
      socket.send("pong")
    } else {

    }
    return Promise.resolve(response)
  }

  socket.onclose = () => console.log("DISCONNECTED")
  socket.onerror = (error) => console.error("ERROR:", error)

  return Promise.resolve(response)
}
