import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { joinRoomApi, rejoinRoomApi } from "./fetchApi.ts"

describe("fetchApi", () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    mockFetch.mockReset()
  })

  describe("joinRoomApi", () => {
    it("正しいエンドポイントを呼ぶ", async () => {
      const mockResponse = {
        userToken: "token123",
        room: { roomId: "room-123", members: [], isRevealed: false },
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await joinRoomApi("room-123", { userName: "山田太郎" })

      expect(mockFetch).toHaveBeenCalledWith("/api/rooms/room-123/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: "山田太郎" }),
      })
    })

    it("レスポンスを正しく返す", async () => {
      const mockResponse = {
        userToken: "token123",
        room: { roomId: "room-123", members: [], isRevealed: false },
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await joinRoomApi("room-123", { userName: "山田太郎" })

      expect(result).toEqual(mockResponse)
    })

    it("エラー時に例外をスローする", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      await expect(joinRoomApi("room-123", { userName: "山田太郎" })).rejects.toThrow(
        "ルーム参加APIに失敗しました",
      )
    })
  })

  describe("rejoinRoomApi", () => {
    it("正しいエンドポイントを呼ぶ", async () => {
      const mockResponse = {
        room: { roomId: "room-123", members: [], isRevealed: false },
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await rejoinRoomApi("room-123", { userToken: "token123" })

      expect(mockFetch).toHaveBeenCalledWith("/api/rooms/room-123/rejoin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: "token123" }),
      })
    })

    it("レスポンスを正しく返す", async () => {
      const mockResponse = {
        room: { roomId: "room-123", members: [], isRevealed: false },
      }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await rejoinRoomApi("room-123", { userToken: "token123" })

      expect(result).toEqual(mockResponse)
    })

    it("エラー時に例外をスローする", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      })

      await expect(rejoinRoomApi("room-123", { userToken: "invalid" })).rejects.toThrow(
        "再入場APIに失敗しました",
      )
    })
  })
})
