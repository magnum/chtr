# chtr

Due cartelle.

- `extension` è il pannello laterale di Chrome.
- `app` è il proxy da pubblicare su Netlify. Tiene i messaggi fra il pannello e un Grok Bot.

## Estensione

```bash
cd extension
npm install
npm run dev
```

In Chrome, Edge o Brave: `chrome://extensions`, modalità sviluppatore, carica la cartella `extension/dist`. Lascia `npm run dev` acceso.

Scorciatoia suggerita: `⌘⇧Y` su Mac, `Ctrl+Shift+Y` altrove.

Nel pannello imposta l’indirizzo del sito Netlify e la chiave del proxy. Ti mostra due URL:

- `webhook_in`, dove il pannello scrive e da dove il Bot può leggere
- `webhook_out`, dove il Bot scrive le sue risposte

La chiave va nell’intestazione `Authorization: Bearer`.

## Proxy

```bash
cd app
npm install
```

Su Netlify la cartella di pubblicazione è `app`. Genera la chiave con `npm run token` e impostala come variabile `PROXY_TOKEN`. Se vuoi che un messaggio in ingresso venga anche inoltrato al webhook ufficiale del Bot, aggiungi `BOT_WEBHOOK_URL` e, se serve, `BOT_WEBHOOK_KEY`.
