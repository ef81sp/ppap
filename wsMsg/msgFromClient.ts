import { RoomId } from "@/backend/type.ts"

const msgType = {
  answer: "answer",
  clearAnswer: "clearAnswer",
  setAudience: "setAudience",
} as const

type MsgFromClient = MsgAnswer | MsgClearAnswer | MsgSetAudience

type MsgAnswer = {
  type: (typeof msgType)["answer"]
  answer: string
}
type MsgClearAnswer = {
  type: (typeof msgType)["clearAnswer"]
}
type MsgSetAudience = {
  type: (typeof msgType)["setAudience"]
  isAudience: boolean
}

export const isMsgFromClient = (data: unknown): data is MsgFromClient => {
  if (data == undefined) return false
  if (typeof data !== "object") return false
  if (
    !(
      "type" in data &&
      typeof (data as any).type === "string" &&
      Object.values(msgType).some((v) => v === (data as any).type)
    )
  ) {
    return false
  }
  if (
    (data as any).type === "answer" &&
    typeof (data as any).answer !== "string"
  ) {
    return false
  }
  return true
}

// =====================

export const genMsgAnswer = (answer: string): MsgAnswer => ({
  type: "answer",
  answer,
})
export const genMsgClearAnswer = (): MsgClearAnswer => ({
  type: "clearAnswer",
})
export const genMsgSetAudience = (isAudience: boolean): MsgSetAudience => ({
  type: "setAudience",
  isAudience,
})
