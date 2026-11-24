import type { ProxyConfig } from '@/types'

export interface ProxyMessage {
  id: string
  message: string
  chatId: string
}

function endpoint(proxy: ProxyConfig, path: 'extension' | 'bot', after = ''): string {
  const url = new URL(`${proxy.baseUrl}/webhook/${path}`)
  if (after) url.searchParams.set('after', after)
  return url.toString()
}

async function allowOrigin(baseUrl: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return
  const origin = `${new URL(baseUrl).origin}/*`
  const accepted = await chrome.permissions.request({ origins: [origin] })
  if (accepted) return
  const granted = await chrome.permissions.contains({ origins: [origin] })
  if (!granted) throw new Error('Permesso di rete negato per il proxy.')
}

export function parseProxy(baseUrl: string, token: string): ProxyConfig {
  const trimmedUrl = baseUrl.trim().replace(/\/$/, '')
  const trimmedToken = token.trim()
  if (!trimmedUrl || !trimmedToken) throw new Error('Servono l’indirizzo del proxy e la chiave.')
  let url: URL
  try {
    url = new URL(trimmedUrl)
  } catch {
    throw new Error('L’indirizzo del proxy non è valido.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('L’indirizzo del proxy deve essere http o https.')
  }
  return { baseUrl: url.origin, token: trimmedToken }
}

export async function connectProxy(proxy: ProxyConfig): Promise<void> {
  await allowOrigin(proxy.baseUrl)
  const response = await fetch(endpoint(proxy, 'bot'), {
    headers: { authorization: `Bearer ${proxy.token}` },
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('Il proxy ha rifiutato la chiave o non risponde.')
}

export async function postExtension(proxy: ProxyConfig, message: string, chatId: string): Promise<void> {
  const response = await fetch(endpoint(proxy, 'extension'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${proxy.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message, chatId }),
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok) throw new Error('Il proxy non ha accettato il messaggio.')
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

export function webhookUrls(proxy: ProxyConfig): { extension: string; bot: string } {
  return {
    extension: `${proxy.baseUrl}/webhook/extension`,
    bot: `${proxy.baseUrl}/webhook/bot`,
  }
}
