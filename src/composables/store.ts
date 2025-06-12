import { ref } from 'vue';
import { Room } from '@/backend/type.ts';

export const user = {
  name: ref(''),
  token: ref(''),
};
export const setName = (name: string) => {
  user.name.value = name;
};
export const setToken = (token: string) => {
  user.token.value = token;
};

export const room = ref<Room | null>(null);
export const setRoom = (newRoom: Room) => {
  room.value = newRoom;
};
