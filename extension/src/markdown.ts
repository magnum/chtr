import DOMPurify from 'dompurify'
import { marked } from 'marked'

let hooked = false

function ensureHook(): void {
  if (hooked) return
  hooked = true
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName !== 'A') return
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noreferrer')
  })
}

export function renderMarkdown(source: string): string {
  ensureHook()
  const parsed = marked.parse(source, { async: false, gfm: true, breaks: true })
  const html = typeof parsed === 'string' ? parsed : ''
  return DOMPurify.sanitize(html)
}
