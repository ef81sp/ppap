import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router"

import Index from "@/components/Index.vue"

import Room from "@/components/Room.vue"

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
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
