/// <reference types="vitest" />
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"
import { dirname, fromFileUrl, join } from "@std/path"
import "vue"
import "@vueuse/core"
import "vue-router"
import "tailwindcss"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@/": join(dirname(fromFileUrl(import.meta.url)), "./src/"), // ./src/ に修正
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "wsMsg/**/*.test.ts"],
  },
})
