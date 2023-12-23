import { createRouter , createWebHistory} from "vue-router"
import Index from "../components/Index.vue"
import Room from "../components/Room.vue"

const routes = [
  {
    path: "/",
    name: "Home",
    component: Index,
  },
  {
    path: "/:roomId",
    name: "Room",
    component: Room,
    props: true,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
