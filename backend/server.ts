import { serveDir } from "https://deno.land/std@0.209.0/http/file_server.ts"
import { addSocket, deleteSocket } from "./store/sockets.ts"
import { genMsgConnected } from "../wsMsg/msgFromServer.ts"
import { closeEmptyRoom } from "./store/rooms.ts"
import { socketMessageHandler } from "./socketMessageHandler.ts"
function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (request.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(request)

    const userToken = crypto.randomUUID()
    socket.onopen = () => {
      console.log(`CONNECTED: ${userToken}`)
      addSocket(userToken, socket)
      socket.send(JSON.stringify(genMsgConnected(userToken)))
    }

    socket.onmessage = (event) => {
      if (event.data.includes("ping")) {
        socket.send("pong")
      } else {
        socketMessageHandler(event, socket)
      }
    }

    socket.onclose = () => {
      console.log("DISCONNECTED")
      deleteSocket(userToken)
      closeEmptyRoom()
    }
    socket.onerror = (error) => console.error("ERROR:", error)

    return Promise.resolve(response)
  }

  if (
    pathname === "/" ||
    pathname.startsWith("/assets") ||
    pathname.endsWith(".svg")
  ) {
    return serveDir(request, { fsRoot: "./dist/" })
  }
  return Promise.resolve(new Response("TEMPORARY OK"))
}

Deno.serve(handler)
