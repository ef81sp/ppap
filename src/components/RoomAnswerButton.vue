<script setup lang="ts">
const props = defineProps<{
  option: string
}>()
defineEmits<{ click: [answer: string] }>()
</script>
<template>
  <button @click="$emit('click', props.option)" class="button">{{ option }}</button>
</template>
<style scoped>
.button {
  font-size: 2rem;
  width: 3rem;
  margin: 0 0.25rem;
}
</style>
