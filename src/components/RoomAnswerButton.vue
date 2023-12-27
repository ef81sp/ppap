<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  option: string
  isSelected: boolean
}>()
const translate = computed(() => ({
  "-translate-y-3": props.isSelected,
  "hover:-translate-y-1 focus:-translate-y-1": !props.isSelected,
}))
defineEmits<{ click: [answer: string] }>()
</script>
<template>
  <button
    @click="$emit('click', props.option)"
    class="text-center w-10 text-xl aspect-[63/88]"
    :class="translate"
  >
    {{ option }}
  </button>
</template>
