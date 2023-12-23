import { ref } from "vue"
import { RoomForClientSide } from "../../backend/type.ts"

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

export const room = ref<RoomForClientSide>({
  id: "",
  participants: [],
  isOpen: false,
})
export const setRoom = (roomForClientSide: RoomForClientSide) => {
  room.value = roomForClientSide
}
export const setRoomId = (id: string) => {
  room.value.id = id
}
