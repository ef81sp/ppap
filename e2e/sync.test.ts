import { assertEquals } from "std/assert/mod.ts"
import { getDocument, queries } from "playwright-testing-library"
import {
  cleanupKVStore,
  createRoomAndJoin,
  getParticipantCount,
  isServerRunning,
  joinRoom,
  selectAnswer,
  setupBrowser,
} from "./helpers.ts"

Deno.test("リアルタイム同期のテスト", async (t) => {
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error("テスト実行前にサーバーを起動してください: deno task serve")
    }
  })

  await cleanupKVStore()
  const browser = await setupBrowser()

  await t.step("参加者追加がリアルタイムで反映", async () => {
    // ホストがルームを作成
    const { page: hostPage, context: hostContext, roomUrl } = await createRoomAndJoin(
      browser,
      "SyncHost",
    )

    try {
      // ホストの画面で参加者が1人であることを確認
      await hostPage.waitForTimeout(1000)
      const initialCount = await getParticipantCount(hostPage)
      assertEquals(initialCount, 1, "初期状態で参加者は1人")

      // ゲストが参加
      const { page: guestPage, context: guestContext } = await joinRoom(
        browser,
        roomUrl,
        "SyncGuest",
      )

      try {
        // ホストの画面で参加者が2人に増えたことを確認
        await hostPage.waitForTimeout(2000)
        const afterJoinCount = await getParticipantCount(hostPage)
        assertEquals(afterJoinCount, 2, "ゲスト参加後は参加者が2人")
      } finally {
        await guestPage.close()
        await guestContext.close()
      }
    } finally {
      await hostPage.close()
      await hostContext.close()
    }
  })

  await t.step("回答変更がリアルタイムで反映", async () => {
    // ホストがルームを作成
    const { page: hostPage, context: hostContext, roomUrl } = await createRoomAndJoin(
      browser,
      "AnswerHost",
    )

    try {
      // ゲストが参加
      const { page: guestPage, context: guestContext } = await joinRoom(
        browser,
        roomUrl,
        "AnswerGuest",
      )

      try {
        await hostPage.waitForTimeout(2000)

        // ゲストの画面でホストのカードが未回答状態か確認
        // 未回答状態では、カード内にimg要素（裏面画像）がない
        let hostCardHasBackImage = await guestPage.evaluate((hostName: string) => {
          const articles = document.querySelectorAll("article")
          for (const article of articles) {
            if (article.textContent?.includes(hostName)) {
              return article.querySelector("img") !== null
            }
          }
          return false
        }, "AnswerHost")
        assertEquals(hostCardHasBackImage, false, "初期状態でホストのカードに裏面画像は表示されない")

        // ホストが回答
        await selectAnswer(hostPage, "13")
        await guestPage.waitForTimeout(1500)

        // ゲストの画面でホストのカードに裏面画像が表示されることを確認（回答済みだが非公開状態）
        hostCardHasBackImage = await guestPage.evaluate((hostName: string) => {
          const articles = document.querySelectorAll("article")
          for (const article of articles) {
            if (article.textContent?.includes(hostName)) {
              return article.querySelector("img") !== null
            }
          }
          return false
        }, "AnswerHost")
        assertEquals(hostCardHasBackImage, true, "ホスト回答後はカードに裏面画像が表示されるべき")
      } finally {
        await guestPage.close()
        await guestContext.close()
      }
    } finally {
      await hostPage.close()
      await hostContext.close()
    }
  })

  await t.step("clearが全員に反映される", async () => {
    // ホストがルームを作成
    const { page: hostPage, context: hostContext, roomUrl } = await createRoomAndJoin(
      browser,
      "ClearHost",
    )

    try {
      // ゲストが参加
      const { page: guestPage, context: guestContext } = await joinRoom(
        browser,
        roomUrl,
        "ClearGuest",
      )

      try {
        await hostPage.waitForTimeout(2000)

        // 両者が回答
        await selectAnswer(hostPage, "5")
        await selectAnswer(guestPage, "8")
        await hostPage.waitForTimeout(1000)

        // ホストがクリアボタンをクリック
        const $hostDocument = await getDocument(hostPage)
        const $clearButton = await queries.getByRole($hostDocument, "button", { name: "clear" })
        await $clearButton.click()
        await guestPage.waitForTimeout(1500)

        // ゲストの画面でカードが未回答状態にリセットされたことを確認
        const $guestDocument = await getDocument(guestPage)
        const $guestCards = await queries.getAllByRole($guestDocument, "article")

        let allCardsCleared = true
        for (const card of $guestCards) {
          const hasAnsweredClass = await card.evaluate((el) => {
            return el.classList.contains("bg-green-200")
          })
          if (hasAnsweredClass) {
            allCardsCleared = false
            break
          }
        }
        assertEquals(allCardsCleared, true, "クリア後は全員のカードが未回答状態になるべき")

        // ゲスト自身の投票選択もリセットされていることを確認
        const $voteButton = await queries.getByText($guestDocument, "8")
        const isNotSelected = await $voteButton.evaluate((el) => {
          return !(el as HTMLElement).classList.contains("-translate-y-3")
        })
        assertEquals(isNotSelected, true, "クリア後は投票ボタンの選択状態も解除されるべき")
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
