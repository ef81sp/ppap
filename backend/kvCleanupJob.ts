/**
 * 古いKVレコードを定期的に削除するジョブ
 */

import { Room } from '@/backend/type.ts';

/**
 * 古いKVレコードを削除する関数
 * @param options テスト用オプション
 * @param options.thresholdMs 古いと判定する閾値（ミリ秒）（デフォルト: 24時間）
 * @param options.kvInstance テスト用のKVインスタンス
 * @returns クリーンアップ結果 { cleanedRooms: 削除したルーム数, cleanedSockets: 削除したソケット数 }
 */
export async function cleanupOldKvRecords(options?: {
  thresholdMs?: number;
  kvInstance?: Deno.Kv;
}) {
  console.log('Starting scheduled cleanup of old KV records...');
  const kv = options?.kvInstance || (await Deno.openKv());
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）
  const thresholdMs = options?.thresholdMs || oneDayMs;
  let cleanedRooms = 0;
  let cleanedSockets = 0;

  try {
    // room_updatesから古いルームを検索
    const roomEntries = kv.list({ prefix: ['room_updates'] });
    const oldRoomIds: string[] = [];

    for await (const entry of roomEntries) {
      const [, roomId] = entry.key as [string, string];
      const lastUpdate = entry.value as Date;

      // 最終更新から指定時間以上経過しているか確認
      if (now - lastUpdate.getTime() > thresholdMs) {
        oldRoomIds.push(roomId);
      }
    }

    // 古いルームを削除
    for (const roomId of oldRoomIds) {
      // ルームの情報を取得
      const roomResult = await kv.get<Room>(['rooms', roomId]);
      const room = roomResult.value;

      if (room) {
        // トランザクションの準備
        const atomicOp = kv.atomic();

        // ルームに所属するユーザーの関連データを削除
        for (const p of room.participants) {
          atomicOp.delete(['user_rooms', p.token]);
          atomicOp.delete(['socket_instances', p.token]);
        }

        // ルーム自体を削除
        atomicOp.delete(['rooms', roomId]);
        atomicOp.delete(['room_updates', roomId]);

        await atomicOp.commit();
        cleanedRooms++;
      } else {
        // ルームが見つからない場合は、関連するroom_updatesエントリのみ削除
        await kv.delete(['room_updates', roomId]);
      }
    }

    // 古いsocket_instancesエントリを削除
    // socket_instancesはタイムスタンプを持たないため、関連するuser_roomsがあるかで判断
    const socketEntries = kv.list({ prefix: ['socket_instances'] });
    const socketsToDelete: string[] = [];

    for await (const entry of socketEntries) {
      const userToken = entry.key[1] as string;

      // このユーザーが部屋に所属しているか確認
      const userRoomResult = await kv.get(['user_rooms', userToken]);

      // 部屋に所属していない場合、socket_instancesエントリを削除
      if (!userRoomResult.value) {
        socketsToDelete.push(userToken);
      }
    }

    // 古いソケットインスタンスを削除
    for (const userToken of socketsToDelete) {
      await kv.delete(['socket_instances', userToken]);
      cleanedSockets++;
    }

    console.log(
      `Scheduled cleanup completed: Deleted ${cleanedRooms} old rooms and ${cleanedSockets} socket instances`
    );

    // テスト用に結果を返す
    return { cleanedRooms, cleanedSockets };
  } catch (error) {
    console.error('Error during scheduled KV cleanup:', error);
    throw error; // テスト中はエラーを伝播させる
  } finally {
    // 外部から渡されたKVインスタンスでない場合のみクローズ
    if (!options?.kvInstance) {
      kv.close();
    }
  }
}
