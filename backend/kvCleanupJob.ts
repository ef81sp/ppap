/**
 * 古いKVレコードを定期的に削除するジョブ
 */

import { Room } from "@/backend/type.ts"

/**
 * 古いKVレコードを削除する関数
 * @param options テスト用オプション
 * @param options.thresholdMs 古いと判定する閾値（ミリ秒）（デフォルト: 24時間）
 * @param options.kvInstance テスト用のKVインスタンス
 * @returns クリーンアップ結果 { cleanedRooms: 削除したルーム数, cleanedSockets: 削除したソケット数 }
 */
export async function cleanupOldKvRecords(options?: {
  thresholdMs?: number
  kvInstance?: Deno.Kv
}) {
  console.log("Starting scheduled cleanup of old KV records...")
  const kv = options?.kvInstance || await Deno.openKv()
  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000 // 24時間（ミリ秒）
  const thresholdMs = options?.thresholdMs || oneDayMs
  let cleanedRooms = 0
  let cleanedSockets = 0

  try {
    // 古いルームを rooms list から直接チェック (room_updates を廃止)
    const roomEntries = kv.list<Room>({ prefix: ["rooms"] })
    const oldRooms: Array<{ roomId: string; participants: Room["participants"] }> = []
    for await (const entry of roomEntries) {
      const [, roomId] = entry.key as [string, string]
      const room = entry.value as Room
      // 最終更新から指定時間以上経過しているか確認
      if (now - room.updatedAt.getTime() > thresholdMs) {
        oldRooms.push({ roomId, participants: room.participants })
      }
    }

    // 古いルームを削除
    for (const { roomId, participants } of oldRooms) {
      // トランザクションの準備
      const atomicOp = kv.atomic()

      // ルームに所属するユーザーの関連データを削除
      for (const p of participants) {
        atomicOp.delete(["user_rooms", p.token])
        atomicOp.delete(["socket_instances", p.token])
      }

      // ルーム自体を削除
      atomicOp.delete(["rooms", roomId])
      // 互換性: room_updates エントリも削除
      atomicOp.delete(["room_updates", roomId])

      await atomicOp.commit()
      cleanedRooms++
    }

    // 古いsocket_instancesエントリを削除
    // socket_instances 削除：user_rooms を一度 list して Set 化し、個別 get を避ける
    const userRoomEntries = kv.list({ prefix: ["user_rooms"] })
    const activeUserTokens = new Set<string>()
    for await (const ur of userRoomEntries) {
      activeUserTokens.add(ur.key[1] as string)
    }
    const socketEntries = kv.list({ prefix: ["socket_instances"] })
    const socketsToDelete: string[] = []
    for await (const entry of socketEntries) {
      const userToken = entry.key[1] as string
      // Set になければ孤立とみなす
      if (!activeUserTokens.has(userToken)) {
        socketsToDelete.push(userToken)
      }
    }

    // 古いソケットインスタンスを削除
    for (const userToken of socketsToDelete) {
      await kv.delete(["socket_instances", userToken])
      cleanedSockets++
    }

    console.log(
      `Scheduled cleanup completed: Deleted ${cleanedRooms} old rooms and ${cleanedSockets} socket instances`,
    )

    // テスト用に結果を返す
    return { cleanedRooms, cleanedSockets }
  } catch (error) {
    console.error("Error during scheduled KV cleanup:", error)
    throw error // テスト中はエラーを伝播させる
  } finally {
    // 外部から渡されたKVインスタンスでない場合のみクローズ
    if (!options?.kvInstance) {
      kv.close()
    }
  }
}
