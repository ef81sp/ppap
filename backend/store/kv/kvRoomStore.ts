import { Room, RoomId, RoomForClientSide, UserToken } from '@/backend/type.ts';
import { RoomStore } from '../interfaces.ts';
import { getStoreManager } from '../storeManager.ts';
import { genMsgRoomInfo } from '@/wsMsg/msgFromServer.ts';
import { KVSocketStore } from './kvSocketStore.ts';

/**
 * KVベースのRoomStore実装
 */
export class KVRoomStore implements RoomStore {
  private kv: Deno.Kv | null = null;
  private cleanupIntervalId: number | undefined;
  // ルームごとのWatcherを管理
  private roomWatchers: Map<
    RoomId,
    {
      stream: ReadableStream<Deno.KvEntryMaybe<Room>[]>;
      active: boolean;
    }
  > = new Map();

  constructor() {
    // 5分に1回、30分間更新のないルームを閉じる
    const thresholdMs = 30 * 1000 * 60;
    this.cleanupIntervalId = setInterval(async () => {
      console.log('polling kv store...');
      await this.cleanupIdleRooms(thresholdMs);
    }, 5 * 1000 * 60);
  }

  // KVインスタンスの遅延初期化
  private async ensureKV(): Promise<void> {
    if (!this.kv) {
      this.kv = await Deno.openKv();
    }
  }

  // 特定のルームに対するWatchを設定
  private async watchRoom(roomId: RoomId): Promise<void> {
    // 既に監視中なら何もしない
    if (this.roomWatchers.get(roomId)?.active) {
      console.log(`Room ${roomId.slice(0, 6)}... is already being watched`);
      return;
    }

    await this.ensureKV();

    try {
      console.log(`Setting up watcher for room ${roomId.slice(0, 6)}...`);

      // このルームに特化したwatchを設定
      const stream = this.kv!.watch<[Room]>([['rooms', roomId]]);

      // 監視情報を保存
      this.roomWatchers.set(roomId, { stream, active: true });

      // 非同期でwatcherを処理
      (async () => {
        try {
          console.log(`KV watcher for room ${roomId.slice(0, 6)}... started`);

          for await (const entries of stream) {
            // アクティブでなくなったらループを抜ける
            if (!this.roomWatchers.get(roomId)?.active) {
              console.log(
                `KV watcher for room ${roomId.slice(0, 6)}... stopped`
              );
              break;
            }

            // エントリが空の場合はスキップ
            if (!entries) {
              continue;
            }

            console.log(`Detected changes for room ${roomId.slice(0, 6)}...`);

            for (const entry of entries) {
              try {
                if (!entry.value) continue;

                const room = entry.value as Room;
                await this.notifyLocalUsersAboutRoomChange(room);
              } catch (entryError) {
                console.error(
                  `Error processing room ${roomId.slice(0, 6)}... update:`,
                  entryError
                );
              }
            }
          }

          console.log(
            `KV watcher loop for room ${roomId.slice(0, 6)}... ended normally`
          );
          // ループが正常に終了した場合も監視状態を更新
          this.roomWatchers.delete(roomId);
        } catch (error: unknown) {
          // エラー処理
          console.error(
            `KV watcher error for room ${roomId.slice(0, 6)}...:`,
            error
          );

          // ウォッチャーを削除
          this.roomWatchers.delete(roomId);

          // 3秒後に再接続を試みる
          setTimeout(() => {
            console.log(
              `Attempting to restart watcher for room ${roomId.slice(0, 6)}...`
            );
            this.watchRoom(roomId).catch(e =>
              console.error(
                `Failed to restart watcher for room ${roomId.slice(0, 6)}...:`,
                e
              )
            );
          }, 3000);
        }
      })();
    } catch (error) {
      console.error(
        `Failed to setup watcher for room ${roomId.slice(0, 6)}...:`,
        error
      );
      // エラー発生時はウォッチャーをセットしない
      this.roomWatchers.delete(roomId);
    }
  }

  // 特定のルームのWatchを停止する
  private stopWatchingRoom(roomId: RoomId): void {
    const watcher = this.roomWatchers.get(roomId);
    if (watcher) {
      console.log(`Stopping watcher for room ${roomId.slice(0, 6)}...`);

      try {
        // ストリームを直接キャンセルするのではなく、フラグをfalseにして
        // for-awaitループが自然に終了するのを待つ
        watcher.active = false;

        // Mapからすぐに削除する（新しいウォッチャー作成を許可するため）
        this.roomWatchers.delete(roomId);

        console.log(
          `Watcher for room ${roomId.slice(0, 6)}... marked inactive`
        );
      } catch (error) {
        console.error(
          `Error stopping watcher for room ${roomId.slice(0, 6)}...:`,
          error
        );
        // エラーが発生しても確実にMapから削除
        this.roomWatchers.delete(roomId);
      }
    }
  }

  // 参加したルームを必要に応じてWatchする
  private async checkAndWatchRoom(roomId: RoomId): Promise<void> {
    // 既に監視中なら何もしない
    if (this.roomWatchers.get(roomId)?.active) {
      console.log(`Room ${roomId.slice(0, 6)}... is already being watched`);
      return;
    }

    // 監視開始
    await this.watchRoom(roomId);
  }

  // このインスタンスに関連するユーザーにのみルーム変更を通知
  private async notifyLocalUsersAboutRoomChange(room: Room): Promise<void> {
    const socketStore = getStoreManager().getSocketStore() as KVSocketStore;
    console.log(
      `Notifying local participants for room ${room.id.slice(0, 6)}...`
    );

    for (const participant of room.participants) {
      try {
        const socket = socketStore.getSocket(participant.token);
        if (socket) {
          if (socket.readyState === WebSocket.OPEN) {
            const roomForClient: RoomForClientSide = {
              ...room,
              participants: room.participants.map((p, i) => ({
                name: p.name,
                answer: p.answer,
                userNumber: i,
                isMe: p.token === participant.token,
              })),
            };
            const msg = genMsgRoomInfo(roomForClient);
            socket.send(JSON.stringify(msg));
            console.log(
              `Sent room update to local user ${participant.token.slice(
                0,
                6
              )}...`
            );
          } else {
            console.log(
              `Cleaning up stale socket for user ${participant.token.slice(
                0,
                6
              )}...`
            );
            await socketStore.deleteSocket(participant.token);
          }
        }
      } catch (error) {
        console.error(
          `Error notifying user ${participant.token.slice(0, 6)}...`,
          error
        );
      }
    }
  }

  // アイドル状態のルームをクリーンアップするプライベートメソッド
  private async cleanupIdleRooms(thresholdMs: number): Promise<void> {
    await this.ensureKV();
    const now = Date.now();
    const entries = this.kv!.list<Date>({ prefix: ['room_updates'] });
    const idleRoomIds: RoomId[] = [];

    for await (const entry of entries) {
      const [, roomId] = entry.key as [string, RoomId];
      if (now - entry.value.getTime() > thresholdMs) {
        idleRoomIds.push(roomId);
      }
    }

    for (const roomId of idleRoomIds) {
      console.log('room closed due to inactivity:', roomId);
      await this.closeRoom(roomId);
    }
  }

  async createRoom(userToken: UserToken, userName: string): Promise<Room> {
    await this.ensureKV();

    const roomId = crypto.randomUUID();
    const room: Room = {
      id: roomId,
      participants: [
        {
          token: userToken,
          name: userName,
          answer: '',
        },
      ],
      isOpen: false,
    };

    // トランザクションで原子的に更新
    const atomicOp = this.kv!.atomic();
    atomicOp.set(['rooms', roomId], room);
    atomicOp.set(['user_rooms', userToken], roomId);
    atomicOp.set(['room_updates', roomId], new Date());

    const result = await atomicOp.commit();
    if (!result.ok) {
      throw new Error('Failed to create room in KV store');
    }

    console.log('room created in KV:', roomId);

    // ルーム作成後にWatchを開始
    await this.watchRoom(roomId);

    return room;
  }

  async isExistTheRoom(roomId: RoomId): Promise<boolean> {
    await this.ensureKV();
    const result = await this.kv!.get(['rooms', roomId]);
    return result.value !== null;
  }

  async enterTheRoom({
    roomId,
    userToken,
    userName,
  }: {
    roomId: RoomId;
    userToken: UserToken;
    userName: string;
  }): Promise<Room | undefined> {
    await this.ensureKV();
    const roomResult = await this.kv!.get<Room>(['rooms', roomId]);
    const room = roomResult.value;
    if (room == undefined) return;

    room.participants.push({
      token: userToken,
      name: userName,
      answer: '',
    });
    this.sortParticipants(room);

    // トランザクションで原子的に更新
    const atomicOp = this.kv!.atomic();
    atomicOp.set(['rooms', roomId], room);
    atomicOp.set(['user_rooms', userToken], roomId);
    atomicOp.set(['room_updates', roomId], new Date());

    const result = await atomicOp.commit();
    if (!result.ok) {
      throw new Error('Failed to enter room in KV store');
    }

    // ルーム参加時にルームがまだWatchされていない場合はWatchを開始
    await this.checkAndWatchRoom(roomId);

    return room;
  }

  async answer({
    roomId,
    userToken,
    answer,
  }: {
    roomId: RoomId;
    userToken: UserToken;
    answer: string;
  }): Promise<Room | undefined> {
    await this.ensureKV();
    const roomResult = await this.kv!.get<Room>(['rooms', roomId]);
    const room = roomResult.value;
    if (room == undefined) return;

    const user = room.participants.find(u => u.token === userToken);
    if (user == undefined) return;
    user.answer = answer;
    if (room.participants.every(u => u.answer !== '')) {
      room.isOpen = true;
    }

    // KVに更新を保存
    const atomicOp = this.kv!.atomic();
    atomicOp.set(['rooms', roomId], room);
    atomicOp.set(['room_updates', roomId], new Date());

    const result = await atomicOp.commit();
    if (!result.ok) {
      throw new Error('Failed to update answer in KV store');
    }

    return room;
  }

  async clearAnswer(roomId: RoomId): Promise<Room | undefined> {
    await this.ensureKV();
    const roomResult = await this.kv!.get<Room>(['rooms', roomId]);
    const room = roomResult.value;
    if (room == undefined) return;

    for (const p of room.participants) {
      p.answer = '';
    }
    room.isOpen = false;

    // KVに更新を保存
    const atomicOp = this.kv!.atomic();
    atomicOp.set(['rooms', roomId], room);
    atomicOp.set(['room_updates', roomId], new Date());

    const result = await atomicOp.commit();
    if (!result.ok) {
      throw new Error('Failed to clear answers in KV store');
    }

    return room;
  }

  async exitRoom(userToken: UserToken): Promise<Room | undefined> {
    await this.ensureKV();
    const roomIdResult = await this.kv!.get<RoomId>(['user_rooms', userToken]);
    const roomId = roomIdResult.value;
    if (roomId == undefined) return;

    const roomResult = await this.kv!.get<Room>(['rooms', roomId]);
    const room = roomResult.value;
    if (room == undefined) return;

    console.log('exit room:', roomId, 'user:', userToken);
    room.participants = room.participants.filter(v => v.token !== userToken);
    this.sortParticipants(room);

    if (room.participants.every(u => u.answer !== '')) {
      room.isOpen = true;
    }

    // トランザクションで原子的に更新
    const atomicOp = this.kv!.atomic();
    atomicOp.set(['rooms', roomId], room);
    atomicOp.set(['room_updates', roomId], new Date());
    atomicOp.delete(['user_rooms', userToken]);

    const result = await atomicOp.commit();
    if (!result.ok) {
      throw new Error('Failed to exit room in KV store');
    }

    // 参加者が0人になった場合は、Watchを解除する
    if (room.participants.length === 0) {
      await this.stopWatchingRoom(roomId);
    }

    return room;
  }

  async closeEmptyRoom(): Promise<void> {
    await this.ensureKV();
    const entries = this.kv!.list<Room>({ prefix: ['rooms'] });
    const emptyRoomIds: RoomId[] = [];

    for await (const entry of entries) {
      const [, roomId] = entry.key as [string, RoomId];
      const room = entry.value;
      if (room.participants.length === 0) {
        emptyRoomIds.push(roomId);
      }
    }

    // 空の部屋を削除
    for (const roomId of emptyRoomIds) {
      const atomicOp = this.kv!.atomic();
      atomicOp.delete(['rooms', roomId]);
      atomicOp.delete(['room_updates', roomId]);

      const result = await atomicOp.commit();
      if (result.ok) {
        console.log('empty room closed:', roomId);
        // Watchを停止
        await this.stopWatchingRoom(roomId);
      }
    }
  }

  async closeRoom(roomId: RoomId): Promise<void> {
    await this.ensureKV();
    const roomResult = await this.kv!.get<Room>(['rooms', roomId]);
    const room = roomResult.value;
    if (room == undefined) return;

    console.log('room closed:', roomId);

    // トランザクションの準備
    const atomicOp = this.kv!.atomic();

    // 残っているユーザーを全員切断
    for (const p of room.participants) {
      const socketStore = getStoreManager().getSocketStore();
      const socket = socketStore.getSocket(p.token);
      if (socket != undefined) {
        socket.close();
        await socketStore.deleteSocket(p.token);
      }
      // ユーザーと部屋の関連を削除
      atomicOp.delete(['user_rooms', p.token]);
    }

    // 部屋自体を削除
    atomicOp.delete(['rooms', roomId]);
    atomicOp.delete(['room_updates', roomId]);

    await atomicOp.commit();

    // ルームが削除されるためWatchも停止
    await this.stopWatchingRoom(roomId);

    // ルームクローズ時に不要なsocket_instancesエントリもクリーンアップ
    await getStoreManager().getSocketStore().cleanupStaleSocketInstances();
  }

  private sortParticipants(room: Room): void {
    room.participants.sort((a, b) => {
      if (a.token > b.token) return 1;
      if (a.token < b.token) return -1;
      return 0;
    });
  }
}
