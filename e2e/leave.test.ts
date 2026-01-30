import { assertEquals } from "std/assert/mod.ts"
import { getDocument, queries } from "playwright-testing-library"
import {
  cleanupKVStore,
  createRoomAndJoin,
  getParticipantCount,
  isServerRunning,
  joinRoom,
  setupBrowser,
} from "./helpers.ts"

Deno.test("退室機能のテスト", async (t) => {
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error("テスト実行前にサーバーを起動してください: deno task serve")
    }
  })

  await cleanupKVStore()
  const browser = await setupBrowser()

  await t.step("exitボタンで退室できること", async () => {
    // ルームを作成して参加
    const { page, context, roomUrl: _roomUrl } = await createRoomAndJoin(browser, "ExitTestUser")

    try {
      // exitボタンを探してクリック
      const $document = await getDocument(page)
      const $exitButton = await queries.getByRole($document, "button", { name: "exit" })
      await $exitButton.click()

      // トップページに遷移したことを確認
      await page.waitForURL(/\/#\/$|\/$/i, { timeout: 5000 })

      // トップページの要素が表示されているか確認
      const $newDocument = await getDocument(page)
      const $createRoomHeading = await queries.getByText($newDocument, "Create New Room")
      assertEquals(await $createRoomHeading.textContent(), "Create New Room")
    } finally {
      await page.close()
      await context.close()
    }
  })

  await t.step("退室後に参加者リストから削除される", async () => {
    // ホストがルームを作成
    const { page: hostPage, context: hostContext, roomUrl } = await createRoomAndJoin(
      browser,
      "HostUser",
    )

    try {
      // ゲストが参加
      const { page: guestPage, context: guestContext } = await joinRoom(
        browser,
        roomUrl,
        "GuestUser",
      )

      try {
        // ホストの画面で参加者が2人いることを確認
        await hostPage.waitForTimeout(2000)
        const hostParticipantCount = await getParticipantCount(hostPage)
        assertEquals(hostParticipantCount, 2, "参加者は2人であるべき")

        // ゲストが退室
        const $guestDocument = await getDocument(guestPage)
        const $exitButton = await queries.getByRole($guestDocument, "button", { name: "exit" })
        await $exitButton.click()

        // ゲストがトップページに遷移するのを待つ
        await guestPage.waitForURL(/\/#\/$|\/$/i, { timeout: 5000 })

        // ホストの画面で参加者が1人に減ったことを確認
        await hostPage.waitForTimeout(2000)
        const hostParticipantCountAfter = await getParticipantCount(hostPage)
        assertEquals(hostParticipantCountAfter, 1, "退室後は参加者が1人になるべき")
      } finally {
        await guestPage.close()
        await guestContext.close()
      }
    } finally {
      await hostPage.close()
      await hostContext.close()
    }
  })

  await browser.close()
  await cleanupKVStore()
})
