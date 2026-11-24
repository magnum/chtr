import { handleMcp } from './mcp.mjs'
import { since, push } from './queue.mjs'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  })
}

function authorized(request, env) {
  const token = env.PROXY_TOKEN ?? ''
  if (!token) return false
  const header = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${token}`
  if (header.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < header.length; i += 1) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

const CONNECTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function routeOf(url) {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length === 2 && parts[0] === 'webhook' && parts[1] === 'connect') return { kind: 'connect' }
  if (parts.length === 4 && parts[0] === 'webhook' && parts[1] === 'bot' && CONNECTION_ID.test(parts[2])) {
    if (parts[3] === 'mcp') return { kind: 'mcp', connectionId: parts[2].toLowerCase() }
    if (parts[3] === 'command') return { kind: 'command', connectionId: parts[2].toLowerCase() }
  }
  if (parts.length === 3 && parts[0] === 'webhook' && (parts[1] === 'extension' || parts[1] === 'bot')) {
    if (!CONNECTION_ID.test(parts[2])) return { kind: 'unknown' }
    return { kind: 'queue', side: parts[1], connectionId: parts[2].toLowerCase() }
  }
  return { kind: 'unknown' }
}

function textOf(body) {
  if (!body || typeof body !== 'object') return ''
  if (typeof body.message === 'string') return body.message.trim()
  if (typeof body.text === 'string') return body.text.trim()
  return ''
}

function pageOf(body) {
  const page = body?.page
  if (!page || typeof page !== 'object') return null
  const url = typeof page.url === 'string' ? page.url : ''
  const title = typeof page.title === 'string' ? page.title : ''
  if (!url && !title) return null
  return { url, title }
}

async function forwardIn(env, item, connectionId, origin, page) {
  const target = env.BOT_WEBHOOK_URL ?? ''
  if (!target) return false
  const headers = new Headers({ 'content-type': 'application/json' })
  if (env.BOT_WEBHOOK_KEY) headers.set('authorization', `Bearer ${env.BOT_WEBHOOK_KEY}`)
  const payload = {
    message: item.message,
    chatId: item.chatId,
    connectionId,
    replyUrl: `${origin}/webhook/bot/${connectionId}`,
    mcpUrl: `${origin}/webhook/bot/${connectionId}/mcp`,
    hint: 'mcpUrl runs JavaScript in the open browser window with the run_javascript tool.',
  }
  if (page) payload.page = page
  const response = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  return response.ok
}

export async function handle(request, store, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = new URL(request.url)
  const route = routeOf(url)
  if (route.kind === 'unknown') return json({ error: 'Unknown path.' }, 404)
  if (!env.PROXY_TOKEN) return json({ error: 'PROXY_TOKEN is not configured.' }, 500)
  if (!authorized(request, env)) return json({ error: 'Unauthorized.' }, 401)

  if (route.kind === 'connect') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    return json({ connectionId: crypto.randomUUID() })
  }

  if (route.kind === 'mcp') {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    let body
    try {
      body = await request.json()
    } catch {
      return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON.' } }, 400)
    }
    const waitMs = Number(env.COMMAND_WAIT_MS) || 12_000
    const result = await handleMcp(body, store, route.connectionId, waitMs)
    if (result === null) return new Response(null, { status: 202, headers: CORS })
    return json(result)
  }

  if (route.kind === 'command') {
    const key = `${route.connectionId}:command`
    if (request.method === 'GET') {
      const current = await store.getJSON(key)
      if (!current || current.status !== 'pending') return json({ command: null })
      return json({ command: { id: current.id, code: current.code } })
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
    let commandBody
    try {
      commandBody = await request.json()
    } catch {
      return json({ error: 'Invalid JSON.' }, 400)
    }
    if (!commandBody || typeof commandBody.id !== 'string') return json({ error: 'Missing command.' }, 400)
    const current = await store.getJSON(key)
    if (!current || current.id !== commandBody.id || current.status !== 'pending') {
      return json({ error: 'Comando non in corso.' }, 409)
    }
    const error = typeof commandBody.error === 'string' ? commandBody.error : ''
    const result = typeof commandBody.result === 'string' ? commandBody.result : ''
    if (!error && typeof commandBody.result !== 'string') return json({ error: 'Missing result.' }, 400)
    await store.setJSON(key, { ...current, status: 'done', result, error })
    return json({ ok: true })
  }

  const bucket = `${route.connectionId}:${route.side}`
  if (request.method === 'GET') {
    const list = (await store.getJSON(bucket)) ?? []
    return json({ messages: since(list, url.searchParams.get('after') ?? '') })
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }

  const message = textOf(body)
  if (!message) return json({ error: 'Missing message.' }, 400)

  const item = {
    id: crypto.randomUUID(),
    message,
    chatId: typeof body.chatId === 'string' ? body.chatId : '',
    at: Date.now(),
  }
  await push(store, bucket, item)

  if (route.side !== 'extension') return json({ ok: true, id: item.id })

  try {
    const forwarded = await forwardIn(env, item, route.connectionId, url.origin, pageOf(body))
    return json({ ok: true, id: item.id, forwarded })
  } catch {
    return json({ ok: true, id: item.id, forwarded: false })
  }
}
