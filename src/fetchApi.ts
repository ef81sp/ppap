import type {
  JoinRoomRequest,
  JoinRoomResponse,
  RejoinRoomRequest,
  RejoinRoomResponse,
} from '@/backend/type.ts';

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

export async function rejoinRoomApi(
  roomId: string,
  req: RejoinRoomRequest
): Promise<RejoinRoomResponse> {
  const res = await fetch(`/api/rooms/${roomId}/rejoin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error('再入場APIに失敗しました');
  }
  return await res.json();
}
