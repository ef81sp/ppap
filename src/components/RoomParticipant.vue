<script setup lang="ts">
import { computed } from "vue";
import { UserForClientSide } from "../../backend/type"

const props = defineProps<{ participant: UserForClientSide; isOpen: boolean }>()
const answer = computed(() => {
  if (props.participant.answer === "") return ""
  if (props.isOpen) return props.participant.answer
  return "?"
})
</script>
<template>
  <article class="participant">
    <h3 class="name">{{ participant.name }}</h3>
    <p class="card">{{ answer }}</p>
  </article>
</template>

<style scoped>
.name {
  margin: 0.25rem 0.25rem;
}
.participant {
  width: 8rem;
  display: flex;
  flex-direction: column-reverse;
  margin: 0.5rem;
}
.card {
  border: 1px solid #222;
  height: 6rem;
  font-size: 2.5rem;
  padding: 1rem 0;
  margin: 0.1rem 0;
  display: grid;
  place-items: center;
}
</style>
