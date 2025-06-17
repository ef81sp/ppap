import { Browser, BrowserContext, chromium, firefox, Page, webkit } from "playwright"

// E2Eテスト用のヘルパー関数
export async function setupBrowser(
  browserName: string = "chromium",
): Promise<Browser> {
  const browsers = {
    chromium,
    firefox,
    webkit,
  }

  // 環境変数 HEADLESS が "false" の場合はブラウザを表示モードで起動
  // デフォルトはヘッドレスモード（true）
  const isHeadless = Deno.env.get("HEADLESS") !== "false"
  const slowMo = isHeadless ? 0 : 100 // ヘッドレスでない場合は操作を少し遅くする

  console.log(
    `ブラウザを${isHeadless ? "ヘッドレス" : "表示"}モードで起動します`,
  )

  const browser = await browsers[browserName as keyof typeof browsers].launch({
    headless: isHeadless,
    slowMo: slowMo,
  })
  return browser
}

export async function createPage(
  browser: Browser,
  url: string = "http://localhost:8000",
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(url)
  return { context, page }
}

// サーバーが起動しているかチェックする関数
export async function isServerRunning(
  url: string = "http://localhost:8000",
): Promise<boolean> {
  try {
    const res = await fetch(url)
    const result = res.status === 200
    res.body?.cancel()
    return result
  } catch (_e) {
    return false
  }
}

// KVストアをクリーンアップする関数
export async function cleanupKVStore(): Promise<void> {
  // KVモードでない場合は何もしない
  if (Deno.env.get("USE_KV_STORE") !== "true") {
    return
  }

  console.log("KVストアをクリーンアップしています...")
  let kv: Deno.Kv | null = null
  try {
    kv = await Deno.openKv()

    // rooms, user_rooms, room_updates, socket_instancesのエントリをすべて削除
    const keysToDelete = [
      { prefix: ["rooms"] },
      { prefix: ["user_rooms"] },
      { prefix: ["room_updates"] },
      { prefix: ["socket_instances"] },
    ]

    for (const keyPattern of keysToDelete) {
      const entries = kv.list(keyPattern)
      const batch = []

      for await (const entry of entries) {
        batch.push(entry.key)
        // バッチサイズが10になったら削除操作を実行
        if (batch.length >= 10) {
          const atomicOp = kv.atomic()
          for (const key of batch) {
            atomicOp.delete(key)
          }
          await atomicOp.commit()
          batch.length = 0
        }
      }

      // 残りのエントリを削除
      if (batch.length > 0) {
        const atomicOp = kv.atomic()
        for (const key of batch) {
          atomicOp.delete(key)
        }
        await atomicOp.commit()
      }
    }

    console.log("KVストアのクリーンアップが完了しました")
  } catch (error) {
    console.error("KVストアのクリーンアップ中にエラーが発生しました:", error)
  } finally {
    // 重要: KVインスタンスをクローズ
    if (kv) {
      kv.close()
    }
  }
}
