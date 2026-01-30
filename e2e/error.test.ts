import { assertEquals, assertExists } from "std/assert/mod.ts"
import { getDocument, queries } from "playwright-testing-library"
import {
  BASE_URL,
  cleanupKVStore,
  createPage,
  isServerRunning,
  setupBrowser,
} from "./helpers.ts"

Deno.test("エラーハンドリングのテスト", async (t) => {
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error("テスト実行前にサーバーを起動してください: deno task serve")
    }
  })

  await cleanupKVStore()
  const browser = await setupBrowser()

  await t.step("存在しないルームIDでアクセス", async () => {
    // 存在しないルームIDでアクセス（確実に存在しないUUID形式）
    const fakeRoomId = "00000000-0000-0000-0000-000000000000"
    const fakeRoomUrl = `${BASE_URL}/#/${fakeRoomId}`
    const { page, context } = await createPage(browser, fakeRoomUrl)

    try {
      // 少し待機
      await page.waitForTimeout(2000)

      // 名前入力画面が表示される
      const $document = await getDocument(page)
      const $nameInput = await queries.queryByRole($document, "textbox")
      assertExists($nameInput, "名前入力フォームが表示されるべき")

      // 名前を入力して参加を試みる
      await $nameInput.fill("ErrorTestUser")

      // alertダイアログをハンドルするための設定
      let alertMessage = ""
      page.on("dialog", async (dialog) => {
        alertMessage = dialog.message()
        await dialog.dismiss()
      })

      const $joinButton = await queries.getByRole($document, "button")
      await $joinButton.click()

      // 参加後にalertが表示されるのを待つ
      await page.waitForTimeout(3000)

      // 存在しないルームへの参加試行時にalertが表示されることを確認
      // （現在のアプリ仕様ではalertでエラーを通知する）
      assertEquals(alertMessage.length > 0, true, "存在しないルームでは参加時にalertが表示されるべき")
    } finally {
      await page.close()
      await context.close()
    }
  })

  await t.step("名前未入力でルーム作成できない", async () => {
    const { page, context } = await createPage(browser)

    try {
      const $document = await getDocument(page)

      // 名前入力フィールドを空のまま
      const $nameInput = await queries.getByRole($document, "textbox")
      await $nameInput.fill("") // 明示的に空に

      // ルーム作成ボタンをクリック
      const $createButton = await queries.getByRole($document, "button", { name: "Create Room" })
      await $createButton.click()

      // 少し待機
      await page.waitForTimeout(1000)

      // ルームに遷移していないことを確認（URLが変わっていない）
      const currentUrl = page.url()
      const isStillOnTopPage = currentUrl === BASE_URL || currentUrl === `${BASE_URL}/` ||
        currentUrl === `${BASE_URL}/#/`
      assertEquals(isStillOnTopPage, true, "名前未入力ではルームに遷移しないべき")

      // バリデーションエラー表示されているか確認（HTML5のrequired属性による）
      // ブラウザのネイティブバリデーションが動作している場合は、
      // 入力フィールドが無効状態になっている
      const isInvalid = await $nameInput.evaluate((el) => {
        return !(el as HTMLInputElement).validity.valid
      })
      assertEquals(isInvalid, true, "名前入力フィールドがバリデーションエラー状態になるべき")
    } finally {
      await page.close()
      await context.close()
    }
  })

  await t.step("名前未入力でルーム参加できない", async () => {
    // まず有効なルームを作成
    const { page: hostPage, context: hostContext } = await createPage(browser)

    try {
      let $document = await getDocument(hostPage)
      const $nameInput = await queries.getByRole($document, "textbox")
      await $nameInput.fill("ValidHost")
      const $createButton = await queries.getByRole($document, "button")
      await $createButton.click()

      await hostPage.waitForURL(/\/#\/[a-z0-9\-]+/)
      const roomUrl = hostPage.url()

      // 別ユーザーが名前未入力で参加を試みる
      const { page: guestPage, context: guestContext } = await createPage(browser, roomUrl)

      try {
        $document = await getDocument(guestPage)

        // 名前入力フィールドを空のまま
        const $guestNameInput = await queries.getByRole($document, "textbox")
        await $guestNameInput.fill("") // 明示的に空に

        // 参加ボタンをクリック
        const $joinButton = await queries.getByRole($document, "button")
        await $joinButton.click()

        // 少し待機
        await guestPage.waitForTimeout(1000)

        // ルーム参加画面から移動していないことを確認
        // 名前入力フィールドがまだ存在する
        $document = await getDocument(guestPage)
        const $inputStillExists = await queries.queryByRole($document, "textbox")
        assertExists($inputStillExists, "名前未入力では参加画面から移動しないべき")

        // バリデーションエラー状態になっている
        const isInvalid = await $inputStillExists.evaluate((el) => {
          return !(el as HTMLInputElement).validity.valid
        })
        assertEquals(isInvalid, true, "名前入力フィールドがバリデーションエラー状態になるべき")
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
