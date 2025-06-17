import { UserToken } from '@/backend/type.ts';
import { SocketStore } from '../interfaces.ts';

/**
 * KVベースのSocketStore実装
 * 注: WebSocketオブジェクトは直接KVに保存できないため、
 * インメモリキャッシュとKVを組み合わせて使用します
 */
export class KVSocketStore implements SocketStore {
  // WebSocketはシリアライズできないため、メモリに保持する必要がある
  private usersSockets: Map<UserToken, WebSocket> = new Map();
  private kv: Deno.Kv | null = null;
  private instanceId: string;
  private cleanupIntervalId: number | undefined;

  constructor() {
    // このインスタンス固有のID
    this.instanceId = crypto.randomUUID();

    // 10分に1回、不要なsocket_instancesエントリをクリーンアップ
    this.cleanupIntervalId = setInterval(async () => {
      console.log('Cleaning up stale socket_instances in KV store...');
      await this.cleanupStaleSocketInstances();
    }, 10 * 60 * 1000);
  }

  // KVインスタンスの遅延初期化
  private async ensureKV(): Promise<void> {
    if (!this.kv) {
      this.kv = await Deno.openKv();
    }
  }

  getSocket(userToken: UserToken): WebSocket | undefined {
    return this.usersSockets.get(userToken);
  }

  async addSocket(userToken: UserToken, socket: WebSocket): Promise<void> {
    this.usersSockets.set(userToken, socket);

    // KVにインスタンスIDを記録
    await this.ensureKV();
    await this.kv!.set(['socket_instances', userToken], this.instanceId);
  }

  async deleteSocket(userToken: UserToken): Promise<void> {
    if (this.usersSockets.delete(userToken)) {
      console.log('deleted socket: ', userToken);
      // KVからインスタンスIDを削除
      await this.ensureKV();
      await this.kv!.delete(['socket_instances', userToken]);
    }
  }

  // このインスタンスIDを取得
  getInstanceId(): string {
    return this.instanceId;
  }

  // 指定されたユーザートークンがどのインスタンスに関連付けられているかを確認
  async getSocketInstance(userToken: UserToken): Promise<string | null> {
    await this.ensureKV();
    const result = await this.kv!.get<string>(['socket_instances', userToken]);
    return result.value;
  }

  // staleなsocket_instancesをクリーンアップするメソッド
  async cleanupStaleSocketInstances(): Promise<void> {
    try {
      await this.ensureKV();
      const entries = this.kv!.list({ prefix: ['socket_instances'] });
      const batchSize = 10;
      let batch: Deno.KvKey[] = [];
      let deleteCount = 0;

      // 自分のインスタンスIDと一致するエントリを確認
      for await (const entry of entries) {
        const userToken = entry.key[1] as UserToken;
        const instanceId = entry.value as string;

        // このインスタンスに属するエントリだけをチェック
        if (instanceId === this.instanceId) {
          // ローカルキャッシュにWebSocketが存在するか確認
          const hasSocket = this.usersSockets.has(userToken);

          // WebSocketが存在しない場合は削除対象
          if (!hasSocket) {
            batch.push(entry.key);

            // バッチが一定サイズになったら削除を実行
            if (batch.length >= batchSize) {
              await this.deleteSocketInstancesBatch(batch);
              deleteCount += batch.length;
              batch = [];
            }
          }
        }
      }

      // 残りのバッチを削除
      if (batch.length > 0) {
        await this.deleteSocketInstancesBatch(batch);
        deleteCount += batch.length;
      }

      if (deleteCount > 0) {
        console.log(`Cleaned up ${deleteCount} stale socket_instances entries`);
      } else {
        console.log('No stale socket_instances entries found');
      }
    } catch (error) {
      console.error('Error cleaning up socket_instances:', error);
    }
  }

  // バッチ削除ヘルパーメソッド
  private async deleteSocketInstancesBatch(keys: Deno.KvKey[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      await this.ensureKV();
      const atomicOp = this.kv!.atomic();

      for (const key of keys) {
        atomicOp.delete(key);
      }

      await atomicOp.commit();
    } catch (error) {
      console.error('Error deleting socket_instances batch:', error);
    }
  }
}
