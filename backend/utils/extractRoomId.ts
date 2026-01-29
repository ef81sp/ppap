const ROOM_PATTERNS = [
  /^\/api\/rooms\/(.+)\/join$/,
  /^\/api\/rooms\/(.+)\/leave$/,
  /^\/api\/rooms\/(.+)\/rejoin$/,
  /^\/ws\/rooms\/(.+)$/,
]

export function extractRoomId(pathname: string): string | null {
  for (const pattern of ROOM_PATTERNS) {
    const match = pathname.match(pattern)
    if (match) {
      return match[1]
    }
  }
  return null
}
