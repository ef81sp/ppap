// Deno Deploy のエントリーポイント
import { serveStatic } from "https://deno.land/x/servest@v1.3.4/mod.ts"
import { serveDir } from "https://deno.land/std@0.209.0/http/file_server.ts"
import { addSocket } from "./backend/store/index.ts"
import { genMsgConnected } from "./wsMsg/msgFromServer.ts"
import { closeHandler, socketMessageHandler } from "./backend/socketMessageHandler.ts"

// Deno Deploy では、ビルドされた静的ファイルを含むディレクトリをデプロイする必要があります
// 静的ファイルは事前にビルドして、デプロイ時に含める必要があります

async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)

  // WebSocket のハンドリング
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

    return response
  }

  // 静的ファイルのサーブ
  if (
    pathname === "/" ||
    pathname.startsWith("/assets") ||
    pathname.endsWith(".png")
  ) {
    // Deno Deploy では、デプロイされたアセットディレクトリから静的ファイルを提供
    return serveDir(request, { fsRoot: "./dist/" })
  }

  return new Response("Not found", {
    status: 404,
    statusText: "Not found",
    headers: {
      "content-type": "text/plain",
    },
  })
}

// サーバー起動
Deno.serve(
  {
    port: Number(Deno.env.get("PORT")) || 8000,
  },
  handler,
)
