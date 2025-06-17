// KVストアを完全にクリアするユーティリティ
export async function clearKvAll(kv: Deno.Kv) {
  for await (const entry of kv.list({ prefix: [] })) {
    await kv.delete(entry.key)
  }
}
