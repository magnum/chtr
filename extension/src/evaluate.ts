export interface EvaluationFrame {
  functionName?: string
  url?: string
  lineNumber?: number
  columnNumber?: number
}

export interface EvaluationResult {
  result?: {
    type?: string
    value?: unknown
    description?: string
    unserializableValue?: string
  }
  exceptionDetails?: {
    text?: string
    exception?: { description?: string }
    stackTrace?: { callFrames?: EvaluationFrame[] }
  }
}

const PAGE_TIMEOUT_MS = 5_000

export function pageTimeoutMs(): number {
  return PAGE_TIMEOUT_MS
}

export function evaluationExpression(code: string): string {
  return `(async () => {\n${code}\n})()`
}

export function present(value: unknown): string {
  if (typeof value === 'undefined') return 'undefined'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function reportedFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'Could not run it.'
  const stack = error.stack?.trim()
  if (!stack) return error.message
  if (stack === error.message || stack.startsWith(error.message)) return stack
  return `${error.message}\n${stack}`
}

function frameLine(frame: EvaluationFrame): string {
  const name = frame.functionName || '<anonymous>'
  const line = (frame.lineNumber ?? 0) + 1
  const column = (frame.columnNumber ?? 0) + 1
  return `    at ${name} (${frame.url || '<anonymous>'}:${line}:${column})`
}

function evaluationError(details: NonNullable<EvaluationResult['exceptionDetails']>): Error {
  const description = details.exception?.description?.trim() || ''
  const message = description.split('\n')[0] || details.text || 'Evaluation failed.'
  const frames = (details.stackTrace?.callFrames ?? []).map(frameLine).join('\n')
  const stack = description.includes('\n') ? description : frames ? `${message}\n${frames}` : message
  const error = new Error(message)
  error.stack = stack
  return error
}

export function textFromEvaluation(evaluation: EvaluationResult): string {
  if (evaluation.exceptionDetails) throw evaluationError(evaluation.exceptionDetails)
  const remote = evaluation.result
  if (!remote) throw new Error('The window did not return a value.')
  if (remote.unserializableValue) return remote.unserializableValue
  if (remote.type === 'undefined') return 'undefined'
  if ('value' in remote) return present(remote.value)
  if (remote.description) return remote.description
  throw new Error('The return value could not be serialized.')
}
