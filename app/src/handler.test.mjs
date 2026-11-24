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
