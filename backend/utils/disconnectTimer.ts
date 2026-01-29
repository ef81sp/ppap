export class DisconnectTimerManager {
  private timers = new Map<string, number>()

  private makeKey(roomId: string, userToken: string): string {
    return `${roomId}:${userToken}`
  }

  set(
    roomId: string,
    userToken: string,
    callback: () => unknown,
    delayMs: number,
  ): void {
    const key = this.makeKey(roomId, userToken)

    // 既存タイマーがあればクリア
    const existing = this.timers.get(key)
    if (existing) {
      clearTimeout(existing)
    }

    // 新しいタイマーを設定
    const timer = setTimeout(async () => {
      this.timers.delete(key)
      await callback()
    }, delayMs)

    this.timers.set(key, timer as unknown as number)
  }

  cancel(roomId: string, userToken: string): void {
    const key = this.makeKey(roomId, userToken)
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  has(roomId: string, userToken: string): boolean {
    return this.timers.has(this.makeKey(roomId, userToken))
  }
}
