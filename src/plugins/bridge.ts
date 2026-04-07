import type { FintI18n, FintI18nPlugin, Locale } from '@/core'
import { watch } from 'vue'

export interface BridgeOptions {
  i18n: any // This should be vue-i18n instance or global composer
}

export class BridgePlugin implements FintI18nPlugin {
  public name = 'bridge'
  private options: BridgeOptions

  constructor(options: BridgeOptions) {
    this.options = options
  }

  install(fintI18n: FintI18n) {
    const vueI18n = this.options.i18n

    // Sync locale: vue-i18n -> fint-i18n
    watch(
      () => (vueI18n.locale.value || vueI18n.locale),
      (newLocale: Locale) => {
        if (fintI18n.locale.value !== newLocale) {
          fintI18n.locale.value = newLocale
        }
      },
      { immediate: true }
    )

    // Sync locale: fint-i18n -> vue-i18n
    fintI18n.hooks.on('onLocaleChange', ({ locale }) => {
      if (typeof vueI18n.locale === 'object') {
        vueI18n.locale.value = locale
      } else {
        vueI18n.locale = locale
      }
    })

    // Proxy translations
    fintI18n.hooks.on('onTranslate', (data) => {
      const translated = data.params ? vueI18n.t(data.key, data.params) : vueI18n.t(data.key)
      if (translated !== data.key) {
        return { ...data, result: translated }
      }
      return data
    })
  }
}

