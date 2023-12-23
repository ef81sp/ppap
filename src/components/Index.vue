<script setup lang="ts">
import { watch } from "vue"
import { useRouter, useRoute } from "vue-router"
import { isMsgFromServer } from "../../wsMsg/msgFromServer"
import { genMsgCreateRoom } from "../../wsMsg/msgFromClient"
import { webSocket } from "../composables/webSocket"
import { user, setToken, setName, setRoomId } from "../composables/store"
import InputName from "./InputName.vue"

const { data, send } = webSocket
const router = useRouter()

const sendCreateRoom = (name: string) => {
  setName(name)
  send(JSON.stringify(genMsgCreateRoom(user.token.value, user.name.value)))
}

watch(data, (newData) => {
  const msg = JSON.parse(newData)
  if (!isMsgFromServer(msg)) return
  switch (msg.type) {
    case "connected": {
      setToken(msg.userToken)
      break
    }
    case "roomCreated": {
      setRoomId(msg.roomId)
      router.push(`/${msg.roomId}`)
      break
    }
    default:
      break
  }
})
</script>
<template>
  <h2>Index</h2>
  <InputName button-text="create room" @submit="sendCreateRoom" />
</template>
