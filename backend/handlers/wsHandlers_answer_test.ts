import { assertEquals } from 'jsr:@std/assert';
import { handleWebSocket } from './wsHandlers.ts';
import { Room } from '../type.ts';

Deno.test(
  'WebSocket: answerメッセージで参加者のanswerが更新される',
  async () => {
    const roomId = 'room1';
    const userToken = 'tokentest';
    const testRoom: Room = {
      id: roomId,
      participants: [
        { token: userToken, name: 'user', answer: '' },
        { token: 'other', name: 'other', answer: '' },
      ],
      config: { allowSpectators: true, maxParticipants: 10 },
      createdAt: 1,
      updatedAt: 2,
    };
    let savedRoom: Room | null = null;
    const fakeSocket = {
      send: (_msg: string) => {},
      close: () => {},
      addEventListener: () => {},
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    } as unknown as WebSocket;
    const upgradeWebSocket = (_req: Request) => ({
      socket: fakeSocket,
      response: new Response(null, { status: 101 }),
    });
    const kv = {
      get: (_key: unknown) => Promise.resolve({ value: savedRoom ?? testRoom }),
      atomic: () => ({
        set: (_key: unknown, value: Room) => {
          savedRoom = value as Room;
          return { commit: () => Promise.resolve({ ok: true }) };
        },
        commit: () => Promise.resolve({ ok: true }),
      }),
      watch: () => ({ async *[Symbol.asyncIterator]() {} }),
    } as unknown as Deno.Kv;

    const req = new Request('http://localhost/ws/rooms/' + roomId, {
      method: 'GET',
      headers: {
        'upgrade': 'websocket',
        'connection': 'Upgrade',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'sec-websocket-version': '13',
      },
    });
    handleWebSocket(req, roomId, kv, upgradeWebSocket);
    const wsHandlers = await import('./wsHandlers.ts');
    const wsSet = wsHandlers.roomSockets.get(roomId);
    if (!wsSet) throw new Error('roomSockets not set');
    const wsEntry = Array.from(wsSet)[0];
    wsEntry.userToken = userToken;
    const answerMsg = JSON.stringify({ type: 'answer', answer: '5' });
    if (!wsEntry.socket.onmessage) throw new Error('onmessage not set');
    await wsEntry.socket.onmessage({ data: answerMsg });
    if (!savedRoom) throw new Error('Room not saved');
    const room: Room = savedRoom as Room;
    assertEquals(room.participants[0].answer, '5');
  }
);

Deno.test(
  'WebSocket: setAudienceメッセージで参加者のisAudienceが更新される',
  async () => {
    const roomId = 'room2';
    const userToken = 'tokentest2';
    const testRoom: Room = {
      id: roomId,
      participants: [
        { token: userToken, name: 'user', answer: '', isAudience: false },
        { token: 'other', name: 'other', answer: '', isAudience: false },
      ],
      config: { allowSpectators: true, maxParticipants: 10 },
      createdAt: 1,
      updatedAt: 2,
    };
    let savedRoom: Room | null = null;
    const fakeSocket = {
      send: (_msg: string) => {},
      close: () => {},
      addEventListener: () => {},
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    } as unknown as WebSocket;
    const upgradeWebSocket = (_req: Request) => ({
      socket: fakeSocket,
      response: new Response(null, { status: 101 }),
    });
    const kv = {
      get: (_key: unknown) => Promise.resolve({ value: savedRoom ?? testRoom }),
      atomic: () => ({
        set: (_key: unknown, value: Room) => {
          savedRoom = value as Room;
          return { commit: () => Promise.resolve({ ok: true }) };
        },
        commit: () => Promise.resolve({ ok: true }),
      }),
      watch: () => ({ async *[Symbol.asyncIterator]() {} }),
    } as unknown as Deno.Kv;

    const req = new Request('http://localhost/ws/rooms/' + roomId, {
      method: 'GET',
      headers: {
        'upgrade': 'websocket',
        'connection': 'Upgrade',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'sec-websocket-version': '13',
      },
    });
    handleWebSocket(req, roomId, kv, upgradeWebSocket);
    const wsHandlers = await import('./wsHandlers.ts');
    const wsSet = wsHandlers.roomSockets.get(roomId);
    if (!wsSet) throw new Error('roomSockets not set');
    const wsEntry = Array.from(wsSet)[0];
    wsEntry.userToken = userToken;
    const setAudienceMsg = JSON.stringify({
      type: 'setAudience',
      isAudience: true,
    });
    if (!wsEntry.socket.onmessage) throw new Error('onmessage not set');
    await wsEntry.socket.onmessage({ data: setAudienceMsg });
    if (!savedRoom) throw new Error('Room not saved');
    const room: Room = savedRoom as Room;
    assertEquals(room.participants[0].isAudience, true);
  }
);
