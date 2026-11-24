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
const pendingNote = computed(() => (store.pending ? 'After connecting, the new chat opens.' : ''))
const botPrompt = computed(() => {
  const proxy = store.proxy
  const current = urls.value
  if (!proxy || !current) return ''
  return [
    'Update the webhook routine for this chtr channel. If one already exists, edit it: do not create another.',
    '',
    'Each message from the extension arrives as JSON with these fields.',
    'message: the text the user wrote. Answer it in this chat, as if they typed it here. Reply in the same language as message.',
    'chatId: copy it unchanged into the reply you send to the extension.',
    'connectionId: identifies the channel. Do not change it.',
    `replyUrl: for this channel it is ${current.bot}. Post the reply to the extension here.`,
    `mcpUrl: for this channel it is ${current.mcp}. Run JavaScript in the open window here.`,
    'hint: a short reminder. These instructions are complete; do not rely on hint alone.',
    'page, when present: url and title of the active tab. It is not the page content.',
    '',
    'The message does not include the page content. If the user talks about the current window, what they are looking at, or an element on that page, call MCP before you answer. Do not say you cannot see the page.',
    '',
    'How to call MCP.',
    'POST to mcpUrl.',
    `Headers: Authorization: Bearer ${proxy.token} and Content-Type: application/json.`,
    'The body is JSON-RPC 2.0. The tool is run_javascript. Put the code in params.arguments.code. The result is the return value, in result.content[0].text. If result.isError is true, that text is the error, not the page content.',
    'Example for the visible text: {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"run_javascript","arguments":{"code":"return document.body.innerText.slice(0, 12000)"}}}.',
    'The code runs in the active browser tab, on its DOM. You can read and change that page: document, location, forms, buttons, comment threads. It does not run on the proxy.',
    'The extension panel must stay open on that page. If it is closed, the call reports that the window did not respond.',
    'Wait for the tool result before you write the answer. If you need only part of the page, narrow the return instead of reading the whole page again.',
    '',
    'How to reply to the extension.',
    'After you answer in chat, POST to replyUrl with the same headers.',
    'Body: {"message":"<the same answer>","chatId":"<the chatId you received, copied unchanged>"}.',
    'Do not call webhook/extension: messages reach you through this routine.',
    '',
    `Automatically allow only POSTs to ${current.bot} and ${current.mcp}.`,
    'Show me the updated routine card.',
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
    error.value = reason instanceof Error ? reason.message : 'Could not connect.'
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
    error.value = reason instanceof Error ? reason.message : 'Could not disconnect.'
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
      <IconButton label="Back" @click="closeConnect()">
        <ChevronLeftIcon class="size-5" />
      </IconButton>
      <h1>Proxy</h1>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
      <p class="text-base leading-relaxed text-gray-500">
        Each connection opens a channel. The extension writes to its webhook/extension and reads replies from its webhook/bot.
      </p>
      <p v-if="pendingNote" class="mt-3 rounded-md bg-gray-100 px-3 py-2 text-base text-gray-900">
        {{ pendingNote }}
      </p>

      <form v-if="replacing" class="mt-4 grid gap-3" @submit.prevent="submit">
        <label class="grid gap-1">
          <span class="text-base text-gray-500">Proxy address</span>
          <input
            v-model="draft.baseUrl"
            type="url"
            placeholder="https://chtr.netlify.app"
            required
            class="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-base outline-none placeholder:text-gray-400 focus:border-blue-600"
          />
        </label>
        <label class="grid gap-1">
          <span class="text-base text-gray-500">Key</span>
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
              {{ revealed ? 'Hide' : 'Show' }}
            </button>
          </div>
        </label>
        <div class="flex gap-2">
          <UiButton type="submit" :disabled="busy || !draft.baseUrl.trim() || !draft.token.trim()">
            {{ busy ? 'Checking…' : 'Connect' }}
          </UiButton>
          <UiButton v-if="store.proxy" type="button" variant="ghost" @click="replacing = false">Cancel</UiButton>
        </div>
      </form>

      <div v-else-if="store.proxy && urls" class="mt-4 grid gap-3">
        <p class="text-base text-gray-500">Key {{ maskKey(store.proxy.token) }}</p>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p class="text-base text-gray-500">webhook/extension</p>
          <p class="mt-1 break-all">{{ urls.extension }}</p>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(urls.extension, 'extension')">
            {{ copied === 'extension' ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p class="text-base text-gray-500">webhook/bot</p>
          <p class="mt-1 break-all">{{ urls.bot }}</p>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(urls.bot, 'bot')">
            {{ copied === 'bot' ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p class="text-base text-gray-500">webhook/bot/mcp</p>
          <p class="mt-1 break-all">{{ urls.mcp }}</p>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(urls.mcp, 'mcp')">
            {{ copied === 'mcp' ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <div>
          <div class="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p class="whitespace-pre-wrap wrap-break-word text-base leading-relaxed">{{ botPrompt }}</p>
          </div>
          <button type="button" class="mt-2 text-base text-blue-600" @click="copy(botPrompt, 'prompt')">
            {{ copied === 'prompt' ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p class="text-base leading-relaxed text-gray-500">
          Paste it into the Bot to update the routine. If you reconnect, the channel is new: copy the prompt again.
        </p>
        <div class="flex gap-2">
          <UiButton variant="ghost" @click="replacing = true">Replace</UiButton>
          <UiButton variant="danger" :disabled="busy" @click="disconnect">Disconnect</UiButton>
        </div>
      </div>

      <p v-if="error" class="mt-3 text-base text-red-700">{{ error }}</p>
    </div>
  </section>
</template>
