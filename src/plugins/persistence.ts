import type { FintI18n, FintI18nPlugin, Locale } from '../core'

export interface PersistenceOptions {
  key?: string
  storage?: Storage
  syncTabs?: boolean
  /**
   * Локали, которые разрешено восстанавливать из хранилища.
   *
   * Нужна, когда словари задаются через `mergeMessages()`, а не лоадерами:
   * иначе библиотеке неоткуда узнать список существующих локалей, и значение
   * из хранилища применено не будет.
   */
  allowedLocales?: Locale[]
}

export class PersistencePlugin implements FintI18nPlugin {
  public name = 'persistence'
  private options: PersistenceOptions
  private offLocaleChange?: () => void
  private storageListener?: (event: StorageEvent) => void
  private unknownLocalesWarned = false

  constructor(options: PersistenceOptions = {}) {
    this.options = {
      key: 'fint-i18n-locale',
      syncTabs: true,
      ...options
    }
  }

  /**
   * Локали, о существовании которых есть подтверждение, либо `null` — если
   * подтверждения нет ни одного. Источники по убыванию надёжности: явный
   * список, реестр лоадеров, уже загруженные словари.
   */
  private knownLocales(i18n: FintI18n): readonly Locale[] | null {
    if (this.options.allowedLocales) return this.options.allowedLocales

    const fromLoaders = i18n.getKnownLocales()
    if (fromLoaders.length > 0) return fromLoaders

    const fromMessages = Object.keys(i18n.messages)
    return fromMessages.length > 0 ? fromMessages : null
  }

  install(i18n: FintI18n) {
    const storageKey = this.options.key!
    const storage = this.options.storage || (typeof window !== 'undefined' ? window.localStorage : undefined)

    if (!storage || typeof storage.getItem !== 'function') return

    // Значение из storage могло устареть или быть подменено — принимаем только
    // локали, о существовании которых есть подтверждение. Если подтверждения
    // нет, значение не применяется: подменённый ключ иначе оставил бы
    // приложение вообще без переводов.
    const isValidLocale = (value: string | null): value is string => {
      if (!value) return false

      const known = this.knownLocales(i18n)

      if (!known) {
        if (!this.unknownLocalesWarned) {
          this.unknownLocalesWarned = true
          console.warn('[fint-i18n] PersistencePlugin cannot tell which locales exist; stored locale ignored. Pass `allowedLocales`.')
        }
        return false
      }

      return known.includes(value)
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
