import { evaluationExpression, pageTimeoutMs, reportedFailure, textFromEvaluation, type EvaluationResult } from '@/evaluate'

function patternFor(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return `${parsed.origin}/*`
  } catch {
    return null
  }
}

async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (focused?.url && patternFor(focused.url)) return focused
  const tabs = await chrome.tabs.query({ active: true })
  return tabs.find((tab) => tab.url && patternFor(tab.url)) ?? null
}

function attachFailure(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Could not attach to the window.'
  if (/another debugger is already attached/i.test(message)) {
    return new Error('Another debugger is already attached to this tab. Close DevTools and try again.')
  }
  return error instanceof Error ? error : new Error(message)
}

function sendCommand(tabId: number, method: string, params?: { [key: string]: unknown }): Promise<EvaluationResult> {
  return chrome.debugger.sendCommand({ tabId }, method, params) as Promise<EvaluationResult>
}

function withPageTimeout(tabId: number, work: Promise<EvaluationResult>): Promise<EvaluationResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      void sendCommand(tabId, 'Runtime.terminateExecution').catch(() => undefined)
      reject(new Error('The window did not respond. Keep the panel open on the page.'))
    }, pageTimeoutMs())
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error('Could not run it.'))
      },
    )
  })
}

export async function runInActiveTab(code: string): Promise<string> {
  if (!chrome.debugger?.attach || !chrome.debugger.sendCommand) {
    throw new Error('The panel cannot run code in the window. Reload the extension and allow the debugger permission.')
  }
  const tab = await activeTab()
  if (!tab?.id || !tab.url || !patternFor(tab.url)) throw new Error('No active window to read.')
  const target = { tabId: tab.id }
  let attached = false
  try {
    await chrome.debugger.attach(target, '1.3')
    attached = true
    const evaluation = await withPageTimeout(
      tab.id,
      sendCommand(tab.id, 'Runtime.evaluate', {
        expression: evaluationExpression(code),
        awaitPromise: true,
        returnByValue: true,
      }),
    )
    return textFromEvaluation(evaluation).slice(0, 20_000)
  } catch (error) {
    if (!attached) throw attachFailure(error)
    throw error
  } finally {
    if (attached) await chrome.debugger.detach(target).catch(() => undefined)
  }
}

export function failureBody(error: unknown): { ok: false; message: string; stack: string } {
  const reported = reportedFailure(error)
  const message = error instanceof Error ? error.message : reported
  return { ok: false, message, stack: reported }
}
