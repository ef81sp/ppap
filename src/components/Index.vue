<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { user, setToken, setName, setRoom } from '@/composables/store'; // ストア関数をインポート
import VButton from './VButton.vue';
import { CreateRoomRequest, CreateRoomResponse, Room } from '@/backend/type'; // APIの型定義をインポート

const roomName = ref('');
const userName = ref(user.name.value); // ストアの初期値を設定
const router = useRouter();

const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

const handleCreateRoom = async () => {
  if (!userName.value.trim()) {
    errorMessage.value = 'User name is required.';
    return;
  }
  isLoading.value = true;
  errorMessage.value = null;

  try {
    const requestBody: CreateRoomRequest = {
      userName: userName.value.trim(),
    };
    if (roomName.value.trim()) {
      requestBody.roomName = roomName.value.trim();
    }

    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Failed to create room. Please try again.' }));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    const data: CreateRoomResponse = await response.json();

    // ストアを更新
    setName(userName.value.trim());
    setToken(data.userToken);
    setRoom(data.room); // APIから返されたRoomオブジェクトをそのままストアにセット

    sessionStorage.setItem('roomId', data.roomId); // 再入室用にroomIdを保存
    sessionStorage.setItem('userToken', data.userToken); // 再入室用にuserTokenを保存

    // ルームページに遷移
    router.push(`/${data.roomId}`);
  } catch (error) {
    console.error('Error creating room:', error);
    errorMessage.value =
      error instanceof Error ? error.message : 'An unknown error occurred.';
  } finally {
    isLoading.value = false;
  }
};
</script>
<template>
  <div class="create-room-container p-4 max-w-md mx-auto">
    <h2 class="text-2xl font-bold mb-4 text-center">Create New Room</h2>
    <form @submit.prevent="handleCreateRoom" class="space-y-4">
      <div>
        <label for="userName" class="block text-sm font-medium text-gray-700"
          >Your Name *</label
        >
        <input
          type="text"
          id="userName"
          v-model="userName"
          required
          placeholder="Enter your name"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label for="roomName" class="block text-sm font-medium text-gray-700"
          >Room Name (Optional)</label
        >
        <input
          type="text"
          id="roomName"
          v-model="roomName"
          placeholder="Enter room name (e.g., Project Alpha Meeting)"
          class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <VButton type="submit" :disabled="isLoading" class="w-full">
        {{ isLoading ? 'Creating...' : 'Create Room' }}
      </VButton>
      <p v-if="errorMessage" class="text-red-500 text-sm mt-2 text-center">
        {{ errorMessage }}
      </p>
    </form>
  </div>
</template>
