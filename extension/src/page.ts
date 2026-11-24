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
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (focused?.url && patternFor(focused.url)) return focused
  const tabs = await chrome.tabs.query({ active: true })
  return tabs.find((tab) => tab.url && patternFor(tab.url)) ?? null
}

export async function activePage(): Promise<{ url: string; title: string } | null> {
  const tab = await activeTab()
  if (!tab?.url || !patternFor(tab.url)) return null
  return { url: tab.url, title: tab.title ?? '' }
}

export async function allowActiveTab(): Promise<void> {
  const tab = await activeTab()
  const pattern = tab?.url ? patternFor(tab.url) : null
  if (!pattern || !chrome.permissions?.contains || !chrome.permissions.request) return
  const granted = await chrome.permissions.contains({ origins: [pattern] })
  if (granted) return
  await chrome.permissions.request({ origins: [pattern] })
}

interface RunResponse {
  ok?: boolean
  result?: unknown
  message?: unknown
  stack?: unknown
}

export async function runInActiveTab(code: string): Promise<string> {
  const response = (await chrome.runtime.sendMessage({ kind: 'run-javascript', code })) as RunResponse | undefined
  if (!response?.ok) {
    const error = new Error(typeof response?.message === 'string' ? response.message : 'Could not run it.')
    if (typeof response?.stack === 'string') error.stack = response.stack
    throw error
  }
  if (typeof response.result !== 'string') throw new Error('The window did not return a value.')
  return response.result
}
