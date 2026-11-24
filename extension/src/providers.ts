import type { ProviderId } from '@/types'

export interface ModelOption {
  id: string
  label: string
}

export interface ProviderInfo {
  id: ProviderId
  label: string
  vendor: string
  blurb: string
  keyUrl: string
  keyHint: string
  defaultModel: string
  models: ModelOption[]
}

export const providerOrder: ProviderId[] = ['grok']

export const providers: Record<ProviderId, ProviderInfo> = {
  grok: {
    id: 'grok',
    label: 'Grok',
    vendor: 'xAI',
    blurb: 'Messaggi attraverso il proxy.',
    keyUrl: 'https://docs.netlify.com/',
    keyHint: 'https://….netlify.app',
    defaultModel: 'grok-4.7',
    models: [
      { id: 'grok-4.7', label: 'Grok 4.7' },
      { id: 'grok-4.6', label: 'Grok 4.6' },
    ],
  },
}

export function accent(id: ProviderId): string {
  switch (id) {
    case 'grok':
      return '#3b82f6'
    default: {
      const neverId: never = id
      return neverId
    }
  }
}

export function providerInitial(id: ProviderId): string {
  switch (id) {
    case 'grok':
      return 'G'
    default: {
      const neverId: never = id
      return neverId
    }
  }
}

export function modelLabel(provider: ProviderId, modelId: string): string {
  return providers[provider].models.find((model) => model.id === modelId)?.label ?? modelId
}

export function isProviderId(value: unknown): value is ProviderId {
  return value === 'grok'
}
