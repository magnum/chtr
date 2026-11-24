import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { defineConfig, type Plugin } from 'vite'
import manifest from './manifest.config'

function stripDuplicateViteClient(): Plugin {
  return {
    name: 'strip-duplicate-vite-client',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const marker = '<script type="module" src="/@vite/client"></script>'
        const first = html.indexOf(marker)
        if (first < 0) return html
        const second = html.indexOf(marker, first + marker.length)
        if (second < 0) return html
        return `${html.slice(0, second)}${html.slice(second + marker.length)}`
      },
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), vue(), crx({ manifest }), stripDuplicateViteClient()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
})
