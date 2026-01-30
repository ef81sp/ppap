import { chromium, Browser, BrowserContext, Page } from "playwright"
import { getDocument, queries } from "playwright-testing-library"

export const BASE_URL = "http://localhost:8000"

export async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL)
    return res.ok
  } catch {
    return false
  }
}

export async function setupBrowser(): Promise<Browser> {
  return await chromium.launch({
    headless: true,
  })
}

export async function createPage(
  browser: Browser,
  url?: string,
): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url || BASE_URL)
  return { page, context }
}

export async function cleanupKVStore(): Promise<void> {
  try {
    const kv = await Deno.openKv()
    const entries = kv.list({ prefix: [] })
    for await (const entry of entries) {
      await kv.delete(entry.key)
    }
    kv.close()
  } catch {
    // KVストアがない場合は無視
  }
}

// ルーム作成して参加するヘルパー
export async function createRoomAndJoin(
  browser: Browser,
  userName: string,
): Promise<{ page: Page; context: BrowserContext; roomUrl: string }> {
  const { page, context } = await createPage(browser)
  const $document = await getDocument(page)
  const $nameInput = await queries.getByRole($document, "textbox")
  await $nameInput.fill(userName)
  const $createButton = await queries.getByRole($document, "button")
  await $createButton.click()
  await page.waitForURL(/\/#\/[a-z0-9\-]+/)
  const roomUrl = page.url()
  return { page, context, roomUrl }
}

// 既存ルームに参加するヘルパー
export async function joinRoom(
  browser: Browser,
  roomUrl: string,
  userName: string,
): Promise<{ page: Page; context: BrowserContext }> {
  const { page, context } = await createPage(browser, roomUrl)
  const $document = await getDocument(page)
  const $nameInput = await queries.getByRole($document, "textbox")
  await $nameInput.fill(userName)
  const $joinButton = await queries.getByRole($document, "button")
  await $joinButton.click()
  // 投票オプションが表示されるまで待機
  await page.waitForTimeout(1000)
  return { page, context }
}

// 回答を選択するヘルパー
export async function selectAnswer(page: Page, answer: string): Promise<void> {
  const $document = await getDocument(page)
  const $voteButton = await queries.getByText($document, answer)
  await $voteButton.click()
}

// 参加者数を取得するヘルパー
export async function getParticipantCount(page: Page): Promise<number> {
  const $document = await getDocument(page)
  const $articles = await queries.getAllByRole($document, "article")
  return $articles.length
}

// カード公開を待機するヘルパー
export async function waitForReveal(page: Page, timeout = 5000): Promise<void> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const $document = await getDocument(page)
    // 公開された数字が表示されているか確認（「?」以外の数字がカードに表示される）
    const revealedCards = await queries.queryAllByRole($document, "article")
    for (const card of revealedCards) {
      const text = await card.textContent()
      // カード内に数字が表示されている場合は公開済み
      if (text && /\d+/.test(text)) {
        return
      }
    }
    await page.waitForTimeout(200)
  }
  throw new Error("カード公開がタイムアウトしました")
}
