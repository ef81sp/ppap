import { Room, RoomId, UserToken } from "@/backend/type.ts";
import { RoomStore } from "../interfaces.ts";
import { getStoreManager } from "../storeManager.ts";

/**
 * メモリベースのRoomStore実装
 */
export class MemoryRoomStore implements RoomStore {
  private rooms: Map<RoomId, Room> = new Map();
  private roomsUserAt: Map<UserToken, RoomId> = new Map();
  private latestUpdateOfRoom: Map<RoomId, Date> = new Map();

  constructor() {
    // 5分に1回、30分間更新のないルームを閉じる
    const thresholdMs = 30 * 1000 * 60;
    setInterval(() => {
      console.log("polling memory store...");
      const now = Date.now();
      const idleRoomIds = [...this.latestUpdateOfRoom]
        .filter(([, date]) => now - date.getTime() > thresholdMs)
        .map(([roomId]) => roomId);
      for (const roomId of idleRoomIds) {
        console.log("room closed:", roomId);
        this.closeRoom(roomId);
      }
    }, 5 * 1000 * 60);
  }

  createRoom(userToken: UserToken, userName: string): Promise<Room> {
    const roomId = crypto.randomUUID();
    const room: Room = {
      id: roomId,
      participants: [
        {
          token: userToken,
          name: userName,
          answer: "",
        },
      ],
      isOpen: false,
    };
    this.rooms.set(roomId, room);
    this.roomsUserAt.set(userToken, roomId);
    this.latestUpdateOfRoom.set(roomId, new Date());
    console.log("room created:", roomId);
    return Promise.resolve(room);
  }

  isExistTheRoom(roomId: RoomId): Promise<boolean> {
    return Promise.resolve(this.rooms.has(roomId));
  }

  enterTheRoom({
    roomId,
    userToken,
    userName,
  }: {
    roomId: RoomId;
    userToken: UserToken;
    userName: string;
  }): Promise<Room | undefined> {
    const room = this.rooms.get(roomId);
    if (room == undefined) return Promise.resolve(undefined);
    room.participants.push({
      token: userToken,
      name: userName,
      answer: "",
    });
    this.sortParticipants(room);
    this.latestUpdateOfRoom.set(roomId, new Date());
    this.roomsUserAt.set(userToken, roomId);

    return Promise.resolve(room);
  }

  answer({
    roomId,
    userToken,
    answer,
  }: {
    roomId: RoomId;
    userToken: UserToken;
    answer: string;
  }): Promise<Room | undefined> {
    const room = this.rooms.get(roomId);
    if (room == undefined) return Promise.resolve(undefined);
    const user = room.participants.find((u) => u.token === userToken);
    if (user == undefined) return Promise.resolve(undefined);
    user.answer = answer;
    if (room.participants.every((u) => u.answer !== "")) {
      room.isOpen = true;
    }
    this.latestUpdateOfRoom.set(roomId, new Date());
    return Promise.resolve(room);
  }

  clearAnswer(roomId: RoomId): Promise<Room | undefined> {
    const room = this.rooms.get(roomId);
    if (room == undefined) return Promise.resolve(undefined);
    for (const p of room.participants) {
      p.answer = "";
    }
    room.isOpen = false;
    this.latestUpdateOfRoom.set(roomId, new Date());
    return Promise.resolve(room);
  }

  exitRoom(userToken: UserToken): Promise<Room | undefined> {
    const roomId = this.roomsUserAt.get(userToken);
    if (roomId == undefined) return Promise.resolve(undefined);
    const room = this.rooms.get(roomId);
    if (room == undefined) return Promise.resolve(undefined);
    console.log("exit room:", roomId, "user:", userToken);
    room.participants = room.participants.filter((v) => v.token !== userToken);
    this.sortParticipants(room);
    this.roomsUserAt.delete(userToken);
    this.latestUpdateOfRoom.set(roomId, new Date());
    if (room.participants.every((u) => u.answer !== "")) {
      room.isOpen = true;
    }
    return Promise.resolve(room);
  }

  closeEmptyRoom(): Promise<void> {
    for (const [id, room] of this.rooms) {
      if (room.participants.length === 0) {
        this.rooms.delete(id);
        this.latestUpdateOfRoom.delete(id);
        console.log("room closed:", id);
      }
    }
    return Promise.resolve();
  }

  async closeRoom(roomId: RoomId): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room == undefined) return;
    console.log("room closed:", roomId);

    // 残っているユーザーを全員切断
    for (const p of room.participants) {
      const socketStore = getStoreManager().getSocketStore();
      const socket = socketStore.getSocket(p.token);
      if (socket == undefined) continue;
      socket.close();
      await socketStore.deleteSocket(p.token);
      this.roomsUserAt.delete(p.token);
    }

    this.latestUpdateOfRoom.delete(roomId);
    this.rooms.delete(roomId);
  }

  private sortParticipants(room: Room): void {
    room.participants.sort((a, b) => {
      if (a.token > b.token) return 1;
      if (a.token < b.token) return -1;
      return 0;
    });
  }
}