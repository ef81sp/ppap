import { RoomForClientSide, RoomId, UserToken } from "@/backend/type.ts"

export type MsgFromServer =
  | MsgConnected
  | MsgRoomCreated
  | MsgIsExistTheRoomResult
  | MsgRoomInfo

const _msgType = {
  connected: "connected",
  roomCreated: "roomCreated",
  isExistTheRoomResult: "isExistTheRoomResult",
  roomInfo: "roomInfo",
} as const
type MsgConnected = {
  type: (typeof _msgType)["connected"]
  userToken: string
}
type MsgRoomCreated = {
  type: (typeof _msgType)["roomCreated"]
  roomId: string
}
type MsgIsExistTheRoomResult = {
  type: (typeof _msgType)["isExistTheRoomResult"]
  isExistTheRoom: boolean
}
type MsgRoomInfo = {
  type: (typeof _msgType)["roomInfo"]
  room: RoomForClientSide
}

export const isMsgFromServer = (data: unknown): data is MsgFromServer => {
  if (data == undefined) return false
  if (typeof data !== "object") return false
  if (
    !(
      "type" in data &&
      typeof data.type === "string" &&
      Object.values(_msgType).some((v) => v === data.type)
    )
  ) {
    return false
  }

  return true
}

export const genMsgConnected = (userToken: UserToken): MsgConnected => ({
  type: "connected",
  userToken,
})
export const genMsgRoomCreated = (roomId: RoomId): MsgRoomCreated => ({
  type: "roomCreated",
  roomId,
})
export const genMsgIsExistTheRoomResult = (
  isExistTheRoom: boolean,
): MsgIsExistTheRoomResult => ({
  type: "isExistTheRoomResult",
  isExistTheRoom,
})
export const genMsgRoomInfo = (room: RoomForClientSide): MsgRoomInfo => ({
  type: "roomInfo",
  room,
})
