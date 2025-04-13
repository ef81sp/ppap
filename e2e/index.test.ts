import { Browser } from "playwright"
import { assertEquals, assertExists } from "std/assert/mod.ts"
import { setupBrowser, createPage, isServerRunning } from "./helpers.ts"

// テストをグループ化してリソースを適切に管理
Deno.test("トップページのテスト", async (t) => {
  // テスト開始前にサーバーが起動しているか確認
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error("テスト実行前にサーバーを起動してください: deno task serve")
    }
  });
  
  // テスト用のブラウザを一度だけ起動
  const browser = await setupBrowser()
  
  // 各テストケースを実行
  await t.step("トップページが正しく表示されること", async () => {
    const { page, context } = await createPage(browser)
    
    try {
      // トップページのタイトルが表示されているか確認
      const createRoomText = await page.textContent("h2")
      assertEquals(createRoomText, "Create Room")
      
      // 名前入力フォームが表示されているか確認
      const nameInput = await page.locator("input[type='text']")
      assertExists(await nameInput.count())
      
      // ボタンが表示されているか確認
      const createButton = await page.getByText("create room")
      assertExists(await createButton.count())
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close()
      await context.close()
    }
  });

  await t.step("ユーザー名を入力してルームを作成できること", async () => {
    const { page, context } = await createPage(browser)
    
    try {
      // 名前を入力
      await page.fill("input[type='text']", "TestUser")
      
      // フォームを送信
      await page.click("button")
      
      // URLが変わるのを待つ (ルームに遷移したことを確認)
      await page.waitForURL(/\/#\/[a-z0-9\-]+/)
      
      // ルームページに移動したことを確認
      const roomTitleText = await page.textContent("h2")
      assertEquals(roomTitleText, "Room")
      
      // コピーURLボタンが表示されているか確認
      const copyUrlButton = await page.getByText("copy URL")
      assertExists(await copyUrlButton.count())
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close()
      await context.close()
    }
  });
  
  // テスト完了後にブラウザを閉じる
  await browser.close()
});