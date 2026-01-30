import { assertEquals, assertRejects } from "jsr:@std/assert"
import { parseJsonBody, JsonParseError } from "./parseJsonBody.ts"

Deno.test("parseJsonBody", async (t) => {
  await t.step("正常なJSONをパースできる", async () => {
    const body = JSON.stringify({ name: "test", value: 123 })
    const req = new Request("http://localhost", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    })

    const result = await parseJsonBody<{ name: string; value: number }>(req)
    assertEquals(result.name, "test")
    assertEquals(result.value, 123)
  })

  await t.step("空のオブジェクトをパースできる", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    })

    const result = await parseJsonBody<Record<string, unknown>>(req)
    assertEquals(result, {})
  })

  await t.step("配列をパースできる", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "[1, 2, 3]",
      headers: { "content-type": "application/json" },
    })

    const result = await parseJsonBody<number[]>(req)
    assertEquals(result, [1, 2, 3])
  })

  await t.step("不正なJSONでJsonParseErrorをスローする", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "invalid json",
      headers: { "content-type": "application/json" },
    })

    await assertRejects(
      () => parseJsonBody(req),
      JsonParseError,
      "Invalid JSON",
    )
  })

  await t.step("空のボディでJsonParseErrorをスローする", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "",
      headers: { "content-type": "application/json" },
    })

    await assertRejects(
      () => parseJsonBody(req),
      JsonParseError,
      "Invalid JSON",
    )
  })

  await t.step("日本語を含むJSONをパースできる", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ userName: "山田太郎" }),
      headers: { "content-type": "application/json" },
    })

    const result = await parseJsonBody<{ userName: string }>(req)
    assertEquals(result.userName, "山田太郎")
  })
})
