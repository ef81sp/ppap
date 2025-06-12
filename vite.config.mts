import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.209.0/path/mod.ts"
import "vue"
import "@vueuse/core"
import "vue-router"
import "tailwindcss"
import "postcss"
import "autoprefixer"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@/": join(dirname(fromFileUrl(import.meta.url)), "./src/"), // ./src/ に修正
    },
  },
})
