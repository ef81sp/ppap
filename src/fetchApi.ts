import type {
  JoinRoomRequest,
  JoinRoomResponse,
  RejoinRoomRequest,
  RejoinRoomResponse,
} from "@/backend/type.ts"

// 503エラー時に指数バックオフでリトライするラッパー
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  for (let i = 0; i <= maxRetries; i++) {
    const res = await fetch(url, options)
    if (res.status === 503 && i < maxRetries) {
      const delay = Math.min(500 * Math.pow(2, i), 2000)
      await new Promise((r) => setTimeout(r, delay))
      continue
    }
    return res
  }
  throw new Error("unreachable")
}

export async function joinRoomApi(
  roomId: string,
  req: JoinRoomRequest,
): Promise<JoinRoomResponse> {
  const res = await fetchWithRetry(`/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    throw new Error("ルーム参加APIに失敗しました")
  }
  return await res.json()
}

export async function rejoinRoomApi(
  roomId: string,
  req: RejoinRoomRequest,
): Promise<RejoinRoomResponse> {
  const res = await fetch(`/api/rooms/${roomId}/rejoin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    throw new Error("再入場APIに失敗しました")
  }
  return await res.json()
}
