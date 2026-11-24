chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
  console.error('chtr non riesce a collegare il pannello laterale', error)
})
