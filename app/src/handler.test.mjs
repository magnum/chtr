import assert from 'node:assert/strict'
import test from 'node:test'
import { handle } from './handler.mjs'

const CHANNEL = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

function memory() {
  const data = new Map()
  return {
    async getJSON(key) {
      return data.has(key) ? data.get(key) : null
    },
    async setJSON(key, value) {
      data.set(key, value)
    },
  }
}

const env = { PROXY_TOKEN: 'segreto' }
const auth = { authorization: 'Bearer segreto' }

function channel(side, id = CHANNEL) {
  return `https://proxy.test/webhook/${side}/${id}`
}

test('rifiuta una chiave diversa', async () => {
  const response = await handle(new Request(channel('bot'), { method: 'GET' }), memory(), env)
  assert.equal(response.status, 401)
})

test('assegna un connection id', async () => {
  const response = await handle(
    new Request('https://proxy.test/webhook/connect', { method: 'POST', headers: auth }),
    memory(),
    env,
  )
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.match(body.connectionId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
})

test('conserva un messaggio dell’estensione e lo rilegge', async () => {
  const store = memory()
  const posted = await handle(
    new Request(channel('extension'), {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'ciao', chatId: 'chat-1' }),
    }),
    store,
    env,
  )
  assert.equal(posted.status, 200)
  const saved = await posted.json()
  const listed = await handle(
    new Request(`${channel('extension')}?after=${saved.id}`, { headers: auth }),
    store,
    env,
  )
  const page = await listed.json()
  assert.deepEqual(page.messages, [])
  const all = await handle(new Request(channel('extension'), { headers: auth }), store, env)
  const messages = (await all.json()).messages
  assert.equal(messages.length, 1)
  assert.equal(messages[0].message, 'ciao')
  assert.equal(messages[0].chatId, 'chat-1')
})

test('i messaggi del Bot non si mescolano con quelli dell’estensione', async () => {
  const store = memory()
  await handle(
    new Request(channel('bot'), {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'risposta' }),
    }),
    store,
    env,
  )
  const incoming = await handle(new Request(channel('extension'), { headers: auth }), store, env)
  assert.deepEqual((await incoming.json()).messages, [])
})

function mcpRequest(method, params, id = 1) {
  return new Request(`https://proxy.test/webhook/bot/${CHANNEL}/mcp`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
}

test('mcp elenca run_javascript e restituisce il risultato della finestra', async () => {
  const store = memory()
  const listed = await handle(mcpRequest('tools/list'), store, env)
  assert.equal(listed.status, 200)
  const tools = (await listed.json()).result.tools
  assert.equal(tools[0].name, 'run_javascript')
  assert.match(tools[0].description, /current browser window/)

  const pending = handle(
    mcpRequest('tools/call', {
      name: 'run_javascript',
      arguments: { code: 'return document.title' },
    }),
    store,
    { ...env, COMMAND_WAIT_MS: '3000' },
  )
  let command = null
  for (let i = 0; i < 20 && !command; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const response = await handle(new Request(`https://proxy.test/webhook/bot/${CHANNEL}/command`, { headers: auth }), store, env)
    command = (await response.json()).command
  }
  assert.equal(command.code, 'return document.title')
  const done = await handle(
    new Request(`https://proxy.test/webhook/bot/${CHANNEL}/command`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ id: command.id, result: 'Todo Basecamp' }),
    }),
    store,
    env,
  )
  assert.equal(done.status, 200)
  const body = await (await pending).json()
  assert.equal(body.result.isError, undefined)
  assert.equal(body.result.content[0].text, 'Todo Basecamp')
})

test('mcp segnala la finestra assente e rifiuta una chiave diversa', async () => {
  const called = await handle(
    mcpRequest('tools/call', {
      name: 'run_javascript',
      arguments: { code: 'return document.body.innerText' },
    }),
    memory(),
    { ...env, COMMAND_WAIT_MS: '400' },
  )
  const body = await called.json()
  assert.equal(body.result.isError, true)
  assert.match(body.result.content[0].text, /did not respond/)

  const denied = await handle(
    new Request(`https://proxy.test/webhook/bot/${CHANNEL}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'run_javascript', arguments: { code: 'return 1' } },
      }),
    }),
    memory(),
    env,
  )
  assert.equal(denied.status, 401)
})

test('inoltra al Bot il suggerimento per leggere la finestra', async () => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init.body })
    return new Response('', { status: 200 })
  }
  try {
    const response = await handle(
      new Request(channel('extension'), {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'riassumi il todo',
          chatId: 'chat-1',
          page: { url: 'https://basecamp.example/todo', title: 'Todo' },
        }),
      }),
      memory(),
      { ...env, BOT_WEBHOOK_URL: 'https://bot.test/hook', BOT_WEBHOOK_KEY: 'chiave-routine' },
    )
    assert.equal(response.status, 200)
  } finally {
    globalThis.fetch = original
  }
  const body = JSON.parse(calls[0].body)
  assert.equal(body.page.url, 'https://basecamp.example/todo')
  assert.equal(body.page.title, 'Todo')
  assert.match(body.mcpUrl, /\/mcp$/)
  assert.equal(body.hint, 'mcpUrl runs JavaScript in the open browser window with the run_javascript tool.')
  assert.match(body.replyUrl, /\/webhook\/bot\//)
})

test('due canali non condividono i messaggi', async () => {
  const store = memory()
  await handle(
    new Request(channel('extension', OTHER), {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'altro utente' }),
    }),
    store,
    env,
  )
  const mine = await handle(new Request(channel('extension'), { headers: auth }), store, env)
  assert.deepEqual((await mine.json()).messages, [])
})
