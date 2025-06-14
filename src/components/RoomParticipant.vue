<script setup lang="ts">
import { computed } from 'vue';
import { RoomForClient } from '@/backend/type';
import RoomParticipantCard from './RoomParticipantCard.vue';

const props = defineProps<{
  participant: RoomForClient['participants'][number];
  isOpen: boolean;
}>();
const answer = computed(() => {
  if (props.participant.answer === '-1') return '-1';
  if (props.participant.answer === '') return '';
  if (props.isOpen) return props.participant.answer;
  return '?';
});
</script>
<template>
  <article class="w-32 flex flex-col-reverse items-center">
    <h3 class="m-1 w-full truncate">{{ participant.name }}</h3>
    <!-- Audience の場合、 Room.vue からそれを示す値として -1 を送っている -->
    <div
      v-if="answer === '-1'"
      class="aspect-[63/88] text-5xl w-20 grid place-items-center border-2 rounded-sm border-dashed border-black"
    >
      <p class="rotate-[54deg] text-base text-center">Audience</p>
    </div>
    <RoomParticipantCard v-else :answer="answer" :is-open="props.isOpen" />
  </article>
</template>
