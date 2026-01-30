import { assertEquals } from "jsr:@std/assert"
import { WatcherManager } from "./watcherManager.ts"

Deno.test("WatcherManager", async (t) => {
  await t.step("ルームのwatcherを登録できる", () => {
    const manager = new WatcherManager()
    const controller = new AbortController()

    manager.register("room1", controller)

    assertEquals(manager.has("room1"), true)
  })

  await t.step("ルームのwatcherを停止できる", () => {
    const manager = new WatcherManager()
    const controller = new AbortController()

    manager.register("room1", controller)
    manager.stop("room1")

    assertEquals(controller.signal.aborted, true)
    assertEquals(manager.has("room1"), false)
  })

  await t.step("存在しないルームのstopはエラーにならない", () => {
    const manager = new WatcherManager()

    manager.stop("nonexistent") // エラーにならない

    assertEquals(manager.has("nonexistent"), false)
  })

  await t.step("複数ルームを独立して管理できる", () => {
    const manager = new WatcherManager()
    const controller1 = new AbortController()
    const controller2 = new AbortController()

    manager.register("room1", controller1)
    manager.register("room2", controller2)
    manager.stop("room1")

    assertEquals(controller1.signal.aborted, true)
    assertEquals(controller2.signal.aborted, false)
    assertEquals(manager.has("room1"), false)
    assertEquals(manager.has("room2"), true)
  })
})
