export type UserToken = string;

export type UserTokenInfo = {
  token: UserToken;
  currentRoomId: string | null;
  name: string;
  isSpectator: boolean;
  lastAccessedAt: number; // UNIXタイムスタンプ(ms)
};

export type RoomId = string;
export type Room = {
  id: RoomId;
  name: string;
  participants: UserToken[]; // UserTokenの配列のみ保持
  answers: Record<UserToken, string>; // 回答内容
  config: {
    allowSpectators: boolean;
    maxParticipants: number;
  };
  createdAt: number; // UNIXタイムスタンプ(ms)
  updatedAt: number; // UNIXタイムスタンプ(ms)
};

// APIリクエスト・レスポンス型
export type CreateRoomRequest = {
  roomName?: string; // 設計書通り任意
  userName: string; // 設計書KVS設計とフローに基づき必須
};
export type CreateRoomResponse = {
  roomId: string;
  userToken: string;
  room: Room;
};

export type JoinRoomRequest = {
  userName: string;
  userToken?: string;
};
export type JoinRoomResponse = {
  userToken: string;
  room: Room;
};

export type LeaveRoomRequest = {
  userToken: string;
};
export type LeaveRoomResponse = {
  message: string;
};
