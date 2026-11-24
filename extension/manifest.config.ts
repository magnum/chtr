import { defineManifest } from '@crxjs/vite-plugin'
import packageJson from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'chtr',
  version: packageJson.version,
  description: 'Chatta con un Grok Bot nel pannello laterale.',
  minimum_chrome_version: '120',
  action: {
    default_title: 'Apri o chiudi chtr',
    default_icon: {
      16: 'public/icons/icon16.png',
      32: 'public/icons/icon32.png',
      48: 'public/icons/icon48.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  permissions: ['sidePanel', 'storage'],
  host_permissions: ['http://127.0.0.1/*', 'http://localhost/*'],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  icons: {
    16: 'public/icons/icon16.png',
    32: 'public/icons/icon32.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  commands: {
    _execute_action: {
      suggested_key: {
        default: 'Ctrl+Shift+Y',
        mac: 'Command+Shift+Y',
      },
      description: 'Apri o chiudi chtr',
    },
  },
})
