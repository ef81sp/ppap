import { ref } from "vue"
import { RoomForClient } from "@/backend/type.ts"

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

export const room = ref<RoomForClient | null>(null)
export const setRoom = (newRoom: RoomForClient) => {
  room.value = newRoom
}

export const clearStore = () => {
  user.name.value = ""
  user.token.value = ""
  room.value = null
}
