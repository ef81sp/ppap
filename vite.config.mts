/// <reference types="vitest" />
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { dirname, fromFileUrl, join } from "jsr:@std/path"
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
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "wsMsg/**/*.test.ts"],
  },
})
