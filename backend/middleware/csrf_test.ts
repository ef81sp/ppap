import { assertEquals } from "jsr:@std/assert"
import { csrfMiddleware, type OriginPolicy, validateOrigin } from "./csrf.ts"

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8000",
  "https://ppap.p-craft.deno.net",
]

// 完全一致のみを検証するポリシー（本番のパターンを引き継がないよう空を明示）
const EXACT_ONLY_POLICY: OriginPolicy = {
  origins: ALLOWED_ORIGINS,
  patterns: [],
}

// プレビューデプロイのパターンを含むポリシー
const PREVIEW_POLICY: OriginPolicy = {
  origins: ALLOWED_ORIGINS,
  patterns: [/^ppap(-[a-z0-9-]+)?\.p-craft\.deno\.net$/],
}

Deno.test("validateOrigin: 許可されたOriginの通過", () => {
  for (const origin of ALLOWED_ORIGINS) {
    assertEquals(validateOrigin(origin, EXACT_ONLY_POLICY), true)
  }
})

Deno.test("validateOrigin: 不正Originの拒否", () => {
  assertEquals(validateOrigin("https://evil.com", EXACT_ONLY_POLICY), false)
  assertEquals(validateOrigin("http://localhost:3000", EXACT_ONLY_POLICY), false)
  assertEquals(validateOrigin(null, EXACT_ONLY_POLICY), false)
  assertEquals(validateOrigin("", EXACT_ONLY_POLICY), false)
})

Deno.test("validateOrigin: プレビューデプロイのサブドメインを許可", () => {
  assertEquals(
    validateOrigin("https://ppap-5a070dna9hdd.p-craft.deno.net", PREVIEW_POLICY),
    true,
  )
  // 大文字小文字はURL仕様で正規化される
  assertEquals(
    validateOrigin("https://PPAP-ABC.P-Craft.Deno.Net", PREVIEW_POLICY),
    true,
  )
})

Deno.test("validateOrigin: 同一org内でもアプリ名が違えば拒否", () => {
  assertEquals(validateOrigin("https://other-app.p-craft.deno.net", PREVIEW_POLICY), false)
  assertEquals(validateOrigin("https://evil.p-craft.deno.net", PREVIEW_POLICY), false)
})

Deno.test("validateOrigin: パターン許可はhttpsのみ", () => {
  assertEquals(validateOrigin("http://ppap-abc.p-craft.deno.net", PREVIEW_POLICY), false)
})

Deno.test("validateOrigin: パターンを装った別ドメインを拒否", () => {
  // ホスト名の末尾一致でないもの
  assertEquals(
    validateOrigin("https://ppap.p-craft.deno.net.evil.com", PREVIEW_POLICY),
    false,
  )
  // userinfoを使ったauthority偽装
  assertEquals(
    validateOrigin("https://ppap.p-craft.deno.net@evil.com", PREVIEW_POLICY),
    false,
  )
  // 区切りドットがないもの
  assertEquals(validateOrigin("https://evilppap.p-craft.deno.net", PREVIEW_POLICY), false)
  // パス部分に許可ドメインを含むもの
  assertEquals(
    validateOrigin("https://evil.com/ppap.p-craft.deno.net", PREVIEW_POLICY),
    false,
  )
})

Deno.test("csrfMiddleware: 許可されたOriginからのPOSTリクエスト通過", async () => {
  const req = new Request("http://localhost:8000/api/rooms", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
  })
  const result = await csrfMiddleware(req)
  assertEquals(result, null)
})

Deno.test("csrfMiddleware: 不正OriginからのPOSTリクエスト拒否", async () => {
  const req = new Request("http://localhost:8000/api/rooms", {
    method: "POST",
    headers: { Origin: "https://evil.com" },
  })
  const result = await csrfMiddleware(req)
  assertEquals(result?.status, 403)
  const json = await result?.json()
  assertEquals(json.error, "Invalid origin")
})

Deno.test("csrfMiddleware: GETリクエストは常に通過", async () => {
  const req = new Request("http://localhost:8000/api/rooms", {
    method: "GET",
    headers: { Origin: "https://evil.com" },
  })
  const result = await csrfMiddleware(req)
  assertEquals(result, null)
})

Deno.test("csrfMiddleware: Originヘッダなしの場合はRefererで検証", async () => {
  const req = new Request("http://localhost:8000/api/rooms", {
    method: "POST",
    headers: { Referer: "http://localhost:5173/rooms/123" },
  })
  const result = await csrfMiddleware(req)
  assertEquals(result, null)
})

Deno.test("csrfMiddleware: OriginもRefererもない場合は拒否", async () => {
  const req = new Request("http://localhost:8000/api/rooms", {
    method: "POST",
  })
  const result = await csrfMiddleware(req)
  assertEquals(result?.status, 403)
})
