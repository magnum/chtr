import { reactive } from 'vue'
import { titleFromMessage } from '@/format'
import { connectProxy, parseProxy, postIn, readOut } from '@/proxy'
import { loadState, saveState } from '@/storage'
import type { Chat, ChatMessage, PendingChat, ProviderId, ProxyConfig, View } from '@/types'

interface StoreState {
  ready: boolean
  bootError: string
  saveError: string
  view: View
  returnView: View
  activeChatId: string | null
  focusProvider: ProviderId | null
  pending: PendingChat | null
  chats: Chat[]
  proxy: ProxyConfig | null
}

export const store = reactive<StoreState>({
  ready: false,
  bootError: '',
  saveError: '',
  view: 'list',
  returnView: 'list',
  activeChatId: null,
  focusProvider: null,
  pending: null,
  chats: [],
  proxy: null,
})

let started = false
let saveQueue: Promise<void> = Promise.resolve()
let saveTimer = 0

function findChat(id: string): Chat | undefined {
  return store.chats.find((chat) => chat.id === id)
}

function snapshot(): { chats: Chat[]; proxy: ProxyConfig | null } {
  return {
    chats: JSON.parse(JSON.stringify(store.chats)) as Chat[],
    proxy: store.proxy ? { ...store.proxy } : null,
  }
}

export function persist(): Promise<void> {
  const data = snapshot()
  saveQueue = saveQueue
    .then(() => saveState(data))
    .then(() => {
      store.saveError = ''
    })
    .catch(() => {
      store.saveError = 'Non riesco a salvare le chat su questo browser.'
    })
  return saveQueue
}

function scheduleSave(): void {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void persist()
  }, 250)
}

let pollTimer = 0
let polling = false
let lastOutId = ''

function knownIds(): Set<string> {
  const ids = new Set<string>()
  for (const chat of store.chats) {
    for (const message of chat.messages) ids.add(message.id)
  }
  return ids
}

function appendReply(item: { id: string; message: string; chatId: string }): void {
  if (knownIds().has(item.id)) return
  const chat = findChat(item.chatId) ?? findChat(store.activeChatId ?? '') ?? store.chats[0]
  if (!chat) return
  const message: ChatMessage = {
    id: item.id,
    role: 'assistant',
    content: item.message,
    createdAt: Date.now(),
    status: 'complete',
  }
  chat.messages.push(message)
  chat.updatedAt = Date.now()
  scheduleSave()
}

async function pullReplies(): Promise<void> {
  if (!store.proxy || polling) return
  polling = true
  try {
    const incoming = await readOut(store.proxy, lastOutId)
    for (const item of incoming) {
      appendReply(item)
      lastOutId = item.id
    }
  } finally {
    polling = false
  }
}

function startPolling(): void {
  window.clearInterval(pollTimer)
  if (!store.proxy) return
  pollTimer = window.setInterval(() => {
    void pullReplies()
  }, 3000)
  void pullReplies()
}

export async function initStore(): Promise<void> {
  if (started) return
  started = true
  window.addEventListener('pagehide', () => {
    void persist()
  })

  try {
    const state = await loadState()
    store.chats = state.chats
    store.proxy = state.proxy
    startPolling()
  } catch (error) {
    store.bootError = error instanceof Error ? error.message : 'Impossibile leggere le chat salvate.'
  } finally {
    store.ready = true
  }
}

export function openConnect(focus?: ProviderId): void {
  if (store.view !== 'connect') store.returnView = store.view
  store.focusProvider = focus ?? null
  store.view = 'connect'
}

export function closeConnect(): void {
  store.pending = null
  store.focusProvider = null
  store.view = store.returnView === 'connect' ? 'list' : store.returnView
}

export function showList(): void {
  store.view = 'list'
}

export function openChat(id: string): void {
  if (!findChat(id)) return
  store.activeChatId = id
  store.view = 'chat'
}

export function createChat(provider: ProviderId, model: string): void {
  const now = Date.now()
  const chat: Chat = {
    id: crypto.randomUUID(),
    provider,
    model,
    title: 'Nuova chat',
    renamed: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  store.chats.unshift(chat)
  store.activeChatId = chat.id
  store.view = 'chat'
  void persist()
}

export function requestChat(provider: ProviderId, model: string): void {
  if (!store.proxy) {
    store.pending = { provider, model }
    openConnect(provider)
    return
  }
  createChat(provider, model)
}

export async function connectProxySettings(baseUrl: string, token: string): Promise<void> {
  const proxy = parseProxy(baseUrl, token)
  await connectProxy(proxy)
  store.proxy = proxy
  await persist()
  startPolling()
  if (store.pending) {
    const pending = store.pending
    store.pending = null
    createChat(pending.provider, pending.model)
  }
}

export async function disconnectProxy(): Promise<void> {
  store.proxy = null
  store.pending = null
  lastOutId = ''
  window.clearInterval(pollTimer)
  await persist()
}

export function renameChat(id: string, title: string): void {
  const chat = findChat(id)
  if (!chat) return
  const next = title.trim() || 'Nuova chat'
  if (next === chat.title) return
  chat.title = next
  chat.renamed = true
  void persist()
}

async function deliver(chat: Chat, content: string): Promise<void> {
  const proxy = store.proxy
  if (!proxy) return
  try {
    await postIn(proxy, content, chat.id)
  } catch (error) {
    chat.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: error instanceof Error ? error.message : 'Il messaggio non è partito.',
      createdAt: Date.now(),
      status: 'error',
    })
    scheduleSave()
  }
}

export function sendMessage(chatId: string, text: string): boolean {
  const chat = findChat(chatId)
  const content = text.trim()
  if (!chat || !content) return false
  if (!store.proxy) {
    openConnect(chat.provider)
    return false
  }
  if (!chat.renamed) chat.title = titleFromMessage(content)
  chat.messages.push({
    id: crypto.randomUUID(),
    role: 'user',
    content,
    createdAt: Date.now(),
    status: 'complete',
  })
  chat.updatedAt = Date.now()
  void persist()
  void deliver(chat, content)
  return true
}

export async function retryGeneration(chatId: string): Promise<void> {
  const chat = findChat(chatId)
  if (!chat) return
  if (!store.proxy) {
    openConnect(chat.provider)
    return
  }
  const last = chat.messages[chat.messages.length - 1]
  if (last?.role === 'assistant' && last.status === 'error') chat.messages.pop()
  const user = [...chat.messages].reverse().find((message) => message.role === 'user' && message.content.trim())
  if (!user) return
  await deliver(chat, user.content)
}

export async function deleteChat(id: string): Promise<void> {
  store.chats = store.chats.filter((chat) => chat.id !== id)
  if (store.activeChatId === id) {
    store.activeChatId = null
    store.view = 'list'
  }
  await persist()
}
