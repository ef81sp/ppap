import { assertEquals } from "jsr:@std/assert"
import { DisconnectTimerManager } from "./disconnectTimer.ts"

Deno.test("DisconnectTimerManager", async (t) => {
  await t.step("setとcancelが動作する", async () => {
    const manager = new DisconnectTimerManager()
    let called = false

    manager.set("room1", "user1", () => {
      called = true
    }, 50)

    // キャンセル前はタイマーが存在する
    assertEquals(manager.has("room1", "user1"), true)

    // キャンセル
    manager.cancel("room1", "user1")
    assertEquals(manager.has("room1", "user1"), false)

    // 待機してもコールバックは呼ばれない
    await new Promise((r) => setTimeout(r, 100))
    assertEquals(called, false)
  })

  await t.step("タイマー完了後にコールバックが呼ばれる", async () => {
    const manager = new DisconnectTimerManager()
    let called = false

    manager.set("room1", "user1", () => {
      called = true
    }, 50)

    // 待機
    await new Promise((r) => setTimeout(r, 100))

    assertEquals(called, true)
    // 完了後はタイマーが削除される
    assertEquals(manager.has("room1", "user1"), false)
  })

  await t.step("同じキーで再設定すると既存タイマーがクリアされる", async () => {
    const manager = new DisconnectTimerManager()
    let callCount = 0

    manager.set("room1", "user1", () => {
      callCount++
    }, 50)

    // 再設定
    manager.set("room1", "user1", () => {
      callCount += 10
    }, 50)

    await new Promise((r) => setTimeout(r, 100))

    // 最後に設定したコールバックのみ呼ばれる
    assertEquals(callCount, 10)
  })

  await t.step("存在しないキーのcancelはエラーにならない", () => {
    const manager = new DisconnectTimerManager()
    // エラーが発生しないことを確認
    manager.cancel("nonexistent", "user")
    assertEquals(manager.has("nonexistent", "user"), false)
  })

  await t.step("異なるルーム・ユーザーは独立して管理される", async () => {
    const manager = new DisconnectTimerManager()
    const results: string[] = []

    manager.set("room1", "user1", () => results.push("r1u1"), 30)
    manager.set("room1", "user2", () => results.push("r1u2"), 30)
    manager.set("room2", "user1", () => results.push("r2u1"), 30)

    // room1:user1のみキャンセル
    manager.cancel("room1", "user1")

    await new Promise((r) => setTimeout(r, 80))

    assertEquals(results.includes("r1u1"), false)
    assertEquals(results.includes("r1u2"), true)
    assertEquals(results.includes("r2u1"), true)
  })
})
