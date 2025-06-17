import { Room, RoomId, UserToken } from '@/backend/type.ts';
import { getStoreManager } from './storeManager.ts';

// StoreManagerを再エクスポート
export { getStoreManager } from './storeManager.ts';

/**
 * 既存のAPIと互換性を持つラッパー関数群
 * これらの関数は内部でStoreManagerを使い、適切なストアの実装を呼び出します
 */

// 部屋の作成
export const createRoom = async (
  userToken: UserToken,
  userName: string
): Promise<Room> => {
  return await getStoreManager().getRoomStore().createRoom(userToken, userName);
};

// 部屋の存在確認
export const isExistTheRoom = async (roomId: RoomId): Promise<boolean> => {
  return await getStoreManager().getRoomStore().isExistTheRoom(roomId);
};

// 部屋への入室
export const enterTheRoom = async (params: {
  roomId: RoomId;
  userToken: UserToken;
  userName: string;
}): Promise<Room | undefined> => {
  return await getStoreManager().getRoomStore().enterTheRoom(params);
};

// 回答の設定
export const answer = async (params: {
  roomId: RoomId;
  userToken: UserToken;
  answer: string;
}): Promise<Room | undefined> => {
  return await getStoreManager().getRoomStore().answer(params);
};

// 回答のクリア
export const clearAnswer = async (
  roomId: RoomId
): Promise<Room | undefined> => {
  return await getStoreManager().getRoomStore().clearAnswer(roomId);
};

// 部屋からの退出
export const exitRoom = async (
  userToken: UserToken
): Promise<Room | undefined> => {
  return await getStoreManager().getRoomStore().exitRoom(userToken);
};

// 空の部屋を閉じる
export const closeEmptyRoom = async (): Promise<void> => {
  await getStoreManager().getRoomStore().closeEmptyRoom();
};

// 部屋を閉じる（内部使用）
export const closeRoom = async (roomId: RoomId): Promise<void> => {
  await getStoreManager().getRoomStore().closeRoom(roomId);
};

// WebSocket取得
export const getSocket = (userToken: UserToken): WebSocket | undefined => {
  return getStoreManager().getSocketStore().getSocket(userToken);
};

// WebSocket追加
export const addSocket = async (
  userToken: UserToken,
  socket: WebSocket
): Promise<void> => {
  await getStoreManager().getSocketStore().addSocket(userToken, socket);
};

// WebSocket削除
export const deleteSocket = async (userToken: UserToken): Promise<void> => {
  await getStoreManager().getSocketStore().deleteSocket(userToken);
};

// 現在使用しているストアの種類を取得
export const isUsingKVStore = (): boolean => {
  return getStoreManager().isUsingKV();
};
