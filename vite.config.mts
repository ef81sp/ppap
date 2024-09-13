import { defineConfig, AliasOptions } from "vite"
import vue from "@vitejs/plugin-vue"
import {
  fromFileUrl,
  dirname,
  join,
} from "https://deno.land/std@0.209.0/path/mod.ts"
import "npm:vue@^3.4.0"
import "npm:@vueuse/core@^10.7.0"
import "npm:vue-router@4"
import "npm:tailwindcss@^3.4.0"
import "npm:postcss@^8.4.32"
import "npm:autoprefixer@^10.4.16"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@/": join(dirname(fromFileUrl(import.meta.url)), "./"),
    },
  },
})
