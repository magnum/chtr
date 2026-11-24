export type ProviderId = 'grok'

export type View = 'list' | 'chat' | 'connect'

export type MessageRole = 'user' | 'assistant'

export type MessageStatus = 'complete' | 'error' | 'streaming'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: number
  status: MessageStatus
}

export interface Chat {
  id: string
  provider: ProviderId
  model: string
  title: string
  renamed: boolean
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export interface PendingChat {
  provider: ProviderId
  model: string
}

export interface ProxyConfig {
  baseUrl: string
  token: string
}

export interface PersistedState {
  chats: Chat[]
  proxy: ProxyConfig | null
}
