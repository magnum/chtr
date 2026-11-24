import { activePage } from '@/page'
import type { ProxyConfig } from '@/types'

export interface ProxyMessage {
  id: string
  message: string
  chatId: string
}

function endpoint(proxy: ProxyConfig, path: 'extension' | 'bot', after = ''): string {
  const url = new URL(`${proxy.baseUrl}/webhook/${path}/${proxy.connectionId}`)
  if (after) url.searchParams.set('after', after)
  return url.toString()
}

async function allowOrigin(baseUrl: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return
  const origin = `${new URL(baseUrl).origin}/*`
  const accepted = await chrome.permissions.request({ origins: [origin] })
  if (accepted) return
  const granted = await chrome.permissions.contains({ origins: [origin] })
  if (!granted) throw new Error('Network permission denied for the proxy.')
}

export function parseProxy(baseUrl: string, token: string): Omit<ProxyConfig, 'connectionId'> {
  const trimmedUrl = baseUrl.trim().replace(/\/$/, '')
  const trimmedToken = token.trim()
  if (!trimmedUrl || !trimmedToken) throw new Error('The proxy address and the key are required.')
  let url: URL
  try {
    url = new URL(trimmedUrl)
  } catch {
    throw new Error('The proxy address is not valid.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The proxy address must be http or https.')
  }
  return { baseUrl: url.origin, token: trimmedToken }
}

export async function openChannel(baseUrl: string, token: string): Promise<ProxyConfig> {
  const parsed = parseProxy(baseUrl, token)
  await allowOrigin(parsed.baseUrl)
  const response = await fetch(`${parsed.baseUrl}/webhook/connect`, {
    method: 'POST',
    headers: { authorization: `Bearer ${parsed.token}` },
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('The proxy rejected the key or did not respond.')
  const body = (await response.json()) as { connectionId?: unknown }
  if (typeof body.connectionId !== 'string' || !body.connectionId.trim()) {
    throw new Error('The proxy did not assign a channel.')
  }
  const proxy = { ...parsed, connectionId: body.connectionId.trim() }
  await connectProxy(proxy)
  return proxy
}

export async function connectProxy(proxy: ProxyConfig): Promise<void> {
  await allowOrigin(proxy.baseUrl)
  const response = await fetch(endpoint(proxy, 'bot'), {
    headers: { authorization: `Bearer ${proxy.token}` },
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('The proxy rejected the key or did not respond.')
}

export async function postExtension(proxy: ProxyConfig, message: string, chatId: string): Promise<void> {
  const page = await activePage()
  const payload: { message: string; chatId: string; page?: { url: string; title: string } } = { message, chatId }
  if (page) payload.page = page
  const response = await fetch(endpoint(proxy, 'extension'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${proxy.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('The proxy did not accept the message.')
}

export interface PageCommand {
  id: string
  code: string
}

export async function readCommand(proxy: ProxyConfig): Promise<PageCommand | null> {
  const response = await fetch(`${proxy.baseUrl}/webhook/bot/${proxy.connectionId}/command`, {
    headers: { authorization: `Bearer ${proxy.token}` },
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) return null
  const body = (await response.json()) as { command?: unknown }
  const command = body.command
  if (!command || typeof command !== 'object') return null
  const record = command as { id?: unknown; code?: unknown }
  if (typeof record.id !== 'string' || typeof record.code !== 'string') return null
  return { id: record.id, code: record.code }
}

export async function finishCommand(
  proxy: ProxyConfig,
  id: string,
  outcome: { result?: string; error?: string },
): Promise<void> {
  const response = await fetch(`${proxy.baseUrl}/webhook/bot/${proxy.connectionId}/command`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${proxy.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ id, ...outcome }),
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok && response.status !== 409) throw new Error('The proxy did not accept the result.')
}

export async function readBot(proxy: ProxyConfig, after: string): Promise<ProxyMessage[]> {
  const response = await fetch(endpoint(proxy, 'bot', after), {
    headers: { authorization: `Bearer ${proxy.token}` },
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) return []
  const body = (await response.json()) as { messages?: unknown }
  if (!Array.isArray(body.messages)) return []
  return body.messages.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as { id?: unknown; message?: unknown; chatId?: unknown }
    if (typeof record.id !== 'string' || typeof record.message !== 'string') return []
    return [{ id: record.id, message: record.message, chatId: typeof record.chatId === 'string' ? record.chatId : '' }]
  })
}

export function webhookUrls(proxy: ProxyConfig): { extension: string; bot: string; mcp: string } {
  return {
    extension: `${proxy.baseUrl}/webhook/extension/${proxy.connectionId}`,
    bot: `${proxy.baseUrl}/webhook/bot/${proxy.connectionId}`,
    mcp: `${proxy.baseUrl}/webhook/bot/${proxy.connectionId}/mcp`,
  }
}
