import { failureBody, runInActiveTab } from '@/background/run'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
  console.error('chtr could not attach the side panel', error)
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || message.kind !== 'run-javascript' || typeof message.code !== 'string') {
    return
  }
  runInActiveTab(message.code).then(
    (result) => sendResponse({ ok: true, result }),
    (error: unknown) => sendResponse(failureBody(error)),
  )
  return true
})
