/**
 * ルームごとのKV Watcherを管理するクラス
 * AbortControllerを使ってwatcherを停止可能にする
 */
export class WatcherManager {
  private controllers = new Map<string, AbortController>()

  /**
   * ルームのwatcherを登録する
   */
  register(roomId: string, controller: AbortController): void {
    this.controllers.set(roomId, controller)
  }

  /**
   * ルームのwatcherを停止する
   */
  stop(roomId: string): void {
    const controller = this.controllers.get(roomId)
    if (controller) {
      controller.abort()
      this.controllers.delete(roomId)
      console.log(`Stopped watcher for room: ${roomId}`)
    }
  }

  /**
   * ルームのwatcherが登録されているか確認する
   */
  has(roomId: string): boolean {
    return this.controllers.has(roomId)
  }
}
