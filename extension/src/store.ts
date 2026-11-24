import { reactive } from 'vue'
import { titleFromMessage } from '@/format'
import { reportedFailure } from '@/evaluate'
import { allowActiveTab, runInActiveTab } from '@/page'
import { finishCommand, openChannel, postExtension, readBot, readCommand } from '@/proxy'
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
  const chats = (JSON.parse(JSON.stringify(store.chats)) as Chat[]).map((chat) => ({
    ...chat,
    messages: chat.messages.filter((message) => !message.id.startsWith('typing:')),
  }))
  return {
    chats,
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
      store.saveError = 'Can’t save chats in this browser.'
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
let commandTimer = 0
let polling = false
let commanding = false
let lastBotId = ''
const finishedCommands = new Set<string>()
const waiting = new Map<string, number>()

function typingId(chatId: string): string {
  return `typing:${chatId}`
}

function showTyping(chat: Chat): void {
  const id = typingId(chat.id)
  if (chat.messages.some((message) => message.id === id)) return
  chat.messages.push({
    id,
    role: 'assistant',
    content: '',
    createdAt: Date.now(),
    status: 'streaming',
  })
}

function hideTyping(chat: Chat): void {
  const id = typingId(chat.id)
  const index = chat.messages.findIndex((message) => message.id === id)
  if (index >= 0) chat.messages.splice(index, 1)
}

function beginWait(chat: Chat): void {
  waiting.set(chat.id, (waiting.get(chat.id) ?? 0) + 1)
  showTyping(chat)
}

function endWait(chat: Chat): void {
  const left = (waiting.get(chat.id) ?? 0) - 1
  if (left > 0) {
    waiting.set(chat.id, left)
    return
  }
  waiting.delete(chat.id)
  hideTyping(chat)
}

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
  endWait(chat)
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
    const incoming = await readBot(store.proxy, lastBotId)
    for (const item of incoming) {
      appendReply(item)
      lastBotId = item.id
    }
  } finally {
    polling = false
  }
}

async function pullCommand(): Promise<void> {
  if (!store.proxy || commanding) return
  commanding = true
  try {
    const command = await readCommand(store.proxy)
    if (!command || finishedCommands.has(command.id)) return
    finishedCommands.add(command.id)
    try {
      const result = await runInActiveTab(command.code)
      await finishCommand(store.proxy, command.id, { result })
    } catch (error) {
      await finishCommand(store.proxy, command.id, { error: reportedFailure(error) })
    }
  } finally {
    commanding = false
  }
}

function startPolling(): void {
  window.clearInterval(pollTimer)
  window.clearInterval(commandTimer)
  if (!store.proxy) return
  pollTimer = window.setInterval(() => {
    void pullReplies()
  }, 3000)
  commandTimer = window.setInterval(() => {
    void pullCommand()
  }, 1000)
  void pullReplies()
  void pullCommand()
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
    store.bootError = error instanceof Error ? error.message : 'Could not read the saved chats.'
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
    title: 'New chat',
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
  const proxy = await openChannel(baseUrl, token)
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
  lastBotId = ''
  window.clearInterval(pollTimer)
  window.clearInterval(commandTimer)
  await persist()
}

export function renameChat(id: string, title: string): void {
  const chat = findChat(id)
  if (!chat) return
  const next = title.trim() || 'New chat'
  if (next === chat.title) return
  chat.title = next
  chat.renamed = true
  void persist()
}

async function deliver(chat: Chat, content: string): Promise<void> {
  const proxy = store.proxy
  if (!proxy) {
    endWait(chat)
    return
  }
  try {
    try {
      await allowActiveTab()
    } catch {
      // The message still sends. The permission can be granted on the next try.
    }
    await postExtension(proxy, content, chat.id)
  } catch (error) {
    endWait(chat)
    chat.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: error instanceof Error ? error.message : 'The message did not send.',
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
  beginWait(chat)
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
  beginWait(chat)
  await deliver(chat, user.content)
}

export async function deleteChat(id: string): Promise<void> {
  waiting.delete(id)
  store.chats = store.chats.filter((chat) => chat.id !== id)
  if (store.activeChatId === id) {
    store.activeChatId = null
    store.view = 'list'
  }
  await persist()
}
