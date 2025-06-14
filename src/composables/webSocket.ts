import { useWebSocket } from '@vueuse/core';
import { isMsgFromServer } from '../../wsMsg/msgFromServer.ts';
import { room, setRoom, setToken, user } from './store.ts';
import { ref, watch } from 'vue';
import { genMsgAnswer, genMsgClearAnswer } from '../../wsMsg/msgFromClient.ts';
import { RoomForClient } from '@/backend/type.ts';

const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const url = import.meta.env.DEV
  ? `${protocol}${import.meta.env.VITE_WEBSOCKET_HOST}`
  : `${protocol}${location.host}`;

export const webSocket = useWebSocket<string>(url, {
  heartbeat: true,
  autoReconnect: true,
  immediate: false, // Add this line
});

// Add this function
export const connectWebSocket = () => {
  if (webSocket.status.value === 'CLOSED') {
    webSocket.open();
  }
};

watch(webSocket.data, newData => {
  msgHandler(newData);
});
watch(webSocket.status, newStatus => {
  if (newStatus === 'CLOSED') {
    console.error(
      'WebSocket connection closed. Check server logs and WebSocket URL.'
    );
    // location.href = "/"; // 無限リロードを避けるため一時的にコメントアウト
  }
});

export const isRoomCreator = ref(false);

const msgHandler = (data: string | null) => {
  if (data === null) return;
  if (data === 'pong') return;
  const msg = JSON.parse(data);
  if (!isMsgFromServer(msg)) return;
  switch (msg.type) {
    case 'connected': {
      setToken(msg.userToken);
      break;
    }
    case 'roomInfo': {
      setRoom(msg.room as RoomForClient);
      break;
    }
    default:
      break;
  }
};

// ====================

export const sendIsExistTheRoom = (roomId: string) => {
  // 仮実装: 実際にはWebSocketメッセージを送信する
  console.log(`Checking if room ${roomId} exists`);
  // webSocket.send(JSON.stringify(genMsgIsExistTheRoom({ roomId })));
};

export const sendEnterTheRoom = (roomId: string, userName: string) => {
  // 仮実装: 実際にはWebSocketメッセージを送信する
  console.log(`Entering room ${roomId} as ${userName}`);
  // webSocket.send(JSON.stringify(genMsgEnterRoom({ roomId, userName, userToken: user.token.value })));
};

export const sendAnswer = (answer: string) => {
  if (!room.value) return; // room.value が null の場合は処理を中断
  webSocket.send(
    JSON.stringify(
      genMsgAnswer({
        userToken: user.token.value,
        roomId: room.value.id,
        answer,
      })
    )
  );
};
export const sendClearAnswer = () => {
  if (!room.value) return; // room.value が null の場合は処理を中断
  webSocket.send(JSON.stringify(genMsgClearAnswer(room.value.id)));
};
