import type { JoinRoomRequest, JoinRoomResponse } from '@/backend/type.ts';

export async function joinRoomApi(
  roomId: string,
  req: JoinRoomRequest
): Promise<JoinRoomResponse> {
  const res = await fetch(`/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error('ルーム参加APIに失敗しました');
  }
  return await res.json();
}
