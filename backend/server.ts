import { serveDir } from "https://deno.land/std@0.209.0/http/file_server.ts"
import { addSocket } from "./store/sockets.ts"
import { genMsgConnected } from "../wsMsg/msgFromServer.ts"
import { closeHandler, socketMessageHandler } from "./socketMessageHandler.ts"
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
      closeHandler(userToken)
    }
    socket.onerror = (error) => console.error("ERROR:", error)

    return Promise.resolve(response)
  }

  if (
    pathname === "/" ||
    pathname.startsWith("/assets") ||
    pathname.endsWith(".png")
  ) {
    return serveDir(request, { fsRoot: "./dist/" })
  }
  return Promise.resolve(new Response("TEMPORARY OK"))
}

Deno.serve(
  {
    port: Number(Deno.env.get("PORT")) || 8000,
  },
  handler,
)
