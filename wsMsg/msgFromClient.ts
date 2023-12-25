import { RoomId, UserToken } from "../backend/type.ts"

const msgType = {
  createRoom: "createRoom",
  isExistTheRoom: "isExistTheRoom",
  enterTheRoom: "enterTheRoom",
  answer: "answer",
  clearAnswer: "clearAnswer",
} as const

type MsgFromClient =
  | MsgCreateRoom
  | MsgIsExistTheRoom
  | MsgEnterTheRoom
  | MsgAnswer
  | MsgClearAnswer

type MsgCreateRoom = {
  type: (typeof msgType)["createRoom"]
  userToken: UserToken
  userName: string
}
type MsgIsExistTheRoom = {
  type: (typeof msgType)["isExistTheRoom"]
  roomId: RoomId
}
type MsgEnterTheRoom = {
  type: (typeof msgType)["enterTheRoom"]
  userToken: UserToken
  userName: string
  roomId: RoomId
}
type MsgAnswer = {
  type: (typeof msgType)["answer"]
  userToken: UserToken
  roomId: RoomId
  answer: string
}
type MsgClearAnswer = {
  type: (typeof msgType)["clearAnswer"]
  roomId: RoomId
}

export const isMsgFromClient = (data: unknown): data is MsgFromClient => {
  if (data == undefined) return false
  if (typeof data !== "object") return false
  if (
    !(
      "type" in data &&
      typeof data.type === "string" &&
      Object.values(msgType).some((v) => v === data.type)
    )
  ) {
    return false
  }

  return true
}

// =====================

export const genMsgCreateRoom = (
  userToken: UserToken,
  userName: string,
): MsgFromClient => ({
  type: "createRoom",
  userToken,
  userName,
})
export const genMsgIsExistTheRoom = (roomId: RoomId): MsgIsExistTheRoom => ({
  type: "isExistTheRoom",
  roomId,
})
export const genMsgEnterTheRoom = ({
  userToken,
  userName,
  roomId,
}: Omit<MsgEnterTheRoom, "type">): MsgEnterTheRoom => ({
  type: "enterTheRoom",
  userToken,
  userName,
  roomId,
})
export const genMsgAnswer = ({
  userToken,
  roomId,
  answer,
}: Omit<MsgAnswer, "type">): MsgAnswer => ({
  type: "answer",
  userToken,
  roomId,
  answer,
})
export const genMsgClearAnswer = (roomId: RoomId): MsgClearAnswer => ({
  type: "clearAnswer",
  roomId,
})
