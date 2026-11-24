import type { Chat, ChatMessage, MessageStatus, PersistedState, ProxyConfig } from '@/types'
import { isProviderId } from '@/providers'

const STORAGE_KEY = 'chtr.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function localArea(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null
  return chrome.storage.local
}

function normalizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null
  if (value.role !== 'user' && value.role !== 'assistant') return null
  if (typeof value.id !== 'string' || !value.id) return null
  if (typeof value.content !== 'string') return null

  let status: MessageStatus = 'complete'
  if (value.status === 'error') status = 'error'
  if (value.status === 'streaming') {
    if (!value.content.trim()) return null
    status = 'complete'
  }

  return {
    id: value.id,
    role: value.role,
    content: value.content,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    status,
  }
}

function normalizeChat(value: unknown): Chat | null {
  if (!isRecord(value)) return null
  if (!isProviderId(value.provider)) return null
  if (typeof value.id !== 'string' || !value.id) return null
  if (typeof value.model !== 'string' || !value.model) return null

  const messages = Array.isArray(value.messages)
    ? value.messages.flatMap((item) => {
        const message = normalizeMessage(item)
        return message ? [message] : []
      })
    : []

  const now = Date.now()
  const title = typeof value.title === 'string' ? value.title.trim() : ''

  return {
    id: value.id,
    provider: value.provider,
    model: value.model,
    title: title || 'New chat',
    renamed: value.renamed === true,
    messages,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  }
}

function normalizeChats(value: unknown): Chat[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const chats: Chat[] = []
  for (const item of value) {
    const chat = normalizeChat(item)
    if (!chat || seen.has(chat.id)) continue
    seen.add(chat.id)
    chats.push(chat)
  }
  return chats
}

function normalizeProxy(value: unknown): ProxyConfig | null {
  if (!isRecord(value)) return null
  if (typeof value.baseUrl !== 'string' || typeof value.token !== 'string' || typeof value.connectionId !== 'string') {
    return null
  }
  const baseUrl = value.baseUrl.trim().replace(/\/$/, '')
  const token = value.token.trim()
  const connectionId = value.connectionId.trim()
  if (!baseUrl || !token || !connectionId) return null
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return { baseUrl: url.origin, token, connectionId }
  } catch {
    return null
  }
}

function normalize(value: unknown): PersistedState {
  const record = isRecord(value) ? value : {}
  return {
    chats: normalizeChats(record.chats),
    proxy: normalizeProxy(record.proxy),
  }
}

export async function loadState(): Promise<PersistedState> {
  const area = localArea()
  if (area) {
    const stored = await area.get(STORAGE_KEY)
    return normalize(stored[STORAGE_KEY])
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalize(raw ? (JSON.parse(raw) as unknown) : null)
  } catch {
    return { chats: [], proxy: null }
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  const area = localArea()
  if (area) {
    await area.set({ [STORAGE_KEY]: state })
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
