# 図

## 仕組み

- KV ストアを使用して、ルーム情報やユーザーの状態を管理
- WebSocket を使用して、リアルタイムでの通知を実現
- Deno KV の Watch API を使用して、複数インスタンス間でのデータ同期を実現
- SocketMessageHandler が WebSocket メッセージを処理し、KVRoomStore と連携
- KVRoomStore がルーム情報を管理し、Deno KV にデータを保存
- KVSocketStore がソケットインスタンスを管理し、ユーザーに通知
- SocketMessageHandler がルーム情報をブロードキャスト
- フロントエンド WebSocket がクライアントと通信
- クライアントは、ルーム作成、参加、回答送信などの操作を行う
- 各インスタンスは、KV ストアの Watch API を使用して、他のインスタンスからの変更通知を受け取る
- ルームの参加者は、他の参加者の状態をリアルタイムで確認できる

## KV ストアデータスキーマ

KV ストアには以下のデータが保存されています。各エントリは特定の目的を持ち、アプリケーションの状態管理に使用されます。

### 1. ルーム情報

| キー              | 値   | 説明                                                           |
| ----------------- | ---- | -------------------------------------------------------------- |
| ["rooms", roomId] | Room | ルーム情報オブジェクト。参加者リスト、ルームの状態などを含む。 |

```typescript
// Roomオブジェクトの構造
interface Room {
  id: RoomId;
  participants: {
    token: UserToken;
    name: string;
    answer: string;
  }[];
  isOpen: boolean;
}
```

### 2. ユーザーとルームの関連付け

| キー                      | 値     | 説明                                        |
| ------------------------- | ------ | ------------------------------------------- |
| ["user_rooms", userToken] | RoomId | 特定のユーザーが現在参加しているルームの ID |

### 3. ルーム更新タイムスタンプ

| キー                     | 値   | 説明                                                                       |
| ------------------------ | ---- | -------------------------------------------------------------------------- |
| ["room_updates", roomId] | Date | ルームが最後に更新された日時。アイドル状態のルームのクリーンアップに使用。 |

### 4. ソケットインスタンスマッピング

| キー                            | 値     | 説明                                                                                            |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| ["socket_instances", userToken] | string | ユーザーが接続しているサーバーインスタンスの ID。複数サーバーインスタンス間での通知制御に使用。 |

## Watch について

同一ルームの参加者が別々のサーバーインスタンスに接続することがある。この場合サーバーは別々のメモリを参照することになるため、KV を使用して、ルームの状態を同期する必要がある。
そこで、KV ストアの Watch API を使用して、ルーム情報の変更を監視する。

### Watch が見るもの

- ルーム情報

### Watch を登録するタイミング

- ルーム作成時
- ルーム参加時

### Watch によって更新を検知するタイミング

- 回答時
- メンバーの参加・退出時

### Watch の管理

- Map<roomId, stream> で管理
- ルーム参加時に、既に Watch されている場合は、登録しない
- ルーム退出時に、参加者が 0 人になった場合は、Watch を解除する

## KVRoomStore のシーケンス図

### 1. ルーム作成のフロー

```mermaid
sequenceDiagram
    actor Client
    participant FrontendWS as フロントエンドWebSocket
    participant SocketMsgHandler as SocketMessageHandler
    participant KVRoomStore as KVRoomStore
    participant DenoKV as Deno KV

    Client->>FrontendWS: createRoom
    FrontendWS->>SocketMsgHandler: {"type": "createRoom", ...}
    SocketMsgHandler->>KVRoomStore: createRoom(userToken, userName)
    KVRoomStore->>KVRoomStore: ensureKV()
    KVRoomStore->>KVRoomStore: roomId = crypto.randomUUID()
    KVRoomStore->>DenoKV: atomic.set(['rooms', roomId], room)
    KVRoomStore->>DenoKV: atomic.set(['user_rooms', userToken], roomId)
    KVRoomStore->>DenoKV: atomic.set(['room_updates', roomId], new Date())
    KVRoomStore->>DenoKV: atomic.commit()
    DenoKV-->>KVRoomStore: result.ok
    KVRoomStore->>KVRoomStore: watchRoom(roomId)
    Note right of KVRoomStore: 作成したルームをWatchに登録、WatchのstreamをMapに格納
    KVRoomStore-->>SocketMsgHandler: room
    SocketMsgHandler->>FrontendWS: genMsgRoomCreated
    SocketMsgHandler->>SocketMsgHandler: broadcastRoomInfo(room)
    FrontendWS-->>Client: ルーム作成完了
```

### 2. ルーム参加のフロー

```mermaid
sequenceDiagram
    actor Client
    participant FrontendWS as フロントエンドWebSocket
    participant SocketMsgHandler as SocketMessageHandler
    participant KVRoomStore as KVRoomStore
    participant KVSocketStore as KVSocketStore
    participant DenoKV as Deno KV

    Client->>FrontendWS: enterTheRoom
    FrontendWS->>SocketMsgHandler: {"type": "enterTheRoom", ...}
    SocketMsgHandler->>KVRoomStore: enterTheRoom({roomId, userToken, userName})
    KVRoomStore->>DenoKV: get(['rooms', roomId])
    DenoKV-->>KVRoomStore: room
    KVRoomStore->>KVRoomStore: room.participants.push({...})
    KVRoomStore->>KVRoomStore: sortParticipants(room)
    KVRoomStore->>DenoKV: atomic.set(['rooms', roomId], room)
    KVRoomStore->>DenoKV: atomic.set(['user_rooms', userToken], roomId)
    KVRoomStore->>DenoKV: atomic.set(['room_updates', roomId], new Date())
    KVRoomStore->>DenoKV: atomic.commit()
    DenoKV-->>KVRoomStore: result.ok
    KVRoomStore->>KVRoomStore: checkAndWatchRoom(roomId)
    Note right of KVRoomStore: 参加したルームが既にWatchされていなければ登録、WatchのstreamをMapに格納
    KVRoomStore-->>SocketMsgHandler: room
    SocketMsgHandler->>SocketMsgHandler: broadcastRoomInfo(room)

    Note over KVRoomStore,DenoKV: KV変更がトリガーされる
    DenoKV-->>KVRoomStore: Watch API通知
    KVRoomStore->>KVRoomStore: notifyLocalUsersAboutRoomChange(room)
    KVRoomStore->>KVSocketStore: getSocketInstance(participant.token)
    KVSocketStore->>DenoKV: get(["socket_instances", userToken])
    DenoKV-->>KVSocketStore: instanceId
    KVSocketStore-->>KVRoomStore: instanceId
    KVRoomStore->>KVSocketStore: getSocket(participant.token)
    KVSocketStore-->>KVRoomStore: socket
    KVRoomStore->>FrontendWS: socket.send(roomForClient)
    FrontendWS-->>Client: ルーム情報更新
```

### 3. 回答送信のフロー

```mermaid
sequenceDiagram
    actor Client
    participant FrontendWS as フロントエンドWebSocket
    participant SocketMsgHandler as SocketMessageHandler
    participant KVRoomStore as KVRoomStore
    participant DenoKV as Deno KV

    Client->>FrontendWS: answer
    FrontendWS->>SocketMsgHandler: {"type": "answer", ...}
    SocketMsgHandler->>KVRoomStore: answer({roomId, userToken, answer})
    KVRoomStore->>DenoKV: get(['rooms', roomId])
    DenoKV-->>KVRoomStore: room
    KVRoomStore->>KVRoomStore: user.answer = answer
    KVRoomStore->>KVRoomStore: 全員が回答したか確認
    KVRoomStore->>DenoKV: atomic.set(['rooms', roomId], room)
    KVRoomStore->>DenoKV: atomic.set(['room_updates', roomId], new Date())
    KVRoomStore->>DenoKV: atomic.commit()
    DenoKV-->>KVRoomStore: result.ok
    KVRoomStore-->>SocketMsgHandler: room
    SocketMsgHandler->>SocketMsgHandler: broadcastRoomInfo(room)
    SocketMsgHandler-->>FrontendWS: 回答送信完了
    FrontendWS-->>Client: 回答送信完了
```

### 4. KV Watch による複数インスタンス間の同期フロー

以下が起きたとき、当該 room の wacth を登録する

- そのインスタンスでユーザーが room を作成した
- いずれかのインスタンスでユーザーが room に参加した

```mermaid
sequenceDiagram
    participant Instance1 as サーバーインスタンス1
    participant KV as Deno KV
    participant Instance2 as サーバーインスタンス2
    participant Client1A as クライアント1A (roomA参加)
    participant Client2A as クライアント2A (roomA参加)
    participant Client2B as クライアント2B (roomB参加)

    Note over Instance1,Instance2: 初期化時
    Instance1->>KV: watch({ prefix: ['rooms'] })
    Instance2->>KV: watch({ prefix: ['rooms'] })

    Note over Client1A,Instance1: Client1AがroomAを更新
    Client1A->>Instance1: roomAに回答を送信
    Instance1->>KV: set(['rooms', roomA-id], updatedRoomA)
    Instance1->>Client1A: 直接通知（ローカルインスタンスユーザー）

    Note over KV,Instance2: KV Watch APIがroomAの変更を検知
    KV-->>Instance2: roomAの変更通知
    Instance2->>Instance2: notifyLocalUsersAboutRoomChange(roomA)

    Note right of Instance2: roomAの参加者のみ確認
    Instance2->>KV: get(["socket_instances", participantA.token])
    KV-->>Instance2: "instance2-id" (ローカルインスタンスと一致)
    Instance2->>Client2A: socket.send(roomA情報)

    Note right of Instance2: Client2Bは別のルームに所属
    Instance2->>KV: get(["socket_instances", participantB.token])
    KV-->>Instance2: "instance2-id"
    Instance2->>Instance2: roomA参加者ではないため通知しない

    Note over Client1A,Client2A: roomAに参加しているユーザーのみが同期される
    Note over Client2B: roomBのユーザーには通知されない
```

### 5. ユーザー退出のフロー

```mermaid
sequenceDiagram
    actor Client
    participant FrontendWS as フロントエンドWebSocket
    participant SocketMsgHandler as SocketMessageHandler
    participant KVRoomStore as KVRoomStore
    participant KVSocketStore as KVSocketStore
    participant DenoKV as Deno KV

    alt 退室ボタンによる明示的な退室
        Client->>FrontendWS: exitボタンクリック
        FrontendWS->>FrontendWS: sessionStorage.clear()
        FrontendWS->>Client: トップページにリダイレクト
        Note right of Client: WebSocket接続が閉じられる
        FrontendWS-->>SocketMsgHandler: socket.onclose イベント発火
    else ブラウザを閉じるなど
        Client->>FrontendWS: WebSocket接続切断
        FrontendWS-->>SocketMsgHandler: socket.onclose イベント発火
    end

    SocketMsgHandler->>SocketMsgHandler: closeHandler(userToken)
    SocketMsgHandler->>KVSocketStore: deleteSocket(userToken)
    KVSocketStore->>DenoKV: delete(["socket_instances", userToken])
    DenoKV-->>KVSocketStore: 削除完了

    SocketMsgHandler->>KVRoomStore: exitRoom(userToken)
    KVRoomStore->>DenoKV: get(['user_rooms', userToken])
    DenoKV-->>KVRoomStore: roomId
    KVRoomStore->>DenoKV: get(['rooms', roomId])
    DenoKV-->>KVRoomStore: room

    KVRoomStore->>KVRoomStore: room.participants.filter(v => v.token !== userToken)
    KVRoomStore->>KVRoomStore: sortParticipants(room)
    KVRoomStore->>KVRoomStore: 全員が回答したか確認

    KVRoomStore->>DenoKV: atomic.set(['rooms', roomId], room)
    KVRoomStore->>DenoKV: atomic.set(['room_updates', roomId], new Date())
    KVRoomStore->>DenoKV: atomic.delete(['user_rooms', userToken])
    KVRoomStore->>DenoKV: atomic.commit()
    DenoKV-->>KVRoomStore: result.ok

    KVRoomStore-->>SocketMsgHandler: 更新後のroom

    Note over KVRoomStore,DenoKV: KV変更がトリガーされる
    DenoKV-->>KVRoomStore: Watch API通知
    KVRoomStore->>KVRoomStore: notifyLocalUsersAboutRoomChange(room)

    Note right of KVRoomStore: 残りの参加者に通知
    KVRoomStore->>KVSocketStore: 各参加者のgetSocketInstance(participant.token)
    KVSocketStore->>DenoKV: get(["socket_instances", participantToken])
    DenoKV-->>KVSocketStore: instanceId
    KVSocketStore-->>KVRoomStore: instanceId

    KVRoomStore->>KVSocketStore: getSocket(participant.token)
    KVSocketStore-->>KVRoomStore: socket
    KVRoomStore->>FrontendWS: socket.send(roomForClient)
    FrontendWS-->>Client: 残っているクライアントに更新通知

    SocketMsgHandler->>KVRoomStore: closeEmptyRoom()
    KVRoomStore->>KVRoomStore: 参加者が0人のルームをチェック

    alt 参加者が0人の場合
        KVRoomStore->>DenoKV: delete(['rooms', roomId])
        KVRoomStore->>DenoKV: delete(['room_updates', roomId])
        DenoKV-->>KVRoomStore: 削除完了
        KVRoomStore->>KVRoomStore: stopWatchingRoom(roomId)
        Note right of KVRoomStore: 空のルームを削除、WatchのstreamをMapから削除
    end
```

### 6. ルームのクリーンアップ

```mermaid
sequenceDiagram
    participant KVRoomStore as KVRoomStore
    participant DenoKV as Deno KV

    Note over KVRoomStore,DenoKV: 定期的に実行されるクリーンアップ処理
    KVRoomStore->>DenoKV: get(['room_updates', roomId])
    DenoKV-->>KVRoomStore: roomUpdates
    KVRoomStore->>KVRoomStore: ルームのアイドル状態を確認
    alt アイドル状態の場合
        KVRoomStore->>DenoKV: delete(['rooms', roomId])
        KVRoomStore->>DenoKV: delete(['room_updates', roomId])
        DenoKV-->>KVRoomStore: 削除完了
        KVRoomStore->>KVRoomStore: stopWatchingRoom(roomId)
        Note right of KVRoomStore: 空のルームを削除、WatchのstreamをMapから削除
    end
```

これらのシーケンス図は、KVRoomStore の主要な処理フローと、複数インスタンス間での同期メカニズムを視覚的に表現しています。特に、KV Watch API を使用した同期の仕組みが重要です。

**図の解説：**

1. **ルーム作成フロー**：ユーザーがルームを作成するときの一連の処理を示しています。KV ストアを使用してルーム情報が保存されます。

2. **ルーム参加フロー**：ユーザーがルームに参加する際の処理と、他の参加者への通知を示しています。

3. **回答送信フロー**：ユーザーが回答を送信する際の処理を示しています。

4. **KV Watch 同期フロー**：異なるサーバーインスタンス間でのデータ同期の仕組みを示しています。KV Watch API を使用して、あるインスタンスの変更が他のインスタンスに伝搬される様子を表現しています。

### KV ストアの特徴

- **原子的操作**: トランザクションを使用して複数のキーを原子的に更新
- **分散環境対応**: 複数のサーバーインスタンスでデータを共有
- **Watch API**: キーの変更を監視して、リアルタイムでの同期を実現

### KV ストアの使用パターン

1. **ルーム作成時**:

   - ルーム情報
   - ユーザーとルームの関連付け
   - ルーム更新タイムスタンプの設定

2. **ルーム参加時**:

   - 既存のルーム情報を更新
   - 新しいユーザーとルームを関連付け
   - ルーム更新タイムスタンプの更新

3. **回答送信時**:

   - ルーム情報を更新（ユーザーの回答を保存）
   - ルーム更新タイムスタンプの更新

4. **ユーザー退出時**:
   - ルーム情報を更新（ユーザーを削除）
   - ユーザーとルームの関連付けを削除
   - ルーム更新タイムスタンプの更新
