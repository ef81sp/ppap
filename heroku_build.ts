import $ from "https://deno.land/x/dax@0.36.0/mod.ts"

const result = await $`deno task build`
console.log(result.code)
