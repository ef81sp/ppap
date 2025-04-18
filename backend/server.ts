import { serveDir } from "https://deno.land/std@0.209.0/http/file_server.ts"
import { addSocket } from "./store/index.ts"
import { genMsgConnected } from "@/wsMsg/msgFromServer.ts"
import { closeHandler, socketMessageHandler } from "./socketMessageHandler.ts"

async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (request.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(request)

    const userToken = crypto.randomUUID()
    socket.onopen = async () => {
      console.log(`CONNECTED: ${userToken}`)
      await addSocket(userToken, socket)
      socket.send(JSON.stringify(genMsgConnected(userToken)))
    }

    socket.onmessage = async (event) => {
      if (event.data.includes("ping")) {
        socket.send("pong")
      } else {
        await socketMessageHandler(event, socket)
      }
    }

    socket.onclose = async () => {
      await closeHandler(userToken)
    }
    socket.onerror = async (error) => {
      console.error("ERROR:", error)
      await closeHandler(userToken)
    }

    return Promise.resolve(response)
  }

  if (
    pathname === "/" ||
    pathname.startsWith("/assets") ||
    pathname.endsWith(".png")
  ) {
    return serveDir(request, { fsRoot: "./dist/" })
  }
  return Promise.resolve(
    new Response("Not found", {
      status: 404,
      statusText: "Not found",
      headers: {
        "content-type": "text/plain",
      },
    }),
  )
}

Deno.serve(
  {
    port: Number(Deno.env.get("PORT")) || 8000,
  },
  handler,
)
