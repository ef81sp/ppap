<script setup lang="ts">
import { ref } from 'vue';
import VButton from './VButton.vue';
import { useId } from 'vue';

const props = defineProps<{
  buttonText: string;
}>();
defineEmits<{ submit: [name: string] }>();

const name = ref('');
const inputId = useId();
</script>

<template>
  <form
    @submit.prevent="$emit('submit', name)"
    class="flex flex-col justify-center items-center my-6 *:text-2xl *:w-80 *:m-1"
  >
    <label :for="inputId">Your Name</label>
    <input
      type="text"
      required
      placeholder="enter your name"
      class="border-solid border border-black p-1 text-center"
      v-model="name"
      :id="inputId"
    />
    <VButton type="submit">
      {{ props.buttonText }}
    </VButton>
  </form>
</template>
