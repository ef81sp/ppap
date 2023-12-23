<script setup lang="ts">
import { computed, watch } from "vue"
import { user, room, setToken, setName, setRoomId } from "../composables/store"
import InputName from "./InputName.vue"
import { useRouter, useRoute } from "vue-router"

const route = useRoute()

const step = computed(() => {
  if (user.name.value === "") {
    return "name register"
  }
  if (room.id.value === "") {
    return "enter room"
  }
  return "inside room"
})
watch(step, (newStep, oldStep) => {
  if (oldStep === "name register" && newStep === "enter room") {
    const roomId = route.path
    setRoomId(roomId)
  }
})

const enterTheRoom = () => {}
</script>

<template>
  <h2>Room</h2>
  <InputName
    v-if="step === 'name register'"
    button-text="enter the room"
    @submit="enterTheRoom"
  />
</template>
