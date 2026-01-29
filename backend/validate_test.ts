import { assertEquals, assertThrows } from "std/assert/mod.ts"
import {
  AnswerSchema,
  CreateRoomRequestSchema,
  JoinRoomRequestSchema,
  sanitize,
  UserNameSchema,
} from "./validate.ts"

// sanitize() 関数のテスト
Deno.test("sanitize: XSS文字が削除される", () => {
  assertEquals(sanitize("<script>alert('xss')</script>"), "scriptalert(xss)/script")
  assertEquals(sanitize('"><img src=x onerror=alert(1)>'), "img src=x onerror=alert(1)")
  assertEquals(sanitize("test<>test"), "testtest")
  assertEquals(sanitize("a&b'c\"d"), "abcd")
})

Deno.test("sanitize: 通常テキストが保持される", () => {
  assertEquals(sanitize("hello world"), "hello world")
  assertEquals(sanitize("test123"), "test123")
  assertEquals(sanitize("user_name-123"), "user_name-123")
})

Deno.test("sanitize: 日本語が保持される", () => {
  assertEquals(sanitize("山田太郎"), "山田太郎")
  assertEquals(sanitize("テスト ユーザー"), "テスト ユーザー")
  assertEquals(sanitize("漢字とひらがなとカタカナ"), "漢字とひらがなとカタカナ")
})

Deno.test("sanitize: 空文字の処理", () => {
  assertEquals(sanitize(""), "")
})

// UserNameSchema のテスト
Deno.test("UserNameSchema: 正常値 - 1文字", () => {
  const result = UserNameSchema.parse("a")
  assertEquals(result, "a")
})

Deno.test("UserNameSchema: 正常値 - 24文字", () => {
  const input = "a".repeat(24)
  const result = UserNameSchema.parse(input)
  assertEquals(result, input)
})

Deno.test("UserNameSchema: 正常値 - 日本語", () => {
  const result = UserNameSchema.parse("山田太郎")
  assertEquals(result, "山田太郎")
})

Deno.test("UserNameSchema: 境界値エラー - 空文字", () => {
  assertThrows(() => {
    UserNameSchema.parse("")
  })
})

Deno.test("UserNameSchema: 境界値エラー - 25文字以上", () => {
  const input = "a".repeat(25)
  assertThrows(() => {
    UserNameSchema.parse(input)
  })
})

Deno.test("UserNameSchema: XSS文字がサニタイズされる", () => {
  const result = UserNameSchema.parse("<script>test</script>")
  assertEquals(result, "scripttest/script")
})

// AnswerSchema のテスト
Deno.test("AnswerSchema: 正常値 - 256文字以内", () => {
  const input = "a".repeat(256)
  const result = AnswerSchema.parse(input)
  assertEquals(result, input)
})

Deno.test("AnswerSchema: 正常値 - 空文字は許可される", () => {
  const result = AnswerSchema.parse("")
  assertEquals(result, "")
})

Deno.test("AnswerSchema: 境界値エラー - 257文字以上", () => {
  const input = "a".repeat(257)
  assertThrows(() => {
    AnswerSchema.parse(input)
  })
})

Deno.test("AnswerSchema: XSS文字がサニタイズされる", () => {
  const result = AnswerSchema.parse("<script>alert('xss')</script>")
  assertEquals(result, "scriptalert(xss)/script")
})

// CreateRoomRequestSchema のテスト
Deno.test("CreateRoomRequestSchema: 正常リクエスト", () => {
  const result = CreateRoomRequestSchema.parse({ userName: "山田太郎" })
  assertEquals(result.userName, "山田太郎")
})

Deno.test("CreateRoomRequestSchema: 必須フィールド欠落", () => {
  assertThrows(() => {
    CreateRoomRequestSchema.parse({})
  })
})

Deno.test("CreateRoomRequestSchema: XSS文字がサニタイズされる", () => {
  const result = CreateRoomRequestSchema.parse({ userName: "<b>user</b>" })
  assertEquals(result.userName, "buser/b")
})

// JoinRoomRequestSchema のテスト
Deno.test("JoinRoomRequestSchema: 正常リクエスト - userNameのみ", () => {
  const result = JoinRoomRequestSchema.parse({ userName: "テストユーザー" })
  assertEquals(result.userName, "テストユーザー")
  assertEquals(result.userToken, undefined)
})

Deno.test("JoinRoomRequestSchema: 正常リクエスト - userToken付き", () => {
  const result = JoinRoomRequestSchema.parse({
    userName: "テストユーザー",
    userToken: "abc123",
  })
  assertEquals(result.userName, "テストユーザー")
  assertEquals(result.userToken, "abc123")
})

Deno.test("JoinRoomRequestSchema: 必須フィールド欠落", () => {
  assertThrows(() => {
    JoinRoomRequestSchema.parse({})
  })
})

Deno.test("JoinRoomRequestSchema: XSS文字がサニタイズされる", () => {
  const result = JoinRoomRequestSchema.parse({ userName: '"><script>' })
  assertEquals(result.userName, "script")
})

// sanitize() 追加エッジケーステスト
Deno.test("sanitize: 複合XSS攻撃パターン", () => {
  // イベントハンドラ付きタグ
  assertEquals(
    sanitize('<img src="x" onerror="alert(1)">'),
    "img src=x onerror=alert(1)",
  )
  // ネストされたスクリプト
  assertEquals(
    sanitize('<script><script>alert("xss")</script></script>'),
    "scriptscriptalert(xss)/script/script",
  )
  // JavaScript URL
  assertEquals(
    sanitize('<a href="javascript:alert(1)">click</a>'),
    "a href=javascript:alert(1)click/a",
  )
  // SVGベースのXSS
  assertEquals(
    sanitize('<svg onload="alert(1)">'),
    "svg onload=alert(1)",
  )
  // Data URL
  assertEquals(
    sanitize('<a href="data:text/html,<script>alert(1)</script>">'),
    "a href=data:text/html,scriptalert(1)/script",
  )
})

Deno.test("sanitize: 長い文字列の処理", () => {
  // 1000文字の通常テキスト
  const longText = "a".repeat(1000)
  assertEquals(sanitize(longText), longText)
  // 1000文字のXSS含む文字列
  const longXss = "<script>".repeat(100) + "payload" + "</script>".repeat(100)
  const expected = "script".repeat(100) + "payload" + "/script".repeat(100)
  assertEquals(sanitize(longXss), expected)
})

Deno.test("sanitize: 特殊なユニコード文字の保持", () => {
  assertEquals(sanitize("👍🎉✨"), "👍🎉✨")
  assertEquals(sanitize("émojis café"), "émojis café")
})
