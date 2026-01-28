# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## プロジェクト概要

PPAP（Planning Poker Application Portable）-
アジャイル開発のプランニングポーカーを実施するためのリアルタイムWebアプリケーション。

## 開発コマンド

### フロントエンド

- `deno task dev` - Vite開発サーバー起動（ポート5173）
- `deno task build` - プロダクションビルド
- `deno task preview` - ビルド結果のプレビュー

### バックエンド

- `deno task dev:serve` - 開発サーバー起動（ポート8000、ホットリロード有効）
- `deno task serve` - プロダクションサーバー起動

### テスト

- `deno test backend/` - バックエンドテスト実行
- `deno test backend/handlers/roomHandlers_test.ts` - 単一テストファイル実行
- `deno task install-browsers` - E2Eテスト用ブラウザインストール

### デプロイ

- `deno task deploy` - Deno Deployへデプロイ

## アーキテクチャ

### 技術スタック

- フロントエンド: Vue 3 + TypeScript + Vite + Tailwind CSS
- バックエンド: Deno v2 + Deno KV
- リアルタイム通信: WebSocket
- ホスティング: Deno Deploy

### ディレクトリ構成

- `src/` - Vueフロントエンド
  - `components/` - Vueコンポーネント
  - `composables/` - 状態管理（store.ts）、WebSocket（webSocket.ts）
  - `router/` - Vue Routerルーティング設定
- `backend/` - Denoバックエンド
  - `server.ts` - HTTPサーバー・ルーティング
  - `kv.ts` - Deno KV CRUD操作
  - `handlers/` - REST API/WebSocketハンドラ
- `wsMsg/` - WebSocketメッセージ型定義
- `e2e/` - Playwrightテスト
- `docs/` - 設計ドキュメント（日本語）

### 通信パターン

- 入退室: REST API（`/api/rooms/*`）
- 回答・リアルタイム更新: WebSocket（`/ws/rooms/:roomId`）
- Deno Deploy複数インスタンス間の同期: Deno KV watch

### セッション管理

- UserTokenをsessionStorageに保存
- リロード時はrejoin APIで復帰

## コーディング規約

- コメントは最小限、説明が必要な場合は日本語で記述
- フォーマット: セミコロンなし、行幅100文字（`deno fmt`準拠）

## 設計ドキュメント

詳細な設計は `docs/設計.md` を参照。
