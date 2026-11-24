<script setup lang="ts">
import MessageBody from '@/components/MessageBody.vue'
import { accent } from '@/providers'
import type { ChatMessage, ProviderId } from '@/types'

defineProps<{
  message: ChatMessage
  provider: ProviderId
  retryable: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div v-if="message.role === 'user'" class="flex justify-end">
    <p class="max-w-[88%] whitespace-pre-wrap rounded-md bg-gray-800 px-3 py-2 leading-relaxed [overflow-wrap:anywhere]">
      {{ message.content }}
    </p>
  </div>

  <div v-else-if="message.status === 'error'" class="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2.5">
    <p class="leading-relaxed text-gray-100 [overflow-wrap:anywhere]">{{ message.content }}</p>
    <button
      v-if="retryable"
      type="button"
      class="mt-2 font-medium text-blue-400 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      @click="emit('retry')"
    >
      Riprova
    </button>
  </div>

  <div v-else class="border-l-2 pl-3" :style="{ borderColor: accent(provider) }">
    <div
      v-if="message.status === 'streaming' && !message.content"
      class="typing"
      aria-label="Sta scrivendo"
    >
      <i /><i /><i />
    </div>
    <MessageBody v-else :source="message.content" />
  </div>
</template>
