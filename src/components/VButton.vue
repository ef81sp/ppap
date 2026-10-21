<script setup lang="ts">
defineEmits<{ click: [void] }>()
</script>
<template>
  <button
    @click="$emit('click')"
    class="border-solid border-2 border-black rounded-sm shadow-md active:shadow-none active:translate-x-0.5 active:translate-y-0.5 focus:ring-3 focus:ring-blue-500/50"
  >
    <slot />
  </button>
</template>
