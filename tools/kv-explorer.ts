#!/usr/bin/env -S deno run --unstable-kv --allow-read --allow-env

/**
 * Deno KVの内容を閲覧するためのシンプルなツール
 * 使用方法:
 * 1. 全データ表示: deno run --unstable-kv --allow-read --allow-env tools/kv-explorer.ts
 * 2. プレフィックスで絞り込み: deno run --unstable-kv --allow-read --allow-env tools/kv-explorer.ts rooms
 */

// KVデータベースのパスを環境変数から取得（設定されていなければデフォルトパスを使用）
const kvPath = Deno.env.get("DENO_KV_PATH") || undefined;

async function main() {
  // KVに接続
  const kv = await Deno.openKv(kvPath);
  
  // コマンドライン引数からプレフィックスを取得
  const prefix = Deno.args[0] ? [Deno.args[0]] : [];
  console.log(`🔍 プレフィックス "${prefix.join("/")}" で検索中...`);
  
  // データ取得
  const entries = kv.list({ prefix });
  let count = 0;
  
  console.log("\n=== KV内のデータ ===");
  for await (const entry of entries) {
    count++;
    console.log(`\nキー: [${entry.key.join(", ")}]`);
    console.log(`値: ${JSON.stringify(entry.value, null, 2)}`);
    console.log(`バージョン: ${entry.versionstamp}`);
    console.log("-------------------");
  }
  
  console.log(`\n合計 ${count} 件のエントリーが見つかりました。`);
  
  // 接続を閉じる
  kv.close();
}

main().catch(console.error);