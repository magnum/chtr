# chtr

Two folders.

- `extension` is the Chrome side panel.
- `app` is the proxy to publish on Netlify. It holds messages between the panel and a Grok Bot.

## Extension

```bash
cd extension
npm install
npm run dev
```

In Chrome, Edge, or Brave: `chrome://extensions`, developer mode, load the `extension/dist` folder. Leave `npm run dev` running.

Suggested shortcut: `⌘⇧Y` on Mac, `Ctrl+Shift+Y` elsewhere.

In the panel, set the Netlify site address and the proxy key. On connect, the proxy assigns a `connection_id` and the panel saves it. It shows the channel URLs:

- `webhook/extension/<connection_id>`, where the panel writes
- `webhook/bot/<connection_id>`, where the Bot writes replies and the panel reads them

A new connection opens a new channel. In that case, give the Bot the new `webhook/bot`.

`webhook/bot/<connection_id>/mcp` is an MCP server. The `run_javascript` tool runs JavaScript in the open browser window: the result is the value of `return`. The panel must stay open on that page. The key goes in the `Authorization: Bearer` header.

## Proxy

```bash
cd app
npm install
```

On Netlify the base directory is `app`. Generate the key with `npm run token` and set it as the `PROXY_TOKEN` variable. To also forward an extension message to the Bot routine webhook, add `BOT_WEBHOOK_URL` and, if needed, `BOT_WEBHOOK_KEY`.
