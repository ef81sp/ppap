<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { room, setName, user, setRoom, setToken } from '../composables/store'; // src/ を削除
import { useRoute, useRouter } from 'vue-router';

import InputName from './InputName.vue';
import RoomParticipant from './RoomParticipant.vue';
import RoomAnswerButton from './RoomAnswerButton.vue';
import VButton from './VButton.vue';
import { joinRoomApi, rejoinRoomApi } from '../fetchApi';

const route = useRoute();
const router = useRouter();

const step = computed(() => {
  if (user.name.value === '') {
    return 'name register';
  }
  return 'inside room';
});

const enterTheRoom = async (userName: string) => {
  const roomId = route.params.roomId;
  if (typeof roomId !== 'string') return;
  setName(userName);
  try {
    const res = await joinRoomApi(roomId, { userName });
    setRoom(res.room);
    user.token.value = res.userToken;
    sessionStorage.setItem('roomId', roomId);
    sessionStorage.setItem('userName', userName);
    sessionStorage.setItem('userToken', res.userToken);
  } catch (e) {
    alert('ルーム参加に失敗しました');
    return;
  }
};

const tryRejoinRoom = async () => {
  const roomId = route.params.roomId;
  const userToken = sessionStorage.getItem('userToken');
  if (typeof roomId !== 'string' || !userToken) return false;
  try {
    const res = await rejoinRoomApi(roomId, { userToken });
    setRoom(res.room);
    setName(res.userName);
    setToken(res.userToken);
    sessionStorage.setItem('roomId', roomId);
    sessionStorage.setItem('userToken', res.userToken);
    sessionStorage.setItem('userName', res.userName);
    return true;
  } catch (e) {
    // 404など
    sessionStorage.clear();
    router.push('/');
    return false;
  }
};

// ページロード時にrejoinを試みる
tryRejoinRoom();

const url = window.location.toString();
const copyUrl = () => {
  navigator.clipboard.writeText(url);
};

const answerOptions = ['1', '2', '3', '5', '8', '13', '21'];
const selectingAnswer = computed<string>(() => {
  if (!room.value) return '';
  const me = room.value.participants.find(p => p.isMe);
  return me ? me.answer : '';
});

const exit = async () => {
  const roomId = route.params.roomId;
  const userToken = sessionStorage.getItem('userToken');
  if (typeof roomId === 'string' && userToken) {
    try {
      const res = await fetch(`/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userToken }),
      });
      if (!res.ok) {
        // エラー時はそのままクリアして遷移
        console.error('退室APIエラー', await res.text());
      }
    } catch (e) {
      console.error('退室API通信エラー', e);
    }
  }
  sessionStorage.clear();
  router.push('/');
};
</script>

<template>
  <h2 class="text-3xl">Room</h2>
  <InputName
    v-if="step === 'name register'"
    button-text="enter the room"
    @submit="enterTheRoom"
  />
  <main v-else class="my-4">
    <section>
      <VButton @click="copyUrl">copy URL</VButton>
    </section>
    <section class="flex justify-center flex-wrap items-center mt-8 gap-y-4">
      <RoomParticipant
        v-for="p in room && room.participants"
        :key="p.userNumber"
        :participant="p"
        :is-open="room && room.isOpen"
      />
    </section>
    <section class="mt-8">
      <div class="mt-2 *:mx-1 *:my-3">
        <RoomAnswerButton
          v-for="option in answerOptions"
          :key="option"
          :option="option"
          :is-selected="option === selectingAnswer"
          @click="sendAnswer"
        />
      </div>
      <div class="mt-4">
        <input type="checkbox" v-model="isAudience" id="is-audience" />
        <label for="is-audience" class="ml-2">I'm an audience.</label>
      </div>
      <div class="mt-4">
        <VButton @click="sendClearAnswer" class="w-16">clear</VButton>
      </div>
      <div class="mt-16">
        <VButton @click="exit" class="w-16">exit</VButton>
      </div>
    </section>
  </main>
</template>
