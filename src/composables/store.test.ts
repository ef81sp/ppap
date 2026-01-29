import { beforeEach, describe, expect, it } from "vitest"
import { clearStore, room, setName, setRoom, setToken, user } from "./store.ts"
import type { RoomForClient } from "@/backend/type.ts"

describe("store", () => {
  beforeEach(() => {
    clearStore()
  })

  describe("user", () => {
    it("初期状態は name と token が空文字", () => {
      expect(user.name.value).toBe("")
      expect(user.token.value).toBe("")
    })

    it("setName で name が更新される", () => {
      setName("山田太郎")
      expect(user.name.value).toBe("山田太郎")
    })

    it("setToken で token が更新される", () => {
      setToken("abc123")
      expect(user.token.value).toBe("abc123")
    })
  })

  describe("room", () => {
    it("初期状態は room が null", () => {
      expect(room.value).toBe(null)
    })

    it("setRoom で room が更新される", () => {
      const mockRoom: RoomForClient = {
        id: "room-123",
        participants: [
          { name: "山田太郎", userNumber: 1, isMe: true, answer: "", isAudience: false },
          { name: "鈴木一郎", userNumber: 2, isMe: false, answer: "", isAudience: false },
        ],
        config: { allowSpectators: true, maxParticipants: 10 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      setRoom(mockRoom)

      expect(room.value).not.toBe(null)
      expect(room.value?.id).toBe("room-123")
      expect(room.value?.participants.length).toBe(2)
    })

    it("setRoom で room の内容が正しく反映される", () => {
      const mockRoom: RoomForClient = {
        id: "test-room",
        participants: [
          { name: "テストユーザー", userNumber: 1, isMe: true, answer: "5", isAudience: true },
        ],
        config: { allowSpectators: true, maxParticipants: 10 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      setRoom(mockRoom)

      expect(room.value?.participants[0].name).toBe("テストユーザー")
      expect(room.value?.participants[0].answer).toBe("5")
      expect(room.value?.participants[0].isAudience).toBe(true)
    })
  })

  describe("clearStore", () => {
    it("clearStore で全ての状態がリセットされる", () => {
      setName("山田太郎")
      setToken("abc123")
      setRoom({
        id: "room-123",
        participants: [],
        config: { allowSpectators: true, maxParticipants: 10 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      clearStore()

      expect(user.name.value).toBe("")
      expect(user.token.value).toBe("")
      expect(room.value).toBe(null)
    })
  })
})
