<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  answer: string
  isOpen: boolean
}>()
const answer = computed(() => {
  if (props.answer === "") return ""
  if (props.isOpen) return props.answer
  return "?"
})
</script>

<template>
  <p
    class="aspect-[63/88] text-5xl w-20 border-4 rounded-md border-solid border-black grid place-items-center"
  >
    {{ answer }}
  </p>
</template>
