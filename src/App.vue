<script setup lang="ts">
import { room, user } from "./composables/store"
import { webSocket } from "./composables/webSocket"
</script>

<template>
  <p style="font-size: 0.5rem;">userToken: {{ user.token }}</p>
  <RouterView />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
