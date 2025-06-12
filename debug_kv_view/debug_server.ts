import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { serveDir } from 'https://deno.land/std@0.224.0/http/file_server.ts';

const APP_ENV = Deno.env.get('APP_ENV');

if (APP_ENV !== 'development') {
  console.log(
    'KV Debug Viewer is disabled. Set APP_ENV=development to enable.'
  );
  // 開発モードでない場合は何もしない
} else {
  console.log('KV Debug Viewer is enabled on /debug-kv-view');

  const kv = await Deno.openKv();
  const sockets = new Set<WebSocket>();

  // KVストアの全データを取得して整形する関数
  async function getAllKvData() {
    const entries = [];
    for await (const entry of kv.list({ prefix: [] })) {
      entries.push({
        key: entry.key.join(' : '),
        value: JSON.stringify(entry.value, null, 2),
        versionstamp: entry.versionstamp,
      });
    }
    return entries;
  }

  // KVストアの変更を監視
  (async () => {
    const watcher = kv.watch([[]]); // すべてのキーを監視
    for await (const changes of watcher) {
      console.log('KV store changed:', changes);
      const currentData = await getAllKvData();
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'update', data: currentData }));
        }
      }
    }
  })().catch(console.error);

  serve(
    async req => {
      const url = new URL(req.url);
      if (url.pathname === '/debug-kv-view') {
        // public/index.html を提供
        try {
          const file = await Deno.readFile(
            '/Users/rikegami/Development/ppap/debug_kv_view/public/index.html'
          );
          return new Response(file, {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        } catch (e) {
          console.error('Error serving index.html:', e);
          return new Response('Internal Server Error', { status: 500 });
        }
      }
      if (url.pathname === '/ws/kv-debug') {
        if (req.headers.get('upgrade') !== 'websocket') {
          return new Response(null, { status: 501 });
        }
        const { socket, response } = Deno.upgradeWebSocket(req);

        socket.onopen = async () => {
          console.log('WebSocket client connected');
          sockets.add(socket);
          try {
            const initialData = await getAllKvData();
            socket.send(JSON.stringify({ type: 'initial', data: initialData }));
          } catch (err) {
            console.error('Failed to send initial KV data:', err);
            socket.send(
              JSON.stringify({
                type: 'error',
                message: 'Failed to load initial KV data.',
              })
            );
          }
        };
        socket.onmessage = event => {
          console.log('WebSocket message from client:', event.data);
        };
        socket.onerror = err => {
          console.error('WebSocket error:', err);
          sockets.delete(socket);
        };
        socket.onclose = () => {
          console.log('WebSocket client disconnected');
          sockets.delete(socket);
        };
        return response;
      }

      // /debug-kv-view/app.js などの静的ファイルを提供
      if (url.pathname.startsWith('/debug-kv-view/')) {
        // /debug-kv-view/ を public/ にマッピング
        const filePath = url.pathname.replace('/debug-kv-view/', '');
        return serveDir(req, {
          fsRoot: '/Users/rikegami/Development/ppap/debug_kv_view/public',
          urlRoot: '', // fsRootからの相対パスになるように空にする
          quiet: true,
          enableCors: true, // CORSを有効にする場合
        });
      }

      return new Response('Not Found', { status: 404 });
    },
    { port: 8081 }
  );
}
