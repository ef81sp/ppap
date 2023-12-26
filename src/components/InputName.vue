<script setup lang="ts">
import { ref } from "vue"

const props = defineProps<{
  buttonText: string
}>()
defineEmits<{ submit: [name: string] }>()

const name = ref("")
</script>

<template>
  <form
    @submit.prevent="$emit('submit', name)"
    class="flex flex-col justify-center items-center my-6 *:text-2xl *:w-80 *:m-1"
  >
    <label for="userName">Your Name</label>
    <input
      type="text"
      placeholder="enter your name"
      class="border-solid border border-black p-1 text-center"
      v-model="name"
    />
    <button type="submit" class="border-solid border-2 border-black rounded">
      {{ props.buttonText }}
    </button>
  </form>
</template>
