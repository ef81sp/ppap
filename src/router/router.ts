import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router"
import Index from "../components/Index.vue"
import Room from "../components/Room.vue"
import { sendIsExistTheRoom } from "../composables/webSocket.ts"

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: Index,
  },
  {
    path: "/:roomId",
    name: "Room",
    component: Room,
    beforeEnter: (to) => {
      // createRoomのあとにも走ってしまうけれど一旦許容する
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
