<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import backUrl from '@/assets/trading_card08_back_red.png';

const props = defineProps<{
  answer: string;
  isOpen: boolean;
  allAnswersMatch: boolean;
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
  <Transition
    mode="out-in"
    :name="props.allAnswersMatch ? 'card-match' : 'card'"
  >
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
/* 通常のアニメーション */
.card-enter-active,
.card-leave-active {
  transition: transform 0.3s ease;
}

.card-enter-from,
.card-leave-to {
  transform: rotateY(90deg);
}

/* 回答一致時の特別なアニメーション */
.card-match-enter-active,
.card-match-leave-active {
  transition: transform 0.5s linear;
}

.card-match-enter-from,
.card-match-leave-to {
  transform: rotateY(540deg); /* 5倍多く回転 (90deg × 6 = 540deg) */
}

.card-match-enter-active {
  animation: matchReveal 0.3s ease;
}

@keyframes matchReveal {
  /* 0% {
    transform: rotateY(450deg) scale(1);
  } */
  0% {
    transform: rotateY(0deg) scale(1);
  }
  70% {
    transform: rotateY(0deg) scale(1.15); /* 少し大きくなる */
  }
  100% {
    transform: rotateY(0deg) scale(1); /* 元のサイズに戻る */
  }
}
</style>
