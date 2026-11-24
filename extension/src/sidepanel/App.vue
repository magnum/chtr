<script setup lang="ts">
import { onMounted } from 'vue'
import ChatList from '@/components/ChatList.vue'
import ChatThread from '@/components/ChatThread.vue'
import ConnectView from '@/components/ConnectView.vue'
import { initStore, store } from '@/store'

onMounted(() => {
  void initStore()
})
</script>

<template>
  <div class="shell flex h-dvh flex-col text-gray-100">
    <p v-if="!store.ready" class="m-auto text-gray-400">Apro le chat…</p>
    <p v-else-if="store.bootError" class="m-auto max-w-xs px-6 text-center text-gray-400">
      {{ store.bootError }}
    </p>
    <ChatList v-else-if="store.view === 'list'" />
    <ChatThread v-else-if="store.view === 'chat'" :key="store.activeChatId ?? 'chat'" />
    <ConnectView v-else-if="store.view === 'connect'" />
  </div>
</template>
