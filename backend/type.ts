export type UserToken = string

export type UserTokenInfo = {
  token: UserToken
  currentRoomId: string | null
  name: string
  isSpectator: boolean
  lastAccessedAt: number // UNIXタイムスタンプ(ms)
}

export type RoomId = string
export type Room = {
  id: RoomId
  participants: Array<{
    token: UserToken
    name: string
    answer: string
    isAudience: boolean
  }>
  config: {
    allowSpectators: boolean
    maxParticipants: number
  }
  createdAt: number // UNIXタイムスタンプ(ms)
  updatedAt: number // UNIXタイムスタンプ(ms)
}

// クライアント用のルーム情報型（UserTokenを含まない）
export type RoomForClient = {
  id: RoomId
  participants: Array<{
    name: string
    userNumber: number
    isMe: boolean
    answer: string
    isAudience: boolean
    // 必要に応じて他の公開情報を追加
  }>
  config: {
    allowSpectators: boolean
    maxParticipants: number
  }
  createdAt: number
  updatedAt: number
}

// APIリクエスト・レスポンス型
export type CreateRoomRequest = {
  userName: string // 設計書KVS設計とフローに基づき必須
}
export type CreateRoomResponse = {
  roomId: string
  userToken: string
  userNumber: number // 追加: 自分のuserNumber
  room: RoomForClient
}

export type JoinRoomRequest = {
  userName: string
  userToken?: string
}
export type JoinRoomResponse = {
  userToken: string
  userNumber: number // 追加: 自分のuserNumber
  room: RoomForClient
}

export type LeaveRoomRequest = {
  userToken: string
}
export type LeaveRoomResponse = {
  message: string
}

export type RejoinRoomRequest = {
  userToken: string
}
export type RejoinRoomResponse = {
  userToken: string
  userNumber: number
  room: RoomForClient
  userName: string
}
