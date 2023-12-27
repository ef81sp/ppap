<script setup lang="ts">
import { computed } from "vue"
import { room, setName, user } from "../composables/store"
import { useRoute } from "vue-router"

import InputName from "./InputName.vue"
import {
  sendAnswer,
  sendEnterTheRoom,
  sendClearAnswer,
} from "../composables/webSocket"
import RoomParticipant from "./RoomParticipant.vue"
import RoomAnswerButton from "./RoomAnswerButton.vue"
import VButton from "./VButton.vue"

const route = useRoute()

const step = computed(() => {
  if (user.name.value === "") {
    return "name register"
  }
  return "inside room"
})

const enterTheRoom = (userName: string) => {
  const roomId = route.params.roomId
  if (typeof roomId !== "string") return
  setName(userName)
  sendEnterTheRoom(roomId, userName)
}

const url = window.location.toString()
const copyUrl = () => {
  navigator.clipboard.writeText(url)
}

const answerOptions = ["1", "2", "3", "5", "8", "13", "21"]
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
      <p class="text-sm">{{ url }}</p>
      <VButton @click="copyUrl">copy URL</VButton>
    </section>
    <section class="flex justify-center items-center mt-8">
      <RoomParticipant
        v-for="p in room.participants"
        :key="p.userNumber"
        :participant="p"
        :is-open="room.isOpen"
      />
    </section>
    <section class="mt-8">
      <div class="mt-2 *:mx-1">
        <RoomAnswerButton
          v-for="option in answerOptions"
          :key="option"
          :option="option"
          @click="sendAnswer"
        />
      </div>
      <div class="mt-4">
        <VButton @click="sendClearAnswer">clear</VButton>
      </div>
    </section>
  </main>
</template>
