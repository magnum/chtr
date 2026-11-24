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

function bucketFrom(url) {
  if (url.pathname === '/webhook/in') return 'in'
  if (url.pathname === '/webhook/out') return 'out'
  return ''
}

function textOf(body) {
  if (!body || typeof body !== 'object') return ''
  if (typeof body.message === 'string') return body.message.trim()
  if (typeof body.text === 'string') return body.text.trim()
  return ''
}

async function forwardIn(env, item) {
  const target = env.BOT_WEBHOOK_URL ?? ''
  if (!target) return false
  const headers = new Headers({ 'content-type': 'application/json' })
  if (env.BOT_WEBHOOK_KEY) headers.set('authorization', `Bearer ${env.BOT_WEBHOOK_KEY}`)
  const response = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: item.message, chatId: item.chatId }),
  })
  return response.ok
}

export async function handle(request, store, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  const url = new URL(request.url)
  const bucket = bucketFrom(url)
  if (!bucket) return json({ error: 'Percorso sconosciuto.' }, 404)
  if (!env.PROXY_TOKEN) return json({ error: 'PROXY_TOKEN non configurato.' }, 500)
  if (!authorized(request, env)) return json({ error: 'Non autorizzato.' }, 401)

  if (request.method === 'GET') {
    const list = (await store.getJSON(bucket)) ?? []
    return json({ messages: since(list, url.searchParams.get('after') ?? '') })
  }

  if (request.method !== 'POST') return json({ error: 'Metodo non permesso.' }, 405)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'JSON non valido.' }, 400)
  }

  const message = textOf(body)
  if (!message) return json({ error: 'Manca il messaggio.' }, 400)

  const item = {
    id: crypto.randomUUID(),
    message,
    chatId: typeof body.chatId === 'string' ? body.chatId : '',
    at: Date.now(),
  }
  await push(store, bucket, item)

  if (bucket !== 'in') return json({ ok: true, id: item.id })

  try {
    const forwarded = await forwardIn(env, item)
    return json({ ok: true, id: item.id, forwarded })
  } catch {
    return json({ ok: true, id: item.id, forwarded: false })
  }
}
