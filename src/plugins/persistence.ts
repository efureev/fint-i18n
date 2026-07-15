import type { FintI18n, FintI18nPlugin } from '../core'

export interface PersistenceOptions {
  key?: string
  storage?: Storage
  syncTabs?: boolean
}

export class PersistencePlugin implements FintI18nPlugin {
  public name = 'persistence'
  private options: PersistenceOptions
  private offLocaleChange?: () => void
  private storageListener?: (event: StorageEvent) => void

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

    if (!storage || typeof storage.getItem !== 'function') return

    // Значение из storage могло устареть или быть подменено —
    // принимаем только локали, известные из зарегистрированных лоадеров.
    const isValidLocale = (value: string | null): value is string => {
      if (!value) return false
      const known = i18n.getKnownLocales()
      return known.length === 0 || known.includes(value)
    }

    // Load initial locale
    const saved = storage.getItem(storageKey)
    if (isValidLocale(saved) && saved !== i18n.locale.value) {
      void i18n.setLocale(saved)
    }

    // Save on change
    this.offLocaleChange = i18n.hooks.on('onLocaleChange', ({ locale }) => {
      storage.setItem(storageKey, locale)
    })

    // Sync tabs
    if (this.options.syncTabs && typeof window !== 'undefined') {
      this.storageListener = (event: StorageEvent) => {
        if (event.key === storageKey && isValidLocale(event.newValue) && event.newValue !== i18n.locale.value) {
          void i18n.setLocale(event.newValue)
        }
      }
      window.addEventListener('storage', this.storageListener)
    }
  }

  uninstall() {
    this.offLocaleChange?.()
    this.offLocaleChange = undefined

    if (this.storageListener && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.storageListener)
      this.storageListener = undefined
    }
  }
}
