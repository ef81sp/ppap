const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8000",
  "https://ppap.deno.dev",
  "https://ppap.p-craft.dev",
]

export function validateOrigin(
  origin: string | null,
  allowedOrigins: string[] = DEFAULT_ALLOWED_ORIGINS,
): boolean {
  if (!origin) return false
  return allowedOrigins.includes(origin)
}

export async function csrfMiddleware(
  req: Request,
  allowedOrigins: string[] = DEFAULT_ALLOWED_ORIGINS,
): Promise<Response | null> {
  const method = req.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null
  }

  const origin = req.headers.get("Origin")
  if (origin) {
    if (validateOrigin(origin, allowedOrigins)) {
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
      if (validateOrigin(refererOrigin, allowedOrigins)) {
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
  allowedOrigins: string[] = DEFAULT_ALLOWED_ORIGINS,
): boolean {
  const origin = req.headers.get("Origin")
  return validateOrigin(origin, allowedOrigins)
}
