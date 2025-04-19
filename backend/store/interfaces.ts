import { Room, RoomId, UserToken } from "@/backend/type.ts";

// 部屋情報を管理するためのインターフェース
export interface RoomStore {
  createRoom(userToken: UserToken, userName: string): Promise<Room>;
  isExistTheRoom(roomId: RoomId): Promise<boolean>;
  enterTheRoom(params: {
    roomId: RoomId;
    userToken: UserToken;
    userName: string;
  }): Promise<Room | undefined>;
  answer(params: {
    roomId: RoomId;
    userToken: UserToken;
    answer: string;
  }): Promise<Room | undefined>;
  clearAnswer(roomId: RoomId): Promise<Room | undefined>;
  exitRoom(userToken: UserToken): Promise<Room | undefined>;
  closeEmptyRoom(): Promise<void>;
  closeRoom(roomId: RoomId): Promise<void>;
}

// WebSocket接続を管理するためのインターフェース
export interface SocketStore {
  getSocket(userToken: UserToken): WebSocket | undefined;
  addSocket(userToken: UserToken, socket: WebSocket): Promise<void>;
  deleteSocket(userToken: UserToken): Promise<void>;
  cleanupStaleSocketInstances(): Promise<void>;
}