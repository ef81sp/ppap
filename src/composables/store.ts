import { ref } from "vue"
import { User } from "../../backend/type.ts";

export const user = {
  name: ref(""),
  token: ref(""),
}
export const setName = (name: string) => {
  user.name.value = name
}
export const setToken = (token: string) => {
  user.token.value = token
}

export const room = {
  id: ref(""),
  participants: ref<User[]>([])
}

export const setRoomId = (id: string) => {
  room.id.value = id
}
