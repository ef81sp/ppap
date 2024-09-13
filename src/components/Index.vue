<script setup lang="ts">
import { sendCreateRoom } from "@/src/composables/webSocket"
import InputName from "./InputName.vue"
</script>
<template>
  <h2>Create Room</h2>
  <InputName button-text="create room" @submit="sendCreateRoom" />
</template>
