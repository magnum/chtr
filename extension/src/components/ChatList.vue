<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChatBubbleBottomCenterIcon, UserIcon } from '@heroicons/vue/24/outline'
import IconButton from '@/components/IconButton.vue'
import UiButton from '@/components/UiButton.vue'
import { formatWhen, previewText, shortcutLabel } from '@/format'
import { accent, providerInitial } from '@/providers'
import { openChat, openConnect, requestChat, store } from '@/store'
import type { Chat } from '@/types'

const query = ref('')
const shortcut = shortcutLabel()

const connected = computed(() => Boolean(store.proxy))

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return store.chats
    .filter((chat) => {
      if (!needle) return true
      const preview = lastPreview(chat).toLowerCase()
      return chat.title.toLowerCase().includes(needle) || preview.includes(needle)
    })
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
})

function lastPreview(chat: Chat): string {
  const last = [...chat.messages].reverse().find((message) => message.content.trim())
  return previewText(last?.content ?? '')
}
</script>

<template>
  <section class="relative flex min-h-0 flex-1 flex-col">
    <header class="shrink-0 px-4 pb-3 pt-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2">
          <ChatBubbleBottomCenterIcon class="size-6 shrink-0" />
          <div>
            <h1 class="text-base font-medium">chtr</h1>
            <p class="mt-1 text-base text-gray-500">Grok</p>
          </div>
        </div>
        <IconButton label="Proxy settings" @click="openConnect()">
          <UserIcon class="size-5" />
        </IconButton>
      </div>
    </header>

    <div class="shrink-0 px-4">
      <UiButton class="w-full" @click="requestChat('grok', 'grok')">New chat</UiButton>
    </div>

    <p v-if="store.saveError" class="mx-4 mt-3 rounded-md bg-red-50 px-3 py-2 text-base text-red-700">
      {{ store.saveError }}
    </p>

    <label v-if="store.chats.length > 3" class="mx-4 mt-3 block shrink-0">
      <span class="sr-only">Search chats</span>
      <input
        v-model="query"
        type="search"
        placeholder="Search"
        class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base outline-none placeholder:text-gray-400 focus:border-blue-600"
      />
    </label>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div v-if="!store.chats.length" class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center">
        <p class="text-base">No chats</p>
        <p class="mx-auto mt-3 max-w-[16rem] text-base leading-relaxed text-gray-500">
          Start a conversation with Grok without leaving the page.
        </p>
        <UiButton v-if="!connected" class="mt-4" variant="ghost" @click="openConnect()">
          Connect Grok
        </UiButton>
      </div>

      <p v-else-if="!visible.length" class="px-1 py-6 text-center text-base text-gray-500">
        No matching chats.
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li v-for="chat in visible" :key="chat.id">
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-3 text-left text-base hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            @click="openChat(chat.id)"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-md  font-semibold text-white"
              :style="{ background: accent(chat.provider) }"
            >
              {{ providerInitial(chat.provider) }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate font-medium">{{ chat.title }}</span>
                <span class="shrink-0 text-base text-gray-500">{{ formatWhen(chat.updatedAt) }}</span>
              </span>
              <span class="mt-0.5 block truncate text-base text-gray-500">
                {{ lastPreview(chat) || 'No messages' }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>

    <footer class="shrink-0 px-4 pb-3 text-center text-base text-gray-500">
      {{ shortcut }} opens and closes the panel
    </footer>

  </section>
</template>
