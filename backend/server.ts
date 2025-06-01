import { serveDir } from "https://deno.land/std@0.209.0/http/file_server.ts"

function handler(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (
    pathname === "/" ||
    pathname.startsWith("/assets") ||
    pathname.endsWith(".png")
  ) {
    return serveDir(request, { fsRoot: "./dist/" })
  }
  return Promise.resolve(
    new Response("Not found", {
      status: 404,
      statusText: "Not found",
      headers: {
        "content-type": "text/plain",
      },
    }),
  )
}

Deno.serve(
  {
    port: Number(Deno.env.get("PORT")) || 8000,
  },
  handler,
)
