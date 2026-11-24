import vm from 'node:vm'

const VERSIONS = new Set(['2024-11-05', '2025-03-26', '2025-06-18'])
const LIMIT = 20_000
const TIMEOUT_MS = 1000

const TOOLS = [
  {
    name: 'run_javascript',
    description:
      'Esegue JavaScript sul proxy e restituisce il valore di return. Non ha rete, file né variabili d’ambiente.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Codice JavaScript. Il risultato è il valore di return.',
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

function present(value) {
  if (typeof value === 'undefined') return 'undefined'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export async function runJavaScript(code) {
  if (typeof code !== 'string' || !code.trim()) throw new Error('Manca il codice.')
  if (code.length > LIMIT) throw new Error('Codice troppo lungo.')
  const sandbox = vm.createContext({
    Math,
    JSON,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  })
  const script = new vm.Script(`"use strict"; (async () => {\n${code}\n})()`, { filename: 'chtr.js' })
  let timer
  try {
    return present(
      await Promise.race([
        Promise.resolve(script.runInContext(sandbox, { timeout: TIMEOUT_MS })),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Tempo scaduto.')), TIMEOUT_MS)
        }),
      ]),
    )
  } finally {
    clearTimeout(timer)
  }
}

async function callTool(params) {
  const name = params?.name
  if (name !== 'run_javascript') {
    return { content: [{ type: 'text', text: 'Strumento sconosciuto.' }], isError: true }
  }
  try {
    const text = await runJavaScript(params?.arguments?.code)
    return { content: [{ type: 'text', text }] }
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Esecuzione non riuscita.'
    return { content: [{ type: 'text', text }], isError: true }
  }
}

export async function handleMcp(body) {
  if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return rpcError(null, -32600, 'Richiesta non valida.')
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
      return rpcResult(id, await callTool(params))
    case 'ping':
      return rpcResult(id, {})
    default:
      return rpcError(id, -32601, 'Metodo non trovato.')
  }
}
