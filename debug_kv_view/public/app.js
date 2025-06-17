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
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/kv-debug`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
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
            error.value = message.message;
          }
        } catch (_e) {
          error.value = 'Received malformed data from server.';
        }
      };

      socket.onerror = () => {
        error.value =
          'WebSocket connection error. Check the server console or if the debug server is running on the correct port.';
        wsStatus.value = 'Error';
      };

      socket.onclose = () => {
        wsStatus.value = 'Disconnected';
        setTimeout(connectWebSocket, 5000);
      };
    }

    function deleteEntry(keyString) {
      const key = keyString.split(' : ');
      fetch('/api/kv-debug/delete-entry', {
        method: 'DELETE',
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
        })
        .catch(err => {
          error.value = err.message;
        });
    }

    function deleteAll() {
      fetch('/api/kv-debug/delete-all', {
        method: 'POST',
      })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => {
              throw new Error(err.error || 'Failed to delete all entries');
            });
          }
        })
        .catch(err => {
          error.value = err.message;
        });
    }

    connectWebSocket();

    return {
      kvData,
      error,
      wsStatus,
      wsStatusColor,
      deleteEntry,
      deleteAll,
    };
  },
  template: `
    <div class="container">
      <h1>Deno KV Debug Viewer</h1>
      <button @click="deleteAll" class="delete-button" style="margin-bottom: 16px; background: #d9534f; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">全データ削除</button>
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
  `,
}).mount('#app');
