import { UserToken } from "@/backend/type.ts";
import { SocketStore } from "../interfaces.ts";

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

  constructor() {
    // このインスタンス固有のID
    this.instanceId = crypto.randomUUID();
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
    await this.kv!.set(["socket_instances", userToken], this.instanceId);
  }

  async deleteSocket(userToken: UserToken): Promise<void> {
    if (this.usersSockets.delete(userToken)) {
      console.log("deleted socket: ", userToken);
      // KVからインスタンスIDを削除
      await this.ensureKV();
      await this.kv!.delete(["socket_instances", userToken]);
    }
  }

  // このインスタンスIDを取得
  getInstanceId(): string {
    return this.instanceId;
  }

  // 指定されたユーザートークンがどのインスタンスに関連付けられているかを確認
  async getSocketInstance(userToken: UserToken): Promise<string | null> {
    await this.ensureKV();
    const result = await this.kv!.get<string>(["socket_instances", userToken]);
    return result.value;
  }
}