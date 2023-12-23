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
  answers: Map<UserToken, string | null>
}
