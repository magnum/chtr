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
const botPrompt = computed(() => {
  const proxy = store.proxy
  const current = urls.value
  if (!proxy || !current) return ''
  return [
    'Aggiorna la routine webhook di questo canale chtr. Se ne esiste già una, modificala: non crearne un’altra.',
    '',
    'Quando arriva il webhook, il JSON ha message, chatId, connectionId e replyUrl.',
    'Rispondi a message in questa chat, come se te lo avessi scritto qui.',
    `Poi fai una POST a replyUrl, che per questo canale è ${current.bot}.`,
    `Intestazioni: Authorization: Bearer ${proxy.token} e Content-Type: application/json.`,
    'Corpo: {"message":"<la stessa risposta>","chatId":"<il chatId ricevuto, copiato così com’è>"}.',
    'Non chiamare webhook/extension: i messaggi ti arrivano da questa routine.',
    '',
    `Per eseguire JavaScript fai una POST a ${current.mcp} con la stessa Authorization.`,
    'È JSON-RPC. Lo strumento è run_javascript, il codice va in arguments.code e il risultato è il valore di return.',
    'Esempio: {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"run_javascript","arguments":{"code":"return 1 + 2"}}}.',
    'Il codice gira sul proxy: niente rete, file o variabili d’ambiente, e si ferma dopo un secondo.',
    '',
    `Autorizza in automatico solo le POST verso ${current.bot} e ${current.mcp}.`,
    'Mostrami la scheda aggiornata della routine.',
  ].join('\n')
})

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
      <p class="text-base leading-relaxed text-gray-500">
        Ogni collegamento apre un canale. L’estensione scrive sul suo webhook/extension e legge le risposte dal suo webhook/bot.
      </p>
      <p v-if="pendingNote" class="mt-3 rounded-md bg-gray-100 px-3 py-2 text-base text-gray-900">
        {{ pendingNote }}
      </p>

      <form v-if="replacing" class="mt-4 grid gap-3" @submit.prevent="submit">
        <label class="grid gap-1">
          <span class="text-base text-gray-500">Indirizzo del proxy</span>
          <input
            v-model="draft.baseUrl"
            type="url"
            placeholder="https://chtr.netlify.app"
            required
            class="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base outline-none placeholder:text-gray-400 focus:border-blue-600"
          />
        </label>
        <label class="grid gap-1">
          <span class="text-base text-gray-500">Chiave</span>
          <div class="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 focus-within:border-blue-600">
            <input
              v-model="draft.token"
              :type="revealed ? 'text' : 'password'"
              autocomplete="new-password"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              maxlength="400"
              required
              class="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none"
            />
            <button type="button" class="shrink-0 text-base text-gray-500 hover:text-gray-900" @click="revealed = !revealed">
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
        <p class="text-base text-gray-500">Chiave {{ maskKey(store.proxy.token) }}</p>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p class="text-base text-gray-500">webhook/extension</p>
          <p class="mt-1 break-all">{{ urls.extension }}</p>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(urls.extension, 'extension')">
            {{ copied === 'extension' ? 'Copiato' : 'Copia' }}
          </button>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p class="text-base text-gray-500">webhook/bot</p>
          <p class="mt-1 break-all">{{ urls.bot }}</p>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(urls.bot, 'bot')">
            {{ copied === 'bot' ? 'Copiato' : 'Copia' }}
          </button>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p class="text-base text-gray-500">webhook/bot/mcp</p>
          <p class="mt-1 break-all">{{ urls.mcp }}</p>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(urls.mcp, 'mcp')">
            {{ copied === 'mcp' ? 'Copiato' : 'Copia' }}
          </button>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p class="text-base text-gray-500">Prompt per il Bot</p>
          <p class="mt-2 whitespace-pre-wrap wrap-break-word text-base leading-relaxed">{{ botPrompt }}</p>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(botPrompt, 'prompt')">
            {{ copied === 'prompt' ? 'Copiato' : 'Copia' }}
          </button>
        </div>
        <p class="text-base leading-relaxed text-gray-500">
          Incollalo nel Bot per aggiornare la routine. Se ricolleghi, il canale è nuovo: copia di nuovo il prompt.
        </p>
        <div class="flex gap-2">
          <UiButton variant="ghost" @click="replacing = true">Sostituisci</UiButton>
          <UiButton variant="danger" :disabled="busy" @click="disconnect">Scollega</UiButton>
        </div>
      </div>

      <p v-if="error" class="mt-3 text-base text-red-700">{{ error }}</p>
    </div>
  </section>
</template>
