#!/bin/bash
set -e

# サーバーのPIDを保存する変数
SERVER_PID=""

# クリーンアップ関数
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "サーバーを停止します..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    echo "サーバーを停止しました"
  fi
}

# シグナルトラップ設定
trap cleanup EXIT

# 1. フロントエンドビルド
echo "フロントエンドをビルドします..."
deno task build
echo "フロントエンドのビルドが完了しました"

# 2. サーバー起動
echo "サーバーを起動します..."
deno run --allow-net --allow-read --allow-env --unstable-kv backend/server.ts &
SERVER_PID=$!

# サーバー起動を待機
for i in {1..30}; do
  if curl -s http://localhost:8000 > /dev/null 2>&1; then
    echo "サーバーが起動しました"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "サーバーの起動がタイムアウトしました"
    exit 1
  fi
  sleep 1
done

# 3. テスト実行
echo "E2Eテストを実行します..."
deno test --allow-all --unstable-kv --ignore=e2e/run_e2e.ts,e2e/run_e2e.sh,e2e/install_browsers.ts ${1:-e2e/}
TEST_EXIT_CODE=$?

# テスト結果を報告
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "全てのE2Eテストが成功しました"
else
  echo "E2Eテストに失敗しました"
fi

exit $TEST_EXIT_CODE
