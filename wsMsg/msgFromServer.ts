import { RoomId, UserToken } from "../backend/type.ts"

const msgType = ["connected", "roomCreated"] as const

export type MsgFromServer = MsgConnected | MsgRoomCreated
type MsgConnected = {
  type: "connected"
  userToken: string
}
type MsgRoomCreated = {
  type: "roomCreated"
  roomId: string
}

export const isMsgFromServer = (data: unknown): data is MsgFromServer => {
  if (data == undefined) return false
  if (typeof data !== "object") return false
  if (
    !(
      "type" in data &&
      typeof data.type === "string" &&
      msgType.some((v) => v === data.type)
    )
  )
    return false

  return true
}

export const genMsgConnected = (userToken: UserToken): MsgConnected => ({
  type: "connected",
  userToken,
})

export const gemMsgRoomCreated = (roomId: RoomId): MsgRoomCreated => ({
  type: "roomCreated",
  roomId
})