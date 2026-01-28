import { Room } from "../type.ts"
import { toRoomForClient } from "./roomHandlers.ts"
import { DisconnectTimerManager } from "../utils/disconnectTimer.ts"
import { updateParticipant, updateAllParticipants } from "../utils/updateParticipant.ts"

// --- ルームごとのWebSocket接続管理 ---
type SocketWithToken = { socket: WebSocket; userToken: string | null }
const roomSockets = new Map<string, Set<SocketWithToken>>()
// --- ルームごとのwatcher起動管理 ---
const roomWatchers = new Map<string, boolean>()
// --- 切断時の退室タイマー管理 ---
const disconnectTimers = new DisconnectTimerManager()

export function handleWebSocket(
  request: Request,
  roomId: string,
  kv: Deno.Kv,
  upgradeWebSocket: (req: Request) => {
    socket: WebSocket
    response: Response
  } = Deno.upgradeWebSocket,
): Response {
  if (request.headers.get("upgrade") != "websocket") {
    return new Response("Not a websocket request", { status: 400 })
  }
  const { socket, response } = upgradeWebSocket(request)
  // ルームごとにソケットを管理
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set())
  // userTokenは最初はnull、後でクライアントから受信してセット
  const socketObj: SocketWithToken = { socket, userToken: null }
  roomSockets.get(roomId)!.add(socketObj)

  // --- 再接続時の退室キャンセル ---
  function cancelDisconnectTimer(userToken: string | null) {
    if (!userToken) return
    disconnectTimers.cancel(roomId, userToken)
  }

  socket.onopen = () => {
    console.log(`WebSocket connected for room: ${roomId}`)
    // ルームごとに一度だけwatcherを起動
    if (!roomWatchers.has(roomId)) {
      startRoomWatcherForRoom(roomId, kv)
      roomWatchers.set(roomId, true)
    }
    // 再接続時の退室キャンセル
    cancelDisconnectTimer(socketObj.userToken)
  }
  socket.onmessage = async (event) => {
    if (handleAuthMessage(socketObj, event.data)) {
      // 認証時（userToken受信時）にも退室キャンセル
      cancelDisconnectTimer(socketObj.userToken)
      return
    }
    if (event.data === "ping") {
      socket.send("pong")
      return
    }
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === "answer") {
        const answer = msg.answer
        if (typeof answer === "string" && socketObj.userToken) {
          await updateParticipant(kv, roomId, socketObj.userToken, (p) => {
            p.answer = answer
          })
        }
      } else if (
        msg.type === "setAudience" &&
        typeof msg.isAudience === "boolean" &&
        socketObj.userToken
      ) {
        await updateParticipant(kv, roomId, socketObj.userToken, (p) => {
          p.isAudience = msg.isAudience
        })
      } else if (msg.type === "clearAnswer" && socketObj.userToken) {
        await updateAllParticipants(kv, roomId, (p) => {
          p.answer = ""
        })
      }
    } catch (_e: unknown) {
      console.error(
        (_e as WebSocketError)?.message || "WebSocket message error",
      )
    }
  }
  socket.onclose = () => {
    roomSockets.get(roomId)?.delete(socketObj)
    console.log(`WebSocket closed for room: ${roomId}`)
    // --- 2秒後に退室・トークン削除タイマー ---
    if (socketObj.userToken) {
      const userToken = socketObj.userToken
      disconnectTimers.set(roomId, userToken, async () => {
        const kvmod = await import("../kv.ts")
        await kvmod.leaveRoom(kv, { roomId, userToken })
      }, 2000)
    }
  }
  socket.onerror = (e) => {
    console.error(`WebSocket error:`, e)
  }
  return response
}

// --- テストしやすいようuserToken認証処理を分離 ---
export function handleAuthMessage(
  socketObj: { userToken: string | null },
  data: string,
) {
  try {
    const msg = JSON.parse(data)
    if (msg.type === "auth" && typeof msg.userToken === "string") {
      socketObj.userToken = msg.userToken
      return true
    }
  } catch (e) {
    console.error("Auth message parse error:", e instanceof Error ? e.message : "Unknown error")
  }
  return false
}

// --- ルームごとに個別にwatcherを起動 ---
function startRoomWatcherForRoom(roomId: string, kv: Deno.Kv) {
  ;(async () => {
    const iter = kv.watch([["rooms", roomId]])
    for await (const entries of iter) {
      for (const entry of entries) {
        const key = entry.key
        const value = entry.value
        if (!Array.isArray(key) || key[0] !== "rooms" || key[1] !== roomId) {
          continue
        }
        const sockets = roomSockets.get(roomId)
        if (!sockets || sockets.size === 0) continue
        for (const wsObj of sockets) {
          if (!wsObj.userToken) continue // userToken未登録はスキップ
          try {
            const roomForClient = toRoomForClient(
              value as import("../type.ts").Room,
              wsObj.userToken,
            )
            const msg = JSON.stringify({ type: "room", room: roomForClient })
            wsObj.socket.send(msg)
          } catch (e) {
            console.error(
              "Failed to send room update:",
              e instanceof Error ? e.message : "Unknown error",
            )
          }
        }
      }
    }
  })()
}

// --- テスト用: 1回だけ監視して終了するwatcher ---
export async function startRoomWatcherForRoomOnce(roomId: string, kv: Deno.Kv) {
  const iter = kv.watch({ prefix: ["rooms", roomId] } as any)
  for await (const entries of iter) {
    for (const entry of entries) {
      const key = entry.key
      const value = entry.value
      if (!Array.isArray(key) || key[0] !== "rooms" || key[1] !== roomId) {
        continue
      }
      const sockets = roomSockets.get(roomId)
      if (!sockets || sockets.size === 0) continue
      for (const wsObj of sockets) {
        if (!wsObj.userToken) continue
        try {
          const roomForClient = toRoomForClient(
            value as import("../type.ts").Room,
            wsObj.userToken,
          )
          const msg = JSON.stringify({ type: "room", room: roomForClient })
          wsObj.socket.send(msg)
        } catch (e) {
          console.error(
            "Failed to send room update:",
            e instanceof Error ? e.message : "Unknown error",
          )
        }
      }
    }
    break // 1回だけで終了
  }
}

// --- テスト用にエクスポート ---
export { roomSockets, startRoomWatcherForRoom }
