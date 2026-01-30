import { assertExists } from "jsr:@std/assert"
import { getDocument, queries } from "playwright-testing-library"
import {
  BASE_URL,
  cleanupKVStore,
  isServerRunning,
  selectAnswer,
  setupBrowser,
} from "./helpers.ts"

Deno.test("セッション復帰のテスト", async (t) => {
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error("テスト実行前にサーバーを起動してください: deno task serve")
    }
  })

  await cleanupKVStore()
  const browser = await setupBrowser()

  await t.step("ページリロード後にルームに復帰できる", async () => {
    // 同一コンテキストを使用してセッションを維持
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      // トップページにアクセス
      await page.goto(BASE_URL)

      // ルームを作成
      let $document = await getDocument(page)
      const $nameInput = await queries.getByRole($document, "textbox")
      await $nameInput.fill("RejoinTestUser")
      const $createButton = await queries.getByRole($document, "button")
      await $createButton.click()

      // ルームに遷移したことを確認
      await page.waitForURL(/\/#\/[a-z0-9\-]+/)
      const roomUrl = page.url()

      // ルーム画面が表示されていることを確認
      $document = await getDocument(page)
      await queries.getByRole($document, "heading", { name: "Room" })

      // ページをリロード
      await page.reload()
      await page.waitForTimeout(2000)

      // 名前入力がスキップされ、直接ルーム画面が表示されることを確認
      // URL が同じルームのまま
      const currentUrl = page.url()
      if (!currentUrl.includes(roomUrl.split("/#/")[1])) {
        throw new Error("リロード後にルームURLが変わっています")
      }

      // ルーム画面の要素が表示されている（名前入力画面ではない）
      const $reloadedDocument = await getDocument(page)
      const $roomHeading = await queries.queryByRole($reloadedDocument, "heading", { name: "Room" })
      assertExists($roomHeading, "リロード後にRoom画面が表示されるべき")

      // 投票オプションが表示されている
      const $voteButton = await queries.queryByText($reloadedDocument, "5")
      assertExists($voteButton, "リロード後に投票オプションが表示されるべき")
    } finally {
      await page.close()
      await context.close()
    }
  })

  await t.step("rejoin後もWebSocket接続が正常に機能する", async () => {
    // 同一コンテキストを使用してセッションを維持
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      // トップページにアクセス
      await page.goto(BASE_URL)

      // ルームを作成
      let $document = await getDocument(page)
      const $nameInput = await queries.getByRole($document, "textbox")
      await $nameInput.fill("WebSocketTestUser")
      const $createButton = await queries.getByRole($document, "button")
      await $createButton.click()

      // ルームに遷移
      await page.waitForURL(/\/#\/[a-z0-9\-]+/)
      await page.waitForTimeout(1000)

      // ページをリロード
      await page.reload()
      await page.waitForTimeout(2000)

      // リロード後に回答を送信できることを確認
      $document = await getDocument(page)

      // 投票オプションが表示されるまで待機
      const $voteOption = await queries.queryByText($document, "8")
      assertExists($voteOption, "投票オプションが表示されるべき")

      // 回答を選択
      await selectAnswer(page, "8")
      await page.waitForTimeout(500)

      // 回答が選択されたことを確認（ボタンが選択状態になる）
      $document = await getDocument(page)
      const $selectedButton = await queries.getByText($document, "8")
      const isSelected = await $selectedButton.evaluate((el) => {
        return (el as HTMLElement).classList.contains("-translate-y-3")
      })
      if (!isSelected) {
        throw new Error("リロード後に回答を送信できませんでした")
      }
    } finally {
      await page.close()
      await context.close()
    }
  })

  await browser.close()
  await cleanupKVStore()
})
