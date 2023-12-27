export type UserToken = string
export type User = {
  token: UserToken
  name: string
  answer: string
}
export type UsersSockets = Map<UserToken, WebSocket>

export type RoomId = string
export type Room = {
  id: string
  participants: User[]
  isOpen: boolean
}

export type UserForClientSide = {
  name: string
  answer: string
  userNumber: number
  isMe: boolean
}
export type RoomForClientSide = {
  id: string
  participants: UserForClientSide[]
  isOpen: boolean
}
