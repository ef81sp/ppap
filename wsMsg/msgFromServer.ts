import { RoomForClient, UserToken } from '@/backend/type.ts';

export type MsgFromServer = MsgConnected | MsgRoomInfo;

const _msgType = {
  connected: 'connected',
  roomCreated: 'roomCreated',
  isExistTheRoomResult: 'isExistTheRoomResult',
  roomInfo: 'roomInfo',
} as const;
type MsgConnected = {
  type: (typeof _msgType)['connected'];
  userToken: string;
};

type MsgRoomInfo = {
  type: (typeof _msgType)['roomInfo'];
  room: RoomForClient;
};

export const isMsgFromServer = (
  data: unknown
): data is MsgFromServer | { type: 'room_update'; room: RoomForClient } => {
  if (data == undefined) return false;
  if (typeof data !== 'object') return false;
  const d = data as { type?: string };
  if (
    !(
      'type' in d &&
      typeof d.type === 'string' &&
      (Object.values(_msgType).some(v => v === d.type) ||
        d.type === 'room_update')
    )
  ) {
    return false;
  }
  return true;
};

export const genMsgConnected = (userToken: UserToken): MsgConnected => ({
  type: 'connected',
  userToken,
});

export const genMsgRoomInfo = (room: RoomForClient): MsgRoomInfo => ({
  type: 'roomInfo',
  room,
});
