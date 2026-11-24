import { getStore } from '@netlify/blobs'
import { handle } from '../../src/handler.mjs'

function blobStore() {
  const blobs = getStore('chtr')
  return {
    async getJSON(key) {
      return (await blobs.get(key, { type: 'json' })) ?? null
    },
    async setJSON(key, value) {
      await blobs.setJSON(key, value)
    },
  }
}

export default function webhook(request) {
  return handle(request, blobStore(), process.env)
}

export const config = {
  path: ['/webhook/in', '/webhook/out'],
}
