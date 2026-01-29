import { chromium } from "playwright"

// Playwrightのブラウザをインストール
const cmd = new Deno.Command("npx", {
  args: ["playwright", "install", "chromium"],
  stdout: "inherit",
  stderr: "inherit",
})

const { code } = await cmd.output()
Deno.exit(code)
