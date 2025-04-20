import { assertEquals, assertNotEquals } from "https://deno.land/std@0.209.0/assert/mod.ts";
import { cleanupOldKvRecords } from "../backend/kvCleanupJob.ts";
import { Room } from "../backend/type.ts";

// テスト用の一時的なKVパスを設定
const tempKvPath = `./temp-kv-${Date.now()}.sqlite`;

Deno.test("KV Cleanup Job E2E Test", async (t) => {
  // テスト用のKVインスタンスを作成
  const kv = await Deno.openKv(tempKvPath);

  try {
    await t.step("古いレコードが削除され、新しいレコードは残ること", async () => {
      // テストデータ（古いルーム）の作成
      const oldRoomId = "old-room-" + crypto.randomUUID();
      const oldRoom: Room = {
        id: oldRoomId,
        participants: [{
          token: "old-user-token",
          name: "Old User",
          answer: "",
        }],
        isOpen: false,
      };

      // テストデータ（新しいルーム）の作成
      const newRoomId = "new-room-" + crypto.randomUUID();
      const newRoom: Room = {
        id: newRoomId,
        participants: [{
          token: "new-user-token",
          name: "New User",
          answer: "",
        }],
        isOpen: false,
      };

      // 古いデータをKVに保存（更新日時を過去に設定）
      await kv.set(["rooms", oldRoomId], oldRoom);
      await kv.set(["user_rooms", "old-user-token"], oldRoomId);
      // 古いルームは30秒前に更新されたことにする
      const oldDate = new Date(Date.now() - 30000);
      await kv.set(["room_updates", oldRoomId], oldDate);
      await kv.set(["socket_instances", "old-user-token"], "instance-id");

      // 新しいデータをKVに保存（更新日時を現在に設定）
      await kv.set(["rooms", newRoomId], newRoom);
      await kv.set(["user_rooms", "new-user-token"], newRoomId);
      await kv.set(["room_updates", newRoomId], new Date());
      await kv.set(["socket_instances", "new-user-token"], "instance-id");

      // KVに正しく保存されたことを確認
      const oldRoomCheck = await kv.get<Room>(["rooms", oldRoomId]);
      const newRoomCheck = await kv.get<Room>(["rooms", newRoomId]);
      
      assertEquals(oldRoomCheck.value?.id, oldRoomId, "古いルームが正しく保存されていない");
      assertEquals(newRoomCheck.value?.id, newRoomId, "新しいルームが正しく保存されていない");

      // 孤立したソケットインスタンスも作成
      await kv.set(["socket_instances", "orphaned-socket"], "instance-id");

      // cleanupジョブを実行（閾値を20秒に設定）
      const result = await cleanupOldKvRecords({
        thresholdMs: 20000, // 20秒以上前のデータは「古い」と判定
        kvInstance: kv
      });

      // 削除されたレコード数の確認
      assertEquals(result?.cleanedRooms, 1, "古いルームが1つ削除されるべき");
      assertEquals(result?.cleanedSockets, 1, "孤立したソケットが1つ削除されるべき");

      // 古いデータが削除されたことを確認
      const oldRoomAfter = await kv.get(["rooms", oldRoomId]);
      const oldUserRoomAfter = await kv.get(["user_rooms", "old-user-token"]);
      const oldRoomUpdatesAfter = await kv.get(["room_updates", oldRoomId]);
      const oldSocketAfter = await kv.get(["socket_instances", "old-user-token"]);
      
      assertEquals(oldRoomAfter.value, null, "古いルームが削除されていない");
      assertEquals(oldUserRoomAfter.value, null, "古いユーザールーム関連が削除されていない");
      assertEquals(oldRoomUpdatesAfter.value, null, "古いルーム更新情報が削除されていない");
      assertEquals(oldSocketAfter.value, null, "古いソケットインスタンスが削除されていない");

      // 孤立したソケットインスタンスが削除されたことを確認
      const orphanedSocketAfter = await kv.get(["socket_instances", "orphaned-socket"]);
      assertEquals(orphanedSocketAfter.value, null, "孤立したソケットインスタンスが削除されていない");

      // 新しいデータが残っていることを確認
      const newRoomAfter = await kv.get(["rooms", newRoomId]);
      const newUserRoomAfter = await kv.get(["user_rooms", "new-user-token"]);
      const newRoomUpdatesAfter = await kv.get(["room_updates", newRoomId]);
      const newSocketAfter = await kv.get(["socket_instances", "new-user-token"]);
      
      assertNotEquals(newRoomAfter.value, null, "新しいルームが誤って削除された");
      assertNotEquals(newUserRoomAfter.value, null, "新しいユーザールーム関連が誤って削除された");
      assertNotEquals(newRoomUpdatesAfter.value, null, "新しいルーム更新情報が誤って削除された");
      assertNotEquals(newSocketAfter.value, null, "新しいソケットインスタンスが誤って削除された");
    });
  } finally {
    // テスト用KVをクローズ
    kv.close();
    
    // テスト用のKVファイルを削除（クリーンアップ）
    try {
      await Deno.remove(tempKvPath);
    } catch (e) {
      console.warn("一時KVファイルの削除に失敗しました:", e);
    }
  }
});