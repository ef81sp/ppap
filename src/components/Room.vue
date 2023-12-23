<script setup lang="ts">
import { computed, watch } from "vue"
import { room, setName, setRoomId, user } from "../composables/store"
import { useRouter, useRoute } from "vue-router"

import InputName from "./InputName.vue"
import {
  sendAnswer,
  sendEnterTheRoom,
  sendClearAnswer,
} from "../composables/webSocket"
import RoomParticipant from "./RoomParticipant.vue"
import RoomAnswerButton from "./RoomAnswerButton.vue"

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
  <h2>Room</h2>
  <InputName
    v-if="step === 'name register'"
    button-text="enter the room"
    @submit="enterTheRoom"
  />
  <main v-else>
    <section>
      <!-- <p>{{ room }}</p> -->
      <p class="url">URL: {{ url }}</p>
      <button @click="copyUrl" class="button">copy URL</button>
    </section>
    <section class="card-area">
      <RoomParticipant
        v-for="p in room.participants"
        :key="p.userNumber"
        :participant="p"
        :is-open="room.isOpen"
      />
    </section>
    <section class="button-area">
      <div>
        <RoomAnswerButton
          v-for="option in answerOptions"
          :key="option"
          :option="option"
          @click="sendAnswer"
        />
      </div>
      <div>
        <button @click="sendClearAnswer" class="button">clear</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.url {
  font-size: 0.5rem;
}
.card-area {
  display: flex;
  align-items: center;
  justify-content: center;
}
.button {
  font-size: 1.25rem;
}
.button-area > * + *{
  margin-top: 1rem;
}
</style>
