<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowUpIcon, ChevronLeftIcon, TrashIcon } from '@heroicons/vue/24/outline'
import IconButton from '@/components/IconButton.vue'
import MessageItem from '@/components/MessageItem.vue'
import { deleteChat, renameChat, retryGeneration, sendMessage, showList, store } from '@/store'

const chat = computed(() => store.chats.find((item) => item.id === store.activeChatId) ?? null)
const draft = ref('')
const titleDraft = ref('')
const confirming = ref(false)
const stick = ref(true)
const scroller = ref<HTMLElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)

watch(
  () => chat.value?.title ?? '',
  (title) => {
    if (document.activeElement?.id === 'chat-title') return
    titleDraft.value = title
  },
  { immediate: true },
)

watch(
  () => {
    const current = chat.value
    if (!current) return ''
    const last = current.messages[current.messages.length - 1]
    return `${current.messages.length}:${last?.content.length ?? 0}:${last?.status ?? ''}`
  },
  async () => {
    await nextTick()
    const el = scroller.value
    if (!el || !stick.value) return
    el.scrollTop = el.scrollHeight
  },
)

onMounted(async () => {
  if (!chat.value) {
    showList()
    return
  }
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  composer.value?.focus()
})

function onScroll(): void {
  const el = scroller.value
  if (!el) return
  stick.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

function fitComposer(): void {
  const el = composer.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`
}

function commitTitle(): void {
  if (!chat.value) return
  renameChat(chat.value.id, titleDraft.value)
}

function submit(): void {
  if (!chat.value) return
  const text = draft.value
  if (!sendMessage(chat.value.id, text)) return
  draft.value = ''
  void nextTick(() => fitComposer())
}

function onComposerKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    submit()
  }
}

function isLastError(id: string): boolean {
  const last = chat.value?.messages[chat.value.messages.length - 1]
  return last?.id === id && last.status === 'error'
}

async function remove(): Promise<void> {
  if (!chat.value) return
  await deleteChat(chat.value.id)
}
</script>

<template>
  <section v-if="chat" class="flex min-h-0 flex-1 flex-col">
    <header class="shrink-0 border-b border-gray-200 px-2 pb-3 pt-3">
      <div class="flex items-center gap-1">
        <IconButton label="Torna alle chat" @click="showList()">
          <ChevronLeftIcon class="size-5" />
        </IconButton>
        <input
          id="chat-title"
          :value="titleDraft"
          maxlength="80"
          aria-label="Titolo chat"
          class="min-w-0 flex-1 bg-transparent text-base text-gray-900 outline-none"
          @input="titleDraft = ($event.target as HTMLInputElement).value"
          @change="commitTitle"
          @blur="commitTitle"
        />
        <IconButton label="Elimina chat" @click="confirming = !confirming">
          <TrashIcon class="size-5" />
        </IconButton>
      </div>
      <div v-if="confirming" class="mx-2 mt-3 flex items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2">
        <p class="text-base text-gray-900">Eliminare questa chat?</p>
        <div class="flex gap-2">
          <button type="button" class="text-base text-gray-500" @click="confirming = false">Annulla</button>
          <button type="button" class="text-base font-medium text-red-700" @click="remove">Elimina</button>
        </div>
      </div>
    </header>

    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      role="log"
      aria-label="Messaggi"
      @scroll="onScroll"
    >
      <div v-if="!chat.messages.length" class="py-6">
        <p class="text-base">Ciao.</p>
        <p class="mt-3 max-w-[18rem] text-base leading-relaxed text-gray-500">
          Il messaggio va sul canale di questa estensione. La risposta del Bot arriva sullo stesso canale.
          Invio manda il messaggio, Maiusc+Invio va a capo.
        </p>
      </div>
      <div v-else class="flex flex-col gap-4">
        <MessageItem
          v-for="message in chat.messages"
          :key="message.id"
          :message="message"
          :provider="chat.provider"
          :retryable="isLastError(message.id)"
          @retry="retryGeneration(chat.id)"
        />
      </div>
    </div>

    <footer class="shrink-0 border-t border-gray-200 px-3 py-3">
      <div class="flex items-end gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 focus-within:border-blue-600">
        <label class="sr-only" for="composer">Messaggio</label>
        <textarea
          id="composer"
          ref="composer"
          v-model="draft"
          rows="1"
          placeholder="Scrivi un messaggio"
          class="max-h-40 min-h-9 w-full resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-gray-400"
          @keydown="onComposerKey"
          @input="fitComposer"
        />
        <button
          type="button"
          aria-label="Invia"
          class="mb-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-blue-600 text-white disabled:opacity-40"
          :disabled="!draft.trim()"
          @click="submit"
        >
          <ArrowUpIcon class="size-4" />
        </button>
      </div>
    </footer>
  </section>
</template>
