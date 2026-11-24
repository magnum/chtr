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
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return tab ?? null
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

function present(value: unknown): string {
  if (typeof value === 'undefined') return 'undefined'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export async function runInActiveTab(code: string): Promise<string> {
  if (!chrome.scripting?.executeScript) throw new Error('The panel cannot read the window.')
  const tab = await activeTab()
  const pattern = tab?.url ? patternFor(tab.url) : null
  if (!tab?.id || !pattern) throw new Error('No active window to read.')
  const granted = chrome.permissions?.contains ? await chrome.permissions.contains({ origins: [pattern] }) : false
  if (!granted) throw new Error('Permission denied for the current window. Send a message from that page and accept the permission.')
  try {
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (source: string) => {
        const run = new Function(`"use strict";\nreturn (async () => {\n${source}\n})();`) as () => Promise<unknown>
        return run()
      },
      args: [code],
    })
    return present(injected?.result).slice(0, 20_000)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not run it.')
  }
}
