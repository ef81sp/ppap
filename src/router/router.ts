import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router"
import Index from "../components/Index.vue"
import Room from "../components/Room.vue"
import { isRoomCreator, sendIsExistTheRoom } from "../composables/webSocket.ts"

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: Index,
    beforeEnter: () => {
      // セッションストレージにルームIDがあれば、そのルームに飛ぶ(再入室)
      const roomId = sessionStorage.getItem("roomId")
      if (roomId == null) return
      router.push(`/${roomId}`)
    },
  },
  {
    path: "/:roomId",
    name: "Room",
    component: Room,
    beforeEnter: (to) => {
      if (isRoomCreator.value) return

      const roomId = to.params.roomId
      if (typeof roomId === "object") return
      sendIsExistTheRoom(roomId)
    },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
