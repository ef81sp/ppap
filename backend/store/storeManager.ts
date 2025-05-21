import { RoomStore, SocketStore } from "./interfaces.ts";
import { MemoryRoomStore } from "./memory/memoryRoomStore.ts";
import { MemorySocketStore } from "./memory/memorySocketStore.ts";
import { KVRoomStore } from "./kv/kvRoomStore.ts";
import { KVSocketStore } from "./kv/kvSocketStore.ts";

/**
 * ストアの実装を切り替えるためのマネージャークラス
 */
export class StoreManager {
  private roomStore: RoomStore;
  private socketStore: SocketStore;
  private useKV: boolean;

  constructor() {
    // 環境変数で実装を切り替え
    this.useKV = Deno.env.get("USE_KV_STORE") === "true";
    console.log(`StoreManager: Using ${this.useKV ? "KV" : "Memory"} store`);

    // 選択された実装のインスタンスを作成
    if (this.useKV) {
      this.roomStore = new KVRoomStore();
      this.socketStore = new KVSocketStore();
    } else {
      this.roomStore = new MemoryRoomStore();
      this.socketStore = new MemorySocketStore();
    }
  }

  /**
   * RoomStoreを取得
   */
  getRoomStore(): RoomStore {
    return this.roomStore;
  }

  /**
   * SocketStoreを取得
   */
  getSocketStore(): SocketStore {
    return this.socketStore;
  }

  /**
   * KVを使用しているかどうか
   */
  isUsingKV(): boolean {
    return this.useKV;
  }
}

// シングルトンインスタンス
let storeManager: StoreManager | null = null;

/**
 * StoreManagerのシングルトンインスタンスを取得
 */
export function getStoreManager(): StoreManager {
  if (!storeManager) {
    storeManager = new StoreManager();
  }
  return storeManager;
}