import { describe, expect, it } from "vitest"
import {
  genMsgAnswer,
  genMsgClearAnswer,
  genMsgSetAudience,
  isMsgFromClient,
} from "./msgFromClient.ts"

describe("msgFromClient", () => {
  describe("isMsgFromClient", () => {
    it("answerメッセージを正しく判定する", () => {
      const msg = { type: "answer", answer: "5" }
      expect(isMsgFromClient(msg)).toBe(true)
    })

    it("clearAnswerメッセージを正しく判定する", () => {
      const msg = { type: "clearAnswer" }
      expect(isMsgFromClient(msg)).toBe(true)
    })

    it("setAudienceメッセージを正しく判定する", () => {
      const msg = { type: "setAudience", isAudience: true }
      expect(isMsgFromClient(msg)).toBe(true)
    })

    it("undefinedを拒否する", () => {
      expect(isMsgFromClient(undefined)).toBe(false)
    })

    it("nullを拒否する", () => {
      expect(isMsgFromClient(null)).toBe(false)
    })

    it("プリミティブ値を拒否する", () => {
      expect(isMsgFromClient("string")).toBe(false)
      expect(isMsgFromClient(123)).toBe(false)
      expect(isMsgFromClient(true)).toBe(false)
    })

    it("typeプロパティがないオブジェクトを拒否する", () => {
      expect(isMsgFromClient({})).toBe(false)
      expect(isMsgFromClient({ answer: "5" })).toBe(false)
    })

    it("不正なtypeを拒否する", () => {
      expect(isMsgFromClient({ type: "invalid" })).toBe(false)
      expect(isMsgFromClient({ type: 123 })).toBe(false)
    })

    it("answerメッセージでanswerが文字列でない場合を拒否する", () => {
      expect(isMsgFromClient({ type: "answer", answer: 123 })).toBe(false)
      expect(isMsgFromClient({ type: "answer" })).toBe(false)
    })
  })

  describe("genMsgAnswer", () => {
    it("正しいanswerメッセージを生成する", () => {
      const msg = genMsgAnswer("5")
      expect(msg).toEqual({ type: "answer", answer: "5" })
    })

    it("空文字のanswerメッセージを生成する", () => {
      const msg = genMsgAnswer("")
      expect(msg).toEqual({ type: "answer", answer: "" })
    })
  })

  describe("genMsgClearAnswer", () => {
    it("正しいclearAnswerメッセージを生成する", () => {
      const msg = genMsgClearAnswer()
      expect(msg).toEqual({ type: "clearAnswer" })
    })
  })

  describe("genMsgSetAudience", () => {
    it("isAudience=trueのメッセージを生成する", () => {
      const msg = genMsgSetAudience(true)
      expect(msg).toEqual({ type: "setAudience", isAudience: true })
    })

    it("isAudience=falseのメッセージを生成する", () => {
      const msg = genMsgSetAudience(false)
      expect(msg).toEqual({ type: "setAudience", isAudience: false })
    })
  })
})
