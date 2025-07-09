<script setup lang="ts">
import { computed } from 'vue';
import { RoomForClient } from '@/backend/type';
import RoomParticipantCard from './RoomParticipantCard.vue';

const props = defineProps<{
  participant: RoomForClient['participants'][number];
  isOpen: boolean;
  allAnswersMatch?: boolean;
}>();
const answer = computed(() => {
  if (props.participant.isAudience) return '';
  if (props.participant.answer === '') return '';
  if (props.isOpen) return props.participant.answer;
  return '?';
});
</script>
<template>
  <article class="w-32 flex flex-col-reverse items-center">
    <h3 class="m-1 w-full truncate">{{ participant.name }}</h3>
    <div
      v-if="participant.isAudience"
      class="aspect-[63/88] text-5xl w-20 grid place-items-center border-2 rounded-sm border-dashed border-black bg-gray-100"
    >
      <p class="rotate-[54deg] text-base text-center">Audience</p>
    </div>
    <RoomParticipantCard
      v-else
      :answer="answer"
      :is-open="props.isOpen"
      :all-answers-match="props.allAnswersMatch || false"
    />
  </article>
</template>
