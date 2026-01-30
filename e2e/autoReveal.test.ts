import { assertEquals } from "jsr:@std/assert"
import { getDocument, queries } from "playwright-testing-library"
import {
  cleanupKVStore,
  createRoomAndJoin,
  isServerRunning,
  joinRoom,
  selectAnswer,
  setupBrowser,
} from "./helpers.ts"

Deno.test("自動公開機能のテスト", async (t) => {
  await t.step("サーバー接続確認", async () => {
    const server = await isServerRunning()
    if (!server) {
      throw new Error("テスト実行前にサーバーを起動してください: deno task serve")
    }
  })

  await cleanupKVStore()
  const browser = await setupBrowser()

  await t.step("全員回答でカードが公開される", async () => {
    // ホストがルームを作成
    const { page: hostPage, context: hostContext, roomUrl } = await createRoomAndJoin(
      browser,
      "HostAutoReveal",
    )

    try {
      // ゲストが参加
      const { page: guestPage, context: guestContext } = await joinRoom(
        browser,
        roomUrl,
        "GuestAutoReveal",
      )

      try {
        // 少し待機してWebSocket接続を安定させる
        await hostPage.waitForTimeout(2000)

        // ホストが回答
        await selectAnswer(hostPage, "5")
        await hostPage.waitForTimeout(500)

        // ゲストが回答
        await selectAnswer(guestPage, "8")
        await guestPage.waitForTimeout(1000)

        // カードが公開されているか確認（両方の画面で）
        // カードに実際の回答値が表示されているはず
        const $hostDocument = await getDocument(hostPage)
        const $hostCards = await queries.getAllByRole($hostDocument, "article")

        let foundRevealedCard = false
        for (const card of $hostCards) {
          const text = await card.textContent()
          // 数字（5または8）が表示されているカードがあれば公開済み
          if (text && (/5/.test(text) || /8/.test(text))) {
            foundRevealedCard = true
            break
          }
        }
        assertEquals(foundRevealedCard, true, "全員回答後にカードが公開されるべき")
      } finally {
        await guestPage.close()
        await guestContext.close()
      }
    } finally {
      await hostPage.close()
      await hostContext.close()
    }
  })

  await t.step("観戦者は回答カウントから除外される", async () => {
    // ホストがルームを作成
    const { page: hostPage, context: hostContext, roomUrl } = await createRoomAndJoin(
      browser,
      "HostAudience",
    )

    try {
      // 観戦者が参加
      const { page: audiencePage, context: audienceContext } = await joinRoom(
        browser,
        roomUrl,
        "AudienceUser",
      )

      try {
        // 観戦者モードに切り替え
        const $audienceDocument = await getDocument(audiencePage)
        const $checkbox = await queries.getByLabelText($audienceDocument, "I'm an audience.")
        await $checkbox.click()
        await audiencePage.waitForTimeout(1000)

        // 別の参加者が参加
        const { page: participantPage, context: participantContext } = await joinRoom(
          browser,
          roomUrl,
          "ParticipantUser",
        )

        try {
          await hostPage.waitForTimeout(2000)

          // ホストが回答
          await selectAnswer(hostPage, "3")
          await hostPage.waitForTimeout(500)

          // 参加者が回答
          await selectAnswer(participantPage, "5")
          await participantPage.waitForTimeout(1000)

          // 観戦者は回答していないが、参加者2人（ホスト+参加者）が全員回答したのでカードが公開されるはず
          const $hostDocument = await getDocument(hostPage)
          const $hostCards = await queries.getAllByRole($hostDocument, "article")

          let foundRevealedCard = false
          for (const card of $hostCards) {
            const text = await card.textContent()
            if (text && (/3/.test(text) || /5/.test(text))) {
              foundRevealedCard = true
              break
            }
          }
          assertEquals(foundRevealedCard, true, "観戦者抜きで全員回答時にカードが公開されるべき")
        } finally {
          await participantPage.close()
          await participantContext.close()
        }
      } finally {
        await audiencePage.close()
        await audienceContext.close()
      }
    } finally {
      await hostPage.close()
      await hostContext.close()
    }
  })

  await browser.close()
  await cleanupKVStore()
})
