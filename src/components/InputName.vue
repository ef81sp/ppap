<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  buttonText: string
}>()
defineEmits<{ submit: [name: string] }>()

const name =ref("")
</script>

<template>
  <form @submit.prevent="$emit('submit', name)">
    <label for="userName">Your Name</label>
    <input type="text" v-model="name" />
    <button type="submit">{{ props.buttonText }}</button>
  </form>
</template>
