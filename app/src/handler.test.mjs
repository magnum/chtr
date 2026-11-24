import assert from 'node:assert/strict'
import test from 'node:test'
import { handle } from './handler.mjs'

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

test('rifiuta una chiave diversa', async () => {
  const response = await handle(
    new Request('https://proxy.test/webhook/bot', { method: 'GET' }),
    memory(),
    env,
  )
  assert.equal(response.status, 401)
})

test('conserva un messaggio dell’estensione e lo rilegge', async () => {
  const store = memory()
  const posted = await handle(
    new Request('https://proxy.test/webhook/extension', {
      method: 'POST',
      headers: { authorization: 'Bearer segreto', 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'ciao', chatId: 'chat-1' }),
    }),
    store,
    env,
  )
  assert.equal(posted.status, 200)
  const saved = await posted.json()
  const listed = await handle(
    new Request(`https://proxy.test/webhook/extension?after=${saved.id}`, {
      headers: { authorization: 'Bearer segreto' },
    }),
    store,
    env,
  )
  const page = await listed.json()
  assert.deepEqual(page.messages, [])
  const all = await handle(
    new Request('https://proxy.test/webhook/extension', { headers: { authorization: 'Bearer segreto' } }),
    store,
    env,
  )
  const messages = (await all.json()).messages
  assert.equal(messages.length, 1)
  assert.equal(messages[0].message, 'ciao')
  assert.equal(messages[0].chatId, 'chat-1')
})

test('i messaggi del Bot non si mescolano con quelli dell’estensione', async () => {
  const store = memory()
  await handle(
    new Request('https://proxy.test/webhook/bot', {
      method: 'POST',
      headers: { authorization: 'Bearer segreto', 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'risposta' }),
    }),
    store,
    env,
  )
  const incoming = await handle(
    new Request('https://proxy.test/webhook/extension', { headers: { authorization: 'Bearer segreto' } }),
    store,
    env,
  )
  assert.deepEqual((await incoming.json()).messages, [])
})
