import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { csrfMiddleware, validateOrigin } from "./csrf.ts"

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8000",
  "https://ppap.deno.dev",
]

Deno.test("validateOrigin: 許可されたOriginの通過", () => {
  for (const origin of ALLOWED_ORIGINS) {
    assertEquals(validateOrigin(origin, ALLOWED_ORIGINS), true)
  }
})

Deno.test("validateOrigin: 不正Originの拒否", () => {
  assertEquals(validateOrigin("https://evil.com", ALLOWED_ORIGINS), false)
  assertEquals(validateOrigin("http://localhost:3000", ALLOWED_ORIGINS), false)
  assertEquals(validateOrigin(null, ALLOWED_ORIGINS), false)
  assertEquals(validateOrigin("", ALLOWED_ORIGINS), false)
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
