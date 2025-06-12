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

    connectWebSocket();

    return {
      kvData,
      error,
      wsStatus,
      wsStatusColor,
    };
  },
}).mount('#app');
