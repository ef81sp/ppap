import { serveDir } from "jsr:@std/http/file-server"
import { dirname, fromFileUrl, join } from "jsr:@std/path"

// publicディレクトリの絶対パスを取得
const __dirname = dirname(fromFileUrl(import.meta.url))
const publicDir = join(__dirname, "public")

let kv: Deno.Kv | undefined
const sockets = new Set<WebSocket>()
let watcherInitialized = false

async function initializeKv() {
  if (!kv) {
    console.log("Opening Deno KV store for debug viewer...")
    kv = await Deno.openKv()
    console.log("Deno KV store opened for debug viewer.")
  }
  return kv
}

async function getAllKvData() {
  if (!kv) await initializeKv()
  const entries = []
  try {
    for await (const entry of kv!.list({ prefix: [] })) {
      entries.push({
        key: entry.key.join(" : "),
        value: JSON.stringify(entry.value, null, 2),
        versionstamp: entry.versionstamp,
      })
    }
  } catch (e) {
    console.error("Error listing KV entries for debug view:", e)
    throw e // エラーを呼び出し元に伝える
  }
  return entries
}

async function initializeWatcher() {
  if (watcherInitialized) return
  await initializeKv()
  watcherInitialized = true

  console.log("Starting polling-based KV watcher for debug view...")
  let lastDataJson = ""
  setInterval(async () => {
    try {
      const currentData = await getAllKvData()
      const currentDataJson = JSON.stringify(currentData)
      if (currentDataJson !== lastDataJson) {
        console.log("KV store changed (polling debug view)")
        lastDataJson = currentDataJson
        for (const socket of sockets) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "update", data: currentData }))
          }
        }
      }
    } catch (err) {
      console.error("Polling KV watcher error (debug view):", err)
    }
  }, 1000) // 1秒ごとに監視
}

export async function handleKvDebugRequest(
  req: Request,
): Promise<Response | undefined> {
  if (Deno.env.get("APP_ENV") !== "development") {
    return undefined // 開発モードでない場合は何もしない
  }

  await initializeKv() // KVストアの初期化を試みる
  if (!watcherInitialized) {
    await initializeWatcher() // ウォッチャーの初期化を試みる
  }

  const url = new URL(req.url)
  const pathname = url.pathname

  // KVデバッグビューのWebSocketエンドポイント
  if (pathname === "/ws/kv-debug") {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("request isn't trying to upgrade to websocket.", {
        status: 400,
      })
    }
    const { socket, response } = Deno.upgradeWebSocket(req)
    sockets.add(socket)
    socket.onopen = async () => {
      try {
        const currentData = await getAllKvData()
        socket.send(JSON.stringify({ type: "initial", data: currentData }))
      } catch (e) {
        console.error("Error sending initial KV data to debug client:", e)
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Could not fetch initial KV data.",
          }),
        )
      }
    }
    socket.onclose = () => {
      sockets.delete(socket)
    }
    socket.onerror = (e) => {
      console.error("KV debug WebSocket error:", e)
    }
    return response
  }

  // KVデバッグビューの静的ファイル (index.html, app.js など)
  if (pathname.startsWith("/debug-kv-view")) {
    // /debug-kv-view/foo.js -> /foo.js に変換して publicDir から探す
    const relativePath = pathname.substring("/debug-kv-view".length) || "/index.html" // ルートならindex.html
    try {
      return await serveDir(req, {
        fsRoot: publicDir,
        urlRoot: "debug-kv-view", // これにより /debug-kv-view が publicDir にマッピングされる
        quiet: true,
      })
    } catch (e) {
      console.error(
        `Error serving static file ${relativePath} for KV Debug:`,
        e,
      )
      // serveDir がエラーをResponseとして返す場合があるため、ここではフォールバック
      if (e instanceof Response) return e
      return new Response("Internal Server Error serving debug static file", {
        status: 500,
      })
    }
  }

  // APIエンドポイント
  if (pathname === "/api/kv-debug/delete-all") {
    if (req.method === "POST") {
      try {
        if (!kv) await initializeKv()
        const iter = kv!.list({ prefix: [] })
        const promises = []
        for await (const entry of iter) {
          promises.push(kv!.delete(entry.key))
        }
        await Promise.all(promises)
        return new Response(
          JSON.stringify({ message: "All KV data deleted" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        )
      } catch (e) {
        console.error("Error deleting all KV data for debug:", e)
        return new Response(
          JSON.stringify({ error: "Failed to delete KV data" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        )
      }
    } else {
      return new Response("Method Not Allowed", { status: 405 })
    }
  }

  if (pathname === "/api/kv-debug/delete-entry") {
    if (req.method === "DELETE") {
      // POSTからDELETEに変更
      try {
        if (!kv) await initializeKv()
        const body = await req.json()
        const key = body.key // keyは配列であることを期待
        if (
          !Array.isArray(key) ||
          key.some(
            (k) =>
              typeof k !== "string" &&
              typeof k !== "number" &&
              !(k instanceof Uint8Array),
          )
        ) {
          return new Response(
            JSON.stringify({
              error:
                "Invalid key format. Key should be an array of strings, numbers, or Uint8Array.",
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          )
        }
        await kv!.delete(key)

        // WebSocket経由で更新を通知
        const currentData = await getAllKvData()
        for (const socket of sockets) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "update", data: currentData }))
          }
        }

        return new Response(
          JSON.stringify({ message: "Entry deleted successfully" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        )
      } catch (e) {
        console.error("Error deleting KV entry for debug:", e)
        return new Response(
          JSON.stringify({ error: "Failed to delete KV entry" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        )
      }
    } else {
      return new Response("Method Not Allowed", { status: 405 })
    }
  }

  return undefined // KVデバッグビュー関連のリクエストでなければundefinedを返す
}

// 必要であれば、サーバーシャットダウン時にKVを閉じる処理を追加
// Deno.addSignalListener("SIGINT", async () => {
//   if (kv) {
//     console.log("Closing KV store for debug viewer...");
//     await kv.close();
//   }
//   Deno.exit();
// });
