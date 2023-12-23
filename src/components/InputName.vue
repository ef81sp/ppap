<script setup lang="ts">
import { ref } from "vue"

const props = defineProps<{
  buttonText: string
}>()
defineEmits<{ submit: [name: string] }>()

const name = ref("")
</script>

<template>
  <form @submit.prevent="$emit('submit', name)" class="form">
    <label for="userName">Your Name</label>
    <input type="text" v-model="name" />
    <button type="submit">{{ props.buttonText }}</button>
  </form>
</template>
<style scoped>
.form {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  > * {
    font-size: 2rem;
    width: 20rem;
    margin: 0.5rem;
  }
}
</style>
