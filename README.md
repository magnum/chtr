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

Nel pannello imposta l’indirizzo del sito Netlify e la chiave del proxy. Al collegamento il proxy assegna un `connection_id` e il pannello lo salva. Ti mostra due URL di quel canale:

- `webhook/extension/<connection_id>`, dove il pannello scrive
- `webhook/bot/<connection_id>`, dove il Bot scrive le risposte e da dove il pannello le legge

Un nuovo collegamento apre un canale nuovo. In quel caso dai al Bot il nuovo `webhook/bot`.

La chiave va nell’intestazione `Authorization: Bearer`.

## Proxy

```bash
cd app
npm install
```

Su Netlify la cartella di pubblicazione è `app`. Genera la chiave con `npm run token` e impostala come variabile `PROXY_TOKEN`. Se vuoi che un messaggio dell’estensione venga anche inoltrato al webhook della routine del Bot, aggiungi `BOT_WEBHOOK_URL` e, se serve, `BOT_WEBHOOK_KEY`.
