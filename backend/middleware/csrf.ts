export type OriginPolicy = {
  origins: string[]
  // ホスト名に対して評価する。プロトコルはhttpsに限定される
  patterns: RegExp[]
}

// Deno Deployのプレビューデプロイ（ppap-<hash>.p-craft.deno.net）を許可する。
// 同じorg配下でもアプリ名がppap以外のものは対象外
const PREVIEW_ORIGIN_PATTERN = /^ppap(-[a-z0-9-]+)?\.p-craft\.deno\.net$/

const DEFAULT_ORIGIN_POLICY: OriginPolicy = {
  origins: [
    "http://localhost:5173",
    "http://localhost:8000",
    "https://ppap.p-craft.deno.net",
    "https://ppap.p-craft.dev",
  ],
  patterns: [PREVIEW_ORIGIN_PATTERN],
}

// httpsかつホスト名がパターンに一致する場合のみ通す
function matchesPattern(origin: string, patterns: RegExp[]): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== "https:") return false
    return patterns.some((pattern) => pattern.test(url.hostname))
  } catch {
    return false
  }
}

export function validateOrigin(
  origin: string | null,
  policy: OriginPolicy = DEFAULT_ORIGIN_POLICY,
): boolean {
  if (!origin) return false
  if (policy.origins.includes(origin)) return true
  return matchesPattern(origin, policy.patterns)
}

export async function csrfMiddleware(
  req: Request,
  policy: OriginPolicy = DEFAULT_ORIGIN_POLICY,
): Promise<Response | null> {
  const method = req.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null
  }

  const origin = req.headers.get("Origin")
  if (origin) {
    if (validateOrigin(origin, policy)) {
      return null
    }
    return new Response(JSON.stringify({ error: "Invalid origin" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })
  }

  const referer = req.headers.get("Referer")
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      const refererOrigin = refererUrl.origin
      if (validateOrigin(refererOrigin, policy)) {
        return null
      }
    } catch {
      // invalid referer URL
    }
  }

  return new Response(JSON.stringify({ error: "Invalid origin" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  })
}

export function validateWebSocketOrigin(
  req: Request,
  policy: OriginPolicy = DEFAULT_ORIGIN_POLICY,
): boolean {
  const origin = req.headers.get("Origin")
  return validateOrigin(origin, policy)
}
