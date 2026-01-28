import { serveDir } from "jsr:@std/http/file-server"
import { handleKvDebugRequest } from "../debug_kv_view/kv_debug_handler.ts"
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleRejoinRoom,
} from "./handlers/roomHandlers.ts"
import { handleWebSocket } from "./handlers/wsHandlers.ts"
import { csrfMiddleware, validateWebSocketOrigin } from "./middleware/csrf.ts"
import { extractRoomId } from "./utils/extractRoomId.ts"

const kv = await Deno.openKv()

async function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)

  // KV Debug Viewer (Development Only)
  if (Deno.env.get("APP_ENV") === "development") {
    const debugResponse = await handleKvDebugRequest(request)
    if (debugResponse) {
      return debugResponse
    }
  }

  // CSRF対策: API/WebSocketリクエストのOrigin検証
  if (pathname.startsWith("/api/")) {
    const csrfResponse = await csrfMiddleware(request)
    if (csrfResponse) {
      return csrfResponse
    }
  }

  if (request.method === "POST" && pathname === "/api/rooms") {
    return handleCreateRoom(request, kv)
  }
  if (request.method === "POST" && pathname.endsWith("/join")) {
    const roomId = extractRoomId(pathname)
    if (roomId) return handleJoinRoom(request, roomId, kv)
  }
  if (request.method === "POST" && pathname.endsWith("/leave")) {
    const roomId = extractRoomId(pathname)
    if (roomId) return handleLeaveRoom(request, roomId, kv)
  }
  if (request.method === "POST" && pathname.endsWith("/rejoin")) {
    const roomId = extractRoomId(pathname)
    if (roomId) return handleRejoinRoom(request, roomId, kv)
  }
  if (request.method === "GET" && pathname.startsWith("/ws/rooms/")) {
    const roomId = extractRoomId(pathname)
    if (roomId) {
      // WebSocket接続時のOrigin検証
      if (!validateWebSocketOrigin(request)) {
        return new Response(JSON.stringify({ error: "Invalid origin" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        })
      }
      return handleWebSocket(request, roomId, kv)
    }
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
