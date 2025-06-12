const { createApp, ref, computed } = Vue;

createApp({
  setup() {
    const kvData = ref([]);
    const error = ref(null);
    const wsStatus = ref('Connecting...');
    let socket = null;

    const wsStatusColor = computed(() => {
      switch (wsStatus.value) {
        case 'Connected':
          return 'green';
        case 'Disconnected':
          return 'red';
        case 'Error':
          return 'red';
        default:
          return 'orange';
      }
    });

    function connectWebSocket() {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // debug_server.ts が 8081 ポートで起動することを想定
      // 通常のWebサーバー(Viteなど)が異なるポートで動作している場合、
      // WebSocketの接続先を明示的に指定する必要があります。
      // 例: const wsUrl = `${wsProtocol}//localhost:8081/ws/kv-debug`;
      // 今回は /debug-kv-view と同じホスト・ポートで /ws/kv-debug に接続すると仮定
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/kv-debug`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connection established');
        wsStatus.value = 'Connected';
        error.value = null;
      };

      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'initial' || message.type === 'update') {
            kvData.value = message.data;
            error.value = null;
          } else if (message.type === 'error') {
            console.error('Server error:', message.message);
            error.value = message.message;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
          error.value = 'Received malformed data from server.';
        }
      };

      socket.onerror = err => {
        console.error('WebSocket error:', err);
        error.value =
          'WebSocket connection error. Check the server console or if the debug server is running on the correct port.';
        wsStatus.value = 'Error';
      };

      socket.onclose = () => {
        console.log('WebSocket connection closed. Attempting to reconnect...');
        wsStatus.value = 'Disconnected';
        // 簡易的な再接続処理 (5秒後)
        setTimeout(connectWebSocket, 5000);
      };
    }

    function deleteEntry(keyString) {
      const key = keyString.split(' : ');
      fetch('/api/kv-debug/delete-entry', {
        method: 'DELETE', // POSTからDELETEに変更
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
      })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.error || 'Failed to delete entry');
            });
          }
          // 成功時はWebSocket経由で更新されるので、ここでは何もしない
          // 必要であれば、ローカルのkvDataを即時更新することも可能
          console.log('Delete request sent for key:', key);
        })
        .catch(err => {
          console.error('Error deleting entry:', err);
          error.value = err.message;
        });
    }

    connectWebSocket();

    return {
      kvData,
      error,
      wsStatus,
      wsStatusColor,
      deleteEntry, // deleteEntryを返す
    };
  },
  template: `
    <div class="container">
      <h1>Deno KV Debug Viewer</h1>
      <p>WebSocket Status: <span :style="{ color: wsStatusColor }">{{ wsStatus }}</span></p>
      <div v-if="error" class="error-message">
        <p>Error: {{ error }}</p>
      </div>
      <div v-if="kvData.length === 0 && !error">
        <p>No data in KV store or not yet loaded.</p>
      </div>
      <ul v-else class="kv-list">
        <li v-for="item in kvData" :key="item.key" class="kv-item">
          <div class="kv-key"><strong>Key:</strong> {{ item.key }}</div>
          <pre class="kv-value">{{ item.value }}</pre>
          <div class="kv-versionstamp">Versionstamp: {{ item.versionstamp }}</div>
          <button @click="deleteEntry(item.key)" class="delete-button">Delete</button>
        </li>
      </ul>
    </div>
  `
}).mount('#app');
