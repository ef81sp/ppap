import { UserToken } from "../backend/type.ts"

const msgType = ["createRoom"] as const
type MsgFromClient = MsgCreateRoom

type MsgCreateRoom = {
  type: "createRoom"
  userToken: UserToken
  userName: string
}

export const isMsgFromClient = (data: unknown): data is MsgFromClient => {
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
  if (!("userToken" in data && typeof data.userToken === "string")) return false

  return true
}

export const genMsgCreateRoom = (userToken: UserToken, userName: string): MsgFromClient => ({
  type: "createRoom",
  userToken,
  userName
})
