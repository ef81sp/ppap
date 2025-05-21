import { UserToken } from "@/backend/type.ts";
import { SocketStore } from "../interfaces.ts";

/**
 * メモリベースのSocketStore実装
 */
export class MemorySocketStore implements SocketStore {
  private usersSockets: Map<UserToken, WebSocket> = new Map();

  getSocket(userToken: UserToken): WebSocket | undefined {
    return this.usersSockets.get(userToken);
  }

  async addSocket(userToken: UserToken, socket: WebSocket): Promise<void> {
    this.usersSockets.set(userToken, socket);
  }

  async deleteSocket(userToken: UserToken): Promise<void> {
    if (this.usersSockets.delete(userToken)) {
      console.log("deleted socket: ", userToken);
    }
  }
  
  // メモリモードでは特に追加のクリーンアップは不要だが、インターフェース互換性のために実装
  async cleanupStaleSocketInstances(): Promise<void> {
    // メモリモードではsocket_instancesを使用しないため何もしない
    return Promise.resolve();
  }
}