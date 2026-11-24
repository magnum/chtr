<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ChevronLeftIcon } from '@heroicons/vue/24/outline'
import IconButton from '@/components/IconButton.vue'
import UiButton from '@/components/UiButton.vue'
import { maskKey } from '@/format'
import { webhookUrls } from '@/proxy'
import { closeConnect, connectProxySettings, disconnectProxy, store } from '@/store'

const draft = reactive({ baseUrl: store.proxy?.baseUrl ?? '', token: '' })
const replacing = ref(!store.proxy)
const busy = ref(false)
const error = ref('')
const revealed = ref(false)
const copied = ref('')

const urls = computed(() => (store.proxy ? webhookUrls(store.proxy) : null))
const pendingNote = computed(() => (store.pending ? 'Dopo il collegamento si apre la nuova chat.' : ''))

async function submit(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    await connectProxySettings(draft.baseUrl, draft.token)
    draft.token = ''
    replacing.value = false
    revealed.value = false
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Collegamento non riuscito.'
  } finally {
    busy.value = false
  }
}

async function disconnect(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    await disconnectProxy()
    replacing.value = true
    draft.baseUrl = ''
    draft.token = ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Scollegamento non riuscito.'
  } finally {
    busy.value = false
  }
}

async function copy(value: string, label: string): Promise<void> {
  await navigator.clipboard.writeText(value)
  copied.value = label
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col">
    <header class="flex items-center gap-2 px-2 pb-2 pt-3">
      <IconButton label="Torna indietro" @click="closeConnect()">
        <ChevronLeftIcon class="size-5" />
      </IconButton>
      <h1>Proxy</h1>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      <p class="leading-relaxed text-gray-400">
        L’estensione scrive su /webhook/extension. Il Bot scrive le risposte su /webhook/bot, e da lì il pannello le legge.
      </p>
      <p v-if="pendingNote" class="mt-3 rounded-md bg-gray-800 px-3 py-2 text-gray-100">
        {{ pendingNote }}
      </p>

      <form v-if="replacing" class="mt-4 grid gap-3" @submit.prevent="submit">
        <label class="grid gap-1">
          <span class="text-gray-400">Indirizzo del proxy</span>
          <input
            v-model="draft.baseUrl"
            type="url"
            placeholder="https://chtr.netlify.app"
            required
            class="rounded-md border border-gray-700 bg-gray-950 px-3 py-2.5 outline-none placeholder:text-gray-500 focus:border-blue-500"
          />
        </label>
        <label class="grid gap-1">
          <span class="text-gray-400">Chiave</span>
          <div class="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-950 px-3 focus-within:border-blue-500">
            <input
              v-model="draft.token"
              :type="revealed ? 'text' : 'password'"
              autocomplete="new-password"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              maxlength="400"
              required
              class="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
            />
            <button type="button" class="shrink-0 text-gray-400 hover:text-gray-100" @click="revealed = !revealed">
              {{ revealed ? 'Nascondi' : 'Mostra' }}
            </button>
          </div>
        </label>
        <div class="flex gap-2">
          <UiButton type="submit" :disabled="busy || !draft.baseUrl.trim() || !draft.token.trim()">
            {{ busy ? 'Verifica…' : 'Collega' }}
          </UiButton>
          <UiButton v-if="store.proxy" type="button" variant="ghost" @click="replacing = false">Annulla</UiButton>
        </div>
      </form>

      <div v-else-if="store.proxy && urls" class="mt-4 grid gap-3">
        <p class="text-gray-400">Chiave {{ maskKey(store.proxy.token) }}</p>
        <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
          <p class="text-gray-400">webhook/extension</p>
          <p class="mt-1 break-all">{{ urls.extension }}</p>
          <button type="button" class="mt-2 text-blue-400" @click="copy(urls.extension, 'extension')">
            {{ copied === 'extension' ? 'Copiato' : 'Copia' }}
          </button>
        </div>
        <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
          <p class="text-gray-400">webhook/bot</p>
          <p class="mt-1 break-all">{{ urls.bot }}</p>
          <button type="button" class="mt-2 text-blue-400" @click="copy(urls.bot, 'bot')">
            {{ copied === 'bot' ? 'Copiato' : 'Copia' }}
          </button>
        </div>
        <p class="leading-relaxed text-gray-400">
          Il proxy inoltra i messaggi dell’estensione al webhook della routine. Il Bot manda ogni risposta su webhook/bot, con Authorization: Bearer e la chiave del proxy.
        </p>
        <div class="flex gap-2">
          <UiButton variant="ghost" @click="replacing = true">Sostituisci</UiButton>
          <UiButton variant="danger" :disabled="busy" @click="disconnect">Scollega</UiButton>
        </div>
      </div>

      <p v-if="error" class="mt-3 text-red-400">{{ error }}</p>
    </div>
  </section>
</template>
