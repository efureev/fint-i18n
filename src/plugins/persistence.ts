import type { FintI18n, FintI18nPlugin } from '@/core'

export interface PersistenceOptions {
  key?: string
  storage?: Storage
  syncTabs?: boolean
}

export class PersistencePlugin implements FintI18nPlugin {
  public name = 'persistence'
  private options: PersistenceOptions

  constructor(options: PersistenceOptions = {}) {
    this.options = {
      key: 'fint-i18n-locale',
      syncTabs: true,
      ...options
    }
  }

  install(i18n: FintI18n) {
    const storageKey = this.options.key!
    const storage = this.options.storage || (typeof window !== 'undefined' ? window.localStorage : undefined)
    
    if (!storage) return

    // Load initial locale
    const saved = storage.getItem(storageKey)
    if (saved) {
      i18n.locale.value = saved
    }

    // Save on change
    i18n.hooks.on('onLocaleChange', ({ locale }) => {
      storage.setItem(storageKey, locale)
    })

    // Sync tabs
    if (this.options.syncTabs && typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === storageKey && event.newValue && event.newValue !== i18n.locale.value) {
          i18n.locale.value = event.newValue
        }
      })
    }
  }
}

