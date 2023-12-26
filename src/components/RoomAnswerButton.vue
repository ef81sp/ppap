<script setup lang="ts">
const props = defineProps<{
  option: string
}>()
defineEmits<{ click: [answer: string] }>()
</script>
<template>
  <button
    @click="$emit('click', props.option)"
    class="text-center w-10 text-xl aspect-[63/88]"
  >
    {{ option }}
  </button>
</template>
