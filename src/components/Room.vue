<script setup lang="ts">
import { computed, onMounted, watch } from "vue"
import { room, setName, user } from "../composables/store"
import { useRoute } from "vue-router"

import InputName from "./InputName.vue"
import {
  sendAnswer,
  sendEnterTheRoom,
  sendClearAnswer,
  isRoomCreator,
} from "../composables/webSocket"
import RoomParticipant from "./RoomParticipant.vue"
import RoomAnswerButton from "./RoomAnswerButton.vue"
import VButton from "./VButton.vue"
import router from "../router/router"

const route = useRoute()

const step = computed(() => {
  if (user.name.value === "") {
    return "name register"
  }
  return "inside room"
})

watch(
  user.token,
  (token) => {
    if (token === "") return
    // トークン取得後、セッションストレージに名前が残っていたら、その名前で入室する(再入室)
    const roomId = route.params.roomId
    if (typeof roomId !== "string") return
    const userName = sessionStorage.getItem("userName")
    if (userName) {
      enterTheRoom(userName)
    }
  },
  { once: true }
)

const enterTheRoom = (userName: string) => {
  const roomId = route.params.roomId
  if (typeof roomId !== "string") return
  setName(userName)
  sendEnterTheRoom(roomId, userName)
  sessionStorage.setItem("roomId", roomId)
  sessionStorage.setItem("userName", user.name.value)
}

const url = window.location.toString()
const copyUrl = () => {
  navigator.clipboard.writeText(url)
}

const answerOptions = ["1", "2", "3", "5", "8", "13", "21"]
const selectingAnswer = computed<string>(
  () => room.value.participants.find((p) => p.isMe)?.answer || ""
)

const exit = () => {
  sessionStorage.removeItem("roomId")
  sessionStorage.removeItem("userName")
  window.location.href = "/"
}
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
    <section class="flex justify-center items-center mt-8">
      <RoomParticipant
        v-for="p in room.participants"
        :key="p.userNumber"
        :participant="p"
        :is-open="room.isOpen"
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
        <VButton @click="sendClearAnswer" class="w-16">clear</VButton>
      </div>
      <div class="mt-16">
        <VButton @click="exit" class="w-16">exit</VButton>
      </div>
    </section>
  </main>
</template>
