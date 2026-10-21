import "playwright"

// deno.jsonで固定したバージョンのPlaywright CLIでブラウザをインストール
// 追加引数（例: --with-deps）はそのまま渡す
const cmd = new Deno.Command(Deno.execPath(), {
  args: ["run", "-A", "node_modules/playwright/cli.js", "install", ...Deno.args, "chromium"],
  stdout: "inherit",
  stderr: "inherit",
})

const { code } = await cmd.output()
Deno.exit(code)
