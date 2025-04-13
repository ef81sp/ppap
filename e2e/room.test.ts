import { Browser } from "playwright"
import { assertEquals } from "std/assert/mod.ts"
import { setupBrowser, createPage, isServerRunning } from "./helpers.ts"

// テストをグループ化してリソースを適切に管理
Deno.test("ルーム機能のテスト", async (t) => {
  // テスト開始前にサーバーが起動しているか確認
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error("テスト実行前にサーバーを起動してください: deno task serve")
    }
  });
  
  // テスト用のブラウザを一度だけ起動
  const browser = await setupBrowser()
  let roomUrl = ""
  
  // 最初にルームを作成
  await t.step("テスト用のルームを作成", async () => {
    const { page, context } = await createPage(browser)
    
    try {
      console.log("トップページにアクセスしました");
      
      // 名前を入力してルームを作成
      await page.fill("input[type='text']", "HostUser")
      await page.click("button")
      console.log("ホストユーザーとしてルームを作成しました");
      
      // URLが変わるのを待つ (ルームに遷移したことを確認)
      await page.waitForURL(/\/#\/[a-z0-9\-]+/)
      console.log("ルームページに移動しました");
      
      // URLを取得 (Copy URLボタンを押した場合のURLと同等)
      roomUrl = page.url()
      console.log("ルームURL:", roomUrl);
      
      // Copy URLボタンが表示されるのを待つ
      await page.waitForSelector("button:has-text('copy URL')")
      console.log("Copy URLボタンが表示されました");
      
      // ルームを作成したら画面は閉じずに、このページをホストとして維持する
      // 重要: ホストユーザーのページは閉じない（ルームから退室してしまうため）
    } finally {
      // ページもコンテキストも閉じない - ルームを維持するため
      // await page.close() と await context.close() は呼び出さない
    }
  });
  
  // 別のユーザーがルームに参加できることを確認
  await t.step("別のユーザーがルームに参加できること", async () => {
    console.log("ゲストユーザーとして参加を開始します");
    console.log("使用するルームURL:", roomUrl);
    
    // 2人目のユーザーは、先ほど取得したURLを使用してアクセス
    const { page: guestPage, context: guestContext } = await createPage(browser, roomUrl)
    
    try {
      // 名前入力フォームが表示されているか確認
      console.log("名前入力フォーム確認中...");
      await guestPage.waitForSelector("input[type='text']", { timeout: 5000 });
      console.log("名前入力フォームが見つかりました");
      
      // 名前を入力して参加
      await guestPage.fill("input[type='text']", "GuestUser")
      await guestPage.click("button")
      console.log("ゲストユーザーとして名前を入力し、参加しました");
      
      // ルームに参加していることを確認（投票オプションが表示されている）
      console.log("投票オプションを待機中...");
      await guestPage.waitForSelector("button:has-text('1')", { timeout: 5000 })
      console.log("投票オプションが表示されました");
      
      // 少し待機して参加者情報が更新されるのを待つ
      console.log("参加者情報の更新を待機中...");
      await guestPage.waitForTimeout(3000);
      
      // 参加者が表示されるのを待つ
      console.log("参加者カードが表示されるのを待機中...");
      await guestPage.waitForSelector("article");
      
      // 参加者数を確認
      console.log("参加者数を確認します");
      const participants = await guestPage.locator("article").count();
      console.log(`参加者数: ${participants}`);
      
      // 検証: 参加者数は2人（ホストとゲスト）
      assertEquals(participants, 2, "参加者数は2人（ホストとゲスト）であるべきです");
      console.log("参加者数の検証に成功しました");
      
    } finally {
      // ゲストユーザーのページとコンテキストを閉じる
      await guestPage.close();
      await guestContext.close();
    }
  });

  // 投票機能のテスト
  await t.step("投票機能が正しく動作すること", async () => {
    const { page, context } = await createPage(browser, roomUrl)
    
    try {
      // 名前入力がまだ必要な場合は入力
      const nameInputExists = await page.locator("input[type='text']").count() > 0
      if (nameInputExists) {
        await page.fill("input[type='text']", "VoteUser")
        await page.click("button")
      }
      
      // 投票オプションが表示されるまで待機
      await page.waitForSelector("button:has-text('8')")
      
      // 投票する（「8」を選択）
      await page.click("button:has-text('8')")
      
      // 投票したボタンが選択されていることを確認（CSSクラスで確認）
      const selectedButton = await page.locator("button:has-text('8')").getAttribute("class")
      console.log("選択されたボタンのクラス:", selectedButton)
      // 選択されたボタンは-translate-y-3クラスを持っているはず
      const hasSelectedClass = selectedButton && selectedButton.includes("-translate-y-3")
      assertEquals(hasSelectedClass, true)
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close()
      await context.close()
    }
  });

  // 観戦者モードのテスト
  await t.step("観戦者モードに切り替えられること", async () => {
    const { page, context } = await createPage(browser, roomUrl)
    
    try {
      // 名前入力がまだ必要な場合は入力
      const nameInputExists = await page.locator("input[type='text']").count() > 0
      if (nameInputExists) {
        await page.fill("input[type='text']", "AudienceUser")
        await page.click("button")
      }
      
      // オーディエンスモードのチェックボックスを探して選択
      await page.waitForSelector("input#is-audience")
      await page.check("input#is-audience")
      
      // チェックボックスが選択されていることを確認
      const isChecked = await page.isChecked("input#is-audience")
      assertEquals(isChecked, true)
      
      // Audienceと表示されているかを確認
      await page.waitForSelector("p:has-text('Audience')")
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close()
      await context.close()
    }
  });

  // クリア機能のテスト
  await t.step("投票をクリアできること", async () => {
    const { page, context } = await createPage(browser, roomUrl)
    
    try {
      // 名前入力がまだ必要な場合は入力
      const nameInputExists = await page.locator("input[type='text']").count() > 0
      if (nameInputExists) {
        await page.fill("input[type='text']", "ClearUser")
        await page.click("button")
      }
      
      // 投票オプションが表示されるまで待機
      await page.waitForSelector("button:has-text('5')")
      
      // 投票する（「5」を選択）
      await page.click("button:has-text('5')")
      
      // クリアボタンをクリック
      await page.click("button:has-text('clear')")
      
      // クリア後は投票が消えていることを確認（選択状態のクラスが消えている）
      await page.waitForTimeout(1000) // クリア処理の完了を待つ
      const button = await page.locator("button:has-text('5')").getAttribute("class")
      const isNotSelected = !button || !button.includes("-translate-y-3")
      assertEquals(isNotSelected, true)
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close()
      await context.close()
    }
  });
  
  // テスト完了後にブラウザを閉じる
  await browser.close()
});