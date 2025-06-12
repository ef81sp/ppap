import { serveDir } from 'https://deno.land/std@0.224.0/http/file_server.ts';
import {
  dirname,
  fromFileUrl,
  join,
} from 'https://deno.land/std@0.224.0/path/mod.ts';

// publicディレクトリの絶対パスを取得
const __dirname = dirname(fromFileUrl(import.meta.url));
const publicDir = join(__dirname, 'public');

let kv: Deno.Kv | undefined;
const sockets = new Set<WebSocket>();
let watcherInitialized = false;

async function initializeKv() {
  if (!kv) {
    console.log('Opening Deno KV store for debug viewer...');
    kv = await Deno.openKv();
    console.log('Deno KV store opened for debug viewer.');
  }
  return kv;
}

async function getAllKvData() {
  if (!kv) await initializeKv();
  const entries = [];
  try {
    for await (const entry of kv!.list({ prefix: [] })) {
      entries.push({
        key: entry.key.join(' : '),
        value: JSON.stringify(entry.value, null, 2),
        versionstamp: entry.versionstamp,
      });
    }
  } catch (e) {
    console.error('Error listing KV entries for debug view:', e);
    throw e; // エラーを呼び出し元に伝える
  }
  return entries;
}

async function initializeWatcher() {
  if (watcherInitialized) return;
  await initializeKv(); // kvインスタンスを確実に初期化
  watcherInitialized = true;

  console.log('Initializing KV watcher for debug view...');
  (async () => {
    try {
      const watcher = kv!.watch([[]]);
      for await (const changes of watcher) {
        // console.log("KV store changed (debug view):", changes.map(c => c.key));
        const currentData = await getAllKvData();
        for (const socket of sockets) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'update', data: currentData }));
          }
        }
      }
    } catch (err) {
      console.error('KV watcher error (debug view):', err);
      watcherInitialized = false; // エラー発生時は再初期化を試みれるように
    }
  })().catch(err => {
    // このcatchはasync IIFE自体のエラー用
    console.error('Error in KV watcher IIFE (debug view):', err);
    watcherInitialized = false;
  });
}

export async function handleKvDebugRequest(
  req: Request
): Promise<Response | undefined> {
  if (Deno.env.get('APP_ENV') !== 'development') {
    return undefined; // 開発モードでない場合は何もしない
  }

  await initializeKv(); // KVストアの初期化を試みる
  if (!watcherInitialized) {
    await initializeWatcher(); // ウォッチャーの初期化を試みる
  }

  const url = new URL(req.url);
  const pathname = url.pathname;

  // KVデバッグビューのWebSocketエンドポイント
  if (pathname === '/ws/kv-debug') {
    if (req.headers.get('upgrade') !== 'websocket') {
      return new Response("request isn't trying to upgrade to websocket.", {
        status: 400,
      });
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    sockets.add(socket);
    socket.onopen = async () => {
      try {
        const currentData = await getAllKvData();
        socket.send(JSON.stringify({ type: 'initial', data: currentData }));
      } catch (e) {
        console.error('Error sending initial KV data to debug client:', e);
        socket.send(
          JSON.stringify({
            type: 'error',
            message: 'Could not fetch initial KV data.',
          })
        );
      }
    };
    socket.onclose = () => {
      sockets.delete(socket);
    };
    socket.onerror = e => {
      console.error('KV debug WebSocket error:', e);
    };
    return response;
  }

  // KVデバッグビューの静的ファイル (index.html, app.js など)
  if (pathname.startsWith('/debug-kv-view')) {
    // /debug-kv-view/foo.js -> /foo.js に変換して publicDir から探す
    const relativePath =
      pathname.substring('/debug-kv-view'.length) || '/index.html'; // ルートならindex.html
    try {
      return await serveDir(req, {
        fsRoot: publicDir,
        urlRoot: 'debug-kv-view', // これにより /debug-kv-view が publicDir にマッピングされる
        quiet: true,
      });
    } catch (e) {
      console.error(
        `Error serving static file ${relativePath} for KV Debug:`,
        e
      );
      // serveDir がエラーをResponseとして返す場合があるため、ここではフォールバック
      if (e instanceof Response) return e;
      return new Response('Internal Server Error serving debug static file', {
        status: 500,
      });
    }
  }

  // APIエンドポイント
  if (pathname === '/api/kv-debug/delete-all') {
    if (req.method === 'POST') {
      try {
        if (!kv) await initializeKv();
        const iter = kv!.list({ prefix: [] });
        const promises = [];
        for await (const entry of iter) {
          promises.push(kv!.delete(entry.key));
        }
        await Promise.all(promises);
        return new Response(
          JSON.stringify({ message: 'All KV data deleted' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      } catch (e) {
        console.error('Error deleting all KV data for debug:', e);
        return new Response(
          JSON.stringify({ error: 'Failed to delete KV data' }),
          {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
    } else {
      return new Response('Method Not Allowed', { status: 405 });
    }
  }

  return undefined; // KVデバッグビュー関連のリクエストでなければundefinedを返す
}

// 必要であれば、サーバーシャットダウン時にKVを閉じる処理を追加
// Deno.addSignalListener("SIGINT", async () => {
//   if (kv) {
//     console.log("Closing KV store for debug viewer...");
//     await kv.close();
//   }
//   Deno.exit();
// });
