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
  private watcherController: AbortController | null = null;

  constructor() {
    // 5分に1回、30分間更新のないルームを閉じる
    const thresholdMs = 30 * 1000 * 60;
    this.cleanupIntervalId = setInterval(async () => {
      console.log('polling kv store...');
      await this.cleanupIdleRooms(thresholdMs);
    }, 5 * 1000 * 60);

    // KV Watch APIによるルーム変更の監視をセットアップ
    this.setupRoomWatcher();
  }

  // KVインスタンスの遅延初期化
  private async ensureKV(): Promise<void> {
    if (!this.kv) {
      this.kv = await Deno.openKv();
    }
  }

  // KV Watchの設定
  private async setupRoomWatcher(): Promise<void> {
    await this.ensureKV();
    
    // 既存のWatcherがあれば中止
    if (this.watcherController) {
      this.watcherController.abort();
    }
    
    this.watcherController = new AbortController();
    
    console.log("Setting up KV room watcher...");
    
    try {
      // watchの開始 - エラーハンドリングを強化
      const watcher = this.kv!.watch([["rooms"]]);
      
      // 変更を監視して処理（非同期で実行）
      (async () => {
        try {
          console.log("KV watcher started");
          for await (const entries of watcher) {
            // watcherコントローラでアボートされていたらループを抜ける
            if (this.watcherController?.signal.aborted) {
              console.log("KV watcher aborted");
              break;
            }
            
            // エントリが空の場合はスキップ (型安全な比較に変更)
            if (!entries || entries.length <= 0) {
              continue;
            }
            
            console.log(`Detected ${entries.length} changes in KV store`);
            
            for (const entry of entries) {
              try {
                if (!entry.key || entry.key.length < 2) {
                  console.log("Invalid key format:", entry.key);
                  continue;
                }
                
                const [prefix, roomId] = entry.key as [string, RoomId];
                if (prefix !== "rooms" || !roomId) {
                  console.log("Skipping non-room entry:", entry.key);
                  continue;
                }
                
                const room = entry.value as Room;
                if (!room) {
                  console.log("Room value is null or undefined");
                  continue;
                }
                
                console.log(`Room change detected: ${roomId}`);
                // ローカルインスタンスのユーザーに変更を通知
                await this.notifyLocalUsersAboutRoomChange(room);
              } catch (entryError) {
                console.error("Error processing entry:", entryError);
              }
            }
          }
          console.log("KV watcher loop ended normally");
        } catch (error: unknown) {
          // エラー型を明示的に処理
          const err = error as Error;
          if (err.name === "AbortError") {
            console.log("KV watcher aborted:", err.message);
          } else {
            console.error("KV Watch error:", err);
            
            // エラー発生から3秒後に監視を再開
            setTimeout(() => {
              console.log("Attempting to restart KV watcher after error...");
              this.setupRoomWatcher().catch(e => 
                console.error("Failed to restart KV watcher:", e)
              );
            }, 3000);
          }
        }
      })();
    } catch (error) {
      console.error("Failed to setup room watcher:", error);
      
      // セットアップエラー発生から5秒後に再試行
      setTimeout(() => {
        console.log("Attempting to restart KV watcher after setup error...");
        this.setupRoomWatcher().catch(e => 
          console.error("Failed to restart KV watcher:", e)
        );
      }, 5000);
    }
  }

  // このインスタンスに関連するユーザーにのみルーム変更を通知
  private async notifyLocalUsersAboutRoomChange(room: Room): Promise<void> {
    const socketStore = getStoreManager().getSocketStore() as KVSocketStore;
    const instanceId = socketStore.getInstanceId();

    for (const participant of room.participants) {
      try {
        // このユーザーが現在のインスタンスに関連しているか確認
        const userInstanceId = await socketStore.getSocketInstance(
          participant.token
        );

        if (userInstanceId === instanceId) {
          const socket = socketStore.getSocket(participant.token);
          if (socket) {
            // このインスタンスのユーザーにメッセージを送信
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
              `Notified local user ${participant.token.slice(
                0,
                6
              )}... about room change`
            );
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
      console.log('room closed:', roomId);
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
        console.log('room closed:', roomId);
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
  }

  private sortParticipants(room: Room): void {
    room.participants.sort((a, b) => {
      if (a.token > b.token) return 1;
      if (a.token < b.token) return -1;
      return 0;
    });
  }
}
