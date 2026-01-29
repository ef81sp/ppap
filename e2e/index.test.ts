import { Browser as _Browser } from "playwright"
import { assertEquals, assertExists } from "std/assert/mod.ts"
import { cleanupKVStore, createPage, isServerRunning, setupBrowser } from "./helpers.ts"
// Testing Libraryをインポート
import { getDocument, queries } from "playwright-testing-library"

// テストをグループ化してリソースを適切に管理
Deno.test("トップページのテスト", async (t) => {
  // テスト開始前にサーバーが起動しているか確認
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error(
        "テスト実行前にサーバーを起動してください: deno task serve",
      )
    }
  })

  // テスト開始前にKVストアをクリーンアップ
  await cleanupKVStore()

  // テスト用のブラウザを一度だけ起動
  const browser = await setupBrowser()

  // 各テストケースを実行
  await t.step("トップページが正しく表示されること", async () => {
    const { page, context: _context } = await createPage(browser)

    try {
      // Testing Libraryを使用してドキュメントを取得
      const $document = await getDocument(page)

      // トップページのタイトルが表示されているか確認
      const $heading = await queries.getByText($document, "Create New Room")
      assertEquals(await $heading.textContent(), "Create New Room")

      // 名前入力フォームが表示されているか確認 (label属性を使用)
      const $nameInput = await queries.getByLabelText($document, "Your Name *")
      assertExists($nameInput)

      // ボタンが表示されているか確認
      const $createButton = await queries.getByRole($document, "button", {
        name: "Create Room",
      })
      assertExists($createButton)
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close()
      await _context.close()
    }
  })

  await t.step("ユーザー名を入力してルームを作成できること", async () => {
    const { page, context: _context } = await createPage(browser)

    try {
      // Testing Libraryを使用してドキュメントを取得
      const $document = await getDocument(page)

      // 名前を入力
      const $nameInput = await queries.getByLabelText($document, "Your Name *")
      await $nameInput.fill("TestUser")

      // フォームを送信
      const $createButton = await queries.getByRole($document, "button", {
        name: "Create Room",
      })
      await $createButton.click()

      // URLが変わるのを待つ (ルームに遷移したことを確認)
      await page.waitForURL(/\/#\/[a-z0-9\-]+/)

      // 新しいドキュメントを取得（ページ遷移後）
      const $newDocument = await getDocument(page)

      // ルームページに移動したことを確認
      const $roomTitle = await queries.getByRole($newDocument, "heading", {
        name: "Room",
      })
      assertEquals(await $roomTitle.textContent(), "Room")

      // コピーURLボタンが表示されているか確認
      const $copyUrlButton = await queries.getByRole($newDocument, "button", {
        name: "copy URL",
      })
      assertExists($copyUrlButton)
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close()
      await _context.close()
    }
  })

  // テスト完了後にブラウザを閉じる
  await browser.close()

  // テスト完了後にKVストアをクリーンアップ
  await cleanupKVStore()
})
