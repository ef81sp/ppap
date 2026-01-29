export class JsonParseError extends Error {
  constructor(message = "Invalid JSON") {
    super(message)
    this.name = "JsonParseError"
  }
}

export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw new JsonParseError()
  }
}
