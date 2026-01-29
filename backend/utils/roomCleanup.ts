/**
 * 空のルームをMapから削除する
 * @returns クリーンアップが実行されたかどうか
 */
export function cleanupEmptyRoom<T>(
  roomId: string,
  roomSockets: Map<string, Set<T>>,
  roomWatchers: Map<string, boolean>,
): boolean {
  const sockets = roomSockets.get(roomId)
  if (!sockets) return false

  if (sockets.size === 0) {
    roomSockets.delete(roomId)
    roomWatchers.delete(roomId)
    console.log(`Cleaned up empty room: ${roomId}`)
    return true
  }

  return false
}

/**
 * ルームのソケット数を取得する
 */
export function getRoomSocketCount<T>(
  roomId: string,
  roomSockets: Map<string, Set<T>>,
): number {
  return roomSockets.get(roomId)?.size ?? 0
}
