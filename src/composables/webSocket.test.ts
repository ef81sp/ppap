import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"

// useWebSocketのモック
vi.mock("@vueuse/core", () => ({
  useWebSocket: vi.fn(),
}))

// storeのモック
vi.mock("./store.ts", () => ({
  setRoom: vi.fn(),
  user: {
    token: ref(""),
  },
}))

import { useWebSocket } from "@vueuse/core"
import { setRoom, user } from "./store.ts"
import { useRoomWebSocket } from "./webSocket.ts"

describe("webSocket", () => {
  const mockUseWebSocket = vi.mocked(useWebSocket)
  const mockSetRoom = vi.mocked(setRoom)

  let mockSend: ReturnType<typeof vi.fn>
  let mockOpen: ReturnType<typeof vi.fn>
  let mockClose: ReturnType<typeof vi.fn>
  let capturedOptions: Parameters<typeof useWebSocket>[1]

  beforeEach(() => {
    mockSend = vi.fn()
    mockOpen = vi.fn()
    mockClose = vi.fn()

    mockUseWebSocket.mockImplementation((_url, options) => {
      capturedOptions = options
      return {
        status: ref("CLOSED"),
        data: ref(null),
        send: mockSend,
        open: mockOpen,
        close: mockClose,
        ws: ref(null),
      } as any
    })

    // locationのモック
    vi.stubGlobal("location", {
      protocol: "http:",
      host: "localhost:8000",
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    user.token.value = ""
  })

  describe("useRoomWebSocket", () => {
    it("正しいWebSocket URLを生成する（HTTP）", () => {
      useRoomWebSocket("room-123")

      expect(mockUseWebSocket).toHaveBeenCalledWith(
        "ws://localhost:8000/ws/rooms/room-123",
        expect.any(Object),
      )
    })

    it("正しいWebSocket URLを生成する（HTTPS）", () => {
      vi.stubGlobal("location", {
        protocol: "https:",
        host: "ppap.deno.dev",
      })

      useRoomWebSocket("room-456")

      expect(mockUseWebSocket).toHaveBeenCalledWith(
        "wss://ppap.deno.dev/ws/rooms/room-456",
        expect.any(Object),
      )
    })

    it("immediateがfalseに設定されている", () => {
      useRoomWebSocket("room-123")

      expect(capturedOptions?.immediate).toBe(false)
    })

    it("autoReconnectが有効になっている", () => {
      useRoomWebSocket("room-123")

      expect(capturedOptions?.autoReconnect).toBe(true)
    })

    it("heartbeatが30秒間隔で設定されている", () => {
      useRoomWebSocket("room-123")

      expect(capturedOptions?.heartbeat).toEqual({
        message: "ping",
        interval: 30000,
      })
    })

    it("send, open, close関数を返す", () => {
      const result = useRoomWebSocket("room-123")

      expect(result.send).toBe(mockSend)
      expect(result.open).toBe(mockOpen)
      expect(result.close).toBe(mockClose)
    })
  })

  describe("onConnected", () => {
    const mockWs = {} as WebSocket

    it("接続時にuserTokenがあればauthメッセージを送信する", () => {
      user.token.value = "test-token"
      useRoomWebSocket("room-123")

      // onConnectedコールバックを呼び出し
      capturedOptions?.onConnected?.(mockWs)

      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: "auth", userToken: "test-token" }),
      )
    })

    it("接続時にuserTokenがなければauthメッセージを送信しない", () => {
      user.token.value = ""
      useRoomWebSocket("room-123")

      capturedOptions?.onConnected?.(mockWs)

      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe("onMessage", () => {
    const mockWs = {} as WebSocket

    it("roomメッセージを受信したらsetRoomを呼ぶ", () => {
      useRoomWebSocket("room-123")

      const mockRoom = {
        id: "room-123",
        participants: [],
        config: { allowSpectators: true, maxParticipants: 10 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const event = { data: JSON.stringify({ type: "room", room: mockRoom }) } as MessageEvent

      capturedOptions?.onMessage?.(mockWs, event)

      expect(mockSetRoom).toHaveBeenCalledWith(mockRoom)
    })

    it("roomプロパティがないメッセージはsetRoomを呼ばない", () => {
      useRoomWebSocket("room-123")

      const event = { data: JSON.stringify({ type: "room" }) } as MessageEvent

      capturedOptions?.onMessage?.(mockWs, event)

      expect(mockSetRoom).not.toHaveBeenCalled()
    })

    it("typeがroomでないメッセージはsetRoomを呼ばない", () => {
      useRoomWebSocket("room-123")

      const event = { data: JSON.stringify({ type: "pong" }) } as MessageEvent

      capturedOptions?.onMessage?.(mockWs, event)

      expect(mockSetRoom).not.toHaveBeenCalled()
    })

    it("不正なJSONでもエラーをスローしない", () => {
      useRoomWebSocket("room-123")

      const event = { data: "invalid json" } as MessageEvent

      // エラーをスローしないことを確認
      expect(() => {
        capturedOptions?.onMessage?.(mockWs, event)
      }).not.toThrow()

      expect(mockSetRoom).not.toHaveBeenCalled()
    })

    it("空のデータでもエラーをスローしない", () => {
      useRoomWebSocket("room-123")

      const event = { data: "" } as MessageEvent

      expect(() => {
        capturedOptions?.onMessage?.(mockWs, event)
      }).not.toThrow()
    })
  })
})
