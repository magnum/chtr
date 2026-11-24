export function formatWhen(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (delta < minute) return 'now'
  if (delta < hour) return `${Math.floor(delta / minute)} min`
  if (delta < day) return `${Math.floor(delta / hour)} h`
  if (delta < 2 * day) return 'yesterday'
  if (delta < 7 * day) return `${Math.floor(delta / day)} d`
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(timestamp)
}

export function titleFromMessage(text: string): string {
  const line = text.trim().split('\n')[0] ?? ''
  const clean = line.replace(/\s+/g, ' ').trim()
  if (!clean) return 'New chat'
  if (clean.length <= 42) return clean
  return `${clean.slice(0, 41)}…`
}

export function previewText(text: string, max = 72): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return 'No messages'
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return `${key.slice(0, 4)}····${key.slice(-4)}`
}

export function shortcutLabel(): string {
  const apple = /\bMac|iPhone|iPad/.test(navigator.userAgent)
  return apple ? '⌘⇧Y' : 'Ctrl+Shift+Y'
}
