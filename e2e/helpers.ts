import { chromium, firefox, webkit, Browser, BrowserContext, Page } from "playwright"

// E2Eテスト用のヘルパー関数
export async function setupBrowser(browserName: string = 'chromium'): Promise<Browser> {
  const browsers = {
    chromium,
    firefox,
    webkit,
  }
  
  // 環境変数 HEADLESS が "false" の場合はブラウザを表示モードで起動
  // デフォルトはヘッドレスモード（true）
  const isHeadless = Deno.env.get("HEADLESS") !== "false";
  const slowMo = isHeadless ? 0 : 100; // ヘッドレスでない場合は操作を少し遅くする
  
  console.log(`ブラウザを${isHeadless ? "ヘッドレス" : "表示"}モードで起動します`);
  
  const browser = await browsers[browserName as keyof typeof browsers].launch({
    headless: isHeadless,
    slowMo: slowMo,
  })
  return browser
}

export async function createPage(browser: Browser, url: string = 'http://localhost:8000'): Promise<{ context: BrowserContext, page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url)
  return { context, page }
}

// サーバーが起動しているかチェックする関数
export async function isServerRunning(url: string = 'http://localhost:8000'): Promise<boolean> {
  try {
    const res = await fetch(url)
    return res.status === 200
  } catch (e) {
    return false
  }
}