<script setup lang="ts">
import { computed } from "vue"
import { UserForClientSide } from "../../backend/type"
import RoomParticipantCard from "./RoomParticipantCard.vue"

const props = defineProps<{ participant: UserForClientSide; isOpen: boolean }>()
const answer = computed(() => {
  if (props.participant.answer === "") return ""
  if (props.isOpen) return props.participant.answer
  return "?"
})
</script>
<template>
  <article class="w-32 flex flex-col-reverse items-center">
    <h3 class="m-1">{{ participant.name }}</h3>
    <RoomParticipantCard :answer="answer" :is-open="props.isOpen" />
  </article>
</template>
