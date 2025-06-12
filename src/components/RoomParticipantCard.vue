<script setup lang="ts">
import { computed } from 'vue';
import backUrl from '@/assets/trading_card08_back_red.png';

const props = defineProps<{
  answer: string;
  isOpen: boolean;
}>();
const answer = computed(() => {
  if (props.answer === '') return '';
  if (props.isOpen) return props.answer;
  return '?';
});
const status = computed(() => {
  if (props.answer === '') return 'empty';
  if (props.isOpen) return 'open';
  return 'reverse';
});

const cardClass = computed(() => {
  const common = 'aspect-[63/88] text-5xl w-20 grid place-items-center';
  switch (status.value) {
    case 'reverse':
      return common + ' ' + 'border-none';
    case 'open':
      return common + ' ' + 'border-4 rounded-sm border-solid border-slate-700';
    case 'empty':
      return common + ' ' + 'border-2 rounded-sm border-dashed border-black';
  }
});
</script>

<template>
  <Transition mode="out-in">
    <div :class="cardClass" v-if="status === 'reverse'">
      <img :src="backUrl" />
    </div>
    <div :class="cardClass" v-else-if="status === 'open'">
      <p>{{ answer }}</p>
    </div>
    <div :class="cardClass" v-else></div>
  </Transition>
</template>
<style scoped>
.v-enter-active,
.v-leave-active {
  @apply transition-transform;
}

.v-enter-from,
.v-leave-to {
  transform: rotateY(90deg);
}
</style>
