import { chromium, Browser, BrowserContext, Page } from "playwright"

const BASE_URL = "http://localhost:8000"

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
