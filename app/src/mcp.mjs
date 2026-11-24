const VERSIONS = new Set(['2024-11-05', '2025-03-26', '2025-06-18'])
const LIMIT = 20_000
const DEFAULT_WAIT_MS = 12_000

const TOOLS = [
  {
    name: 'run_javascript',
    description:
      'Runs JavaScript in the current browser window and returns the value of return. You can read and change that page DOM, for example document.body.innerText.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript run in the open page. The result is the return value.',
        },
      },
      required: ['code'],
    },
  },
]

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function commandKey(connectionId) {
  return `${connectionId}:command`
}

export async function waitForPage(store, connectionId, code, waitMs) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('Missing code.')
  if (code.length > LIMIT) throw new Error('Code is too long.')
  const id = crypto.randomUUID()
  const key = commandKey(connectionId)
  await store.setJSON(key, { id, code, status: 'pending' })
  const started = Date.now()
  while (Date.now() - started < waitMs) {
    await sleep(250)
    const current = await store.getJSON(key)
    if (!current || current.id !== id || current.status !== 'done') continue
    if (current.error) throw new Error(current.error)
    return typeof current.result === 'string' ? current.result : ''
  }
  const current = await store.getJSON(key)
  if (current?.id === id && current.status === 'pending') {
    await store.setJSON(key, { ...current, status: 'expired' })
  }
  throw new Error('The window did not respond. Keep the panel open on the page.')
}

async function callTool(params, store, connectionId, waitMs) {
  const name = params?.name
  if (name !== 'run_javascript') {
    return { content: [{ type: 'text', text: 'Unknown tool.' }], isError: true }
  }
  try {
    const text = await waitForPage(store, connectionId, params?.arguments?.code, waitMs)
    return { content: [{ type: 'text', text }] }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Could not run it.'
    return { content: [{ type: 'text', text }], isError: true }
  }
}

export async function handleMcp(body, store, connectionId, waitMs = DEFAULT_WAIT_MS) {
  if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return rpcError(null, -32600, 'Invalid request.')
  }
  if (body.id === undefined) return null

  const { id, method, params } = body
  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion
      return rpcResult(id, {
        protocolVersion: VERSIONS.has(requested) ? requested : '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'chtr', version: '0.1.0' },
      })
    }
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS })
    case 'tools/call':
      return rpcResult(id, await callTool(params, store, connectionId, waitMs))
    case 'ping':
      return rpcResult(id, {})
    default:
      return rpcError(id, -32601, 'Method not found.')
  }
}
