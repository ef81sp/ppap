import { createApp } from "vue"
import "./style.css"
// @deno-types="@/src/vite-env.d.ts"
import App from "./App.vue"
import router from "./router/router.ts"

createApp(App).use(router).mount("#app")
