import { isRef, watch, type Ref, type WatchStopHandle } from 'vue'
import type { FintI18n, FintI18nPlugin, Locale } from '../core'

/**
 * Минимальный структурный контракт vue-i18n:
 * composer (locale — Ref) либо legacy-инстанс (locale — строка).
 */
export interface BridgeI18nTarget {
  locale: Ref<Locale> | Locale
  t: (key: string, params?: Record<string, any>) => string
}

export interface BridgeOptions {
  /** vue-i18n composer / legacy-инстанс; объекты с `.global` разворачиваются автоматически. */
  i18n: BridgeI18nTarget | { global: BridgeI18nTarget }
  /**
   * Чей перевод приоритетнее при конфликте:
   * - `'fint'` (по умолчанию): vue-i18n опрашивается только если fint-i18n не нашёл ключ;
   * - `'vue-i18n'`: перевод vue-i18n перекрывает найденный fint-i18n.
   */
  priority?: 'fint' | 'vue-i18n'
}

export class BridgePlugin implements FintI18nPlugin {
  public name = 'bridge'
  private options: BridgeOptions
  private stopLocaleWatch?: WatchStopHandle
  private hookUnsubscribers: (() => void)[] = []

  constructor(options: BridgeOptions) {
    this.options = options
  }

  install(fintI18n: FintI18n) {
    const raw = this.options.i18n
    const target: BridgeI18nTarget = 'global' in raw ? raw.global : raw
    const priority = this.options.priority ?? 'fint'

    // Sync locale: vue-i18n -> fint-i18n.
    // Composer: locale — Ref; legacy: строковое свойство (реактивно, если сам
    // инстанс reactive — тогда watch по геттеру отслеживает изменения).
    const readLocale = isRef(target.locale)
      ? () => (target.locale as Ref<Locale>).value
      : () => target.locale as Locale

    this.stopLocaleWatch = watch(
      readLocale,
      (newLocale) => {
        if (fintI18n.locale.value !== newLocale) {
          void fintI18n.setLocale(newLocale)
        }
      },
      { immediate: true },
    )

    // Sync locale: fint-i18n -> vue-i18n
    this.hookUnsubscribers.push(
      fintI18n.hooks.on('onLocaleChange', ({ locale }) => {
        if (isRef(target.locale)) {
          target.locale.value = locale
        }
        else {
          target.locale = locale
        }
      }),
    )

    // Proxy translations
    this.hookUnsubscribers.push(
      fintI18n.hooks.on('onTranslate', (data) => {
        // fint-i18n уже нашёл перевод — vue-i18n не дёргаем.
        if (priority === 'fint' && data.result !== undefined) {
          return data
        }

        const translated = data.params ? target.t(data.key, data.params) : target.t(data.key)
        if (translated !== data.key) {
          return { ...data, result: translated }
        }
        return data
      }),
    )
  }

  uninstall() {
    this.stopLocaleWatch?.()
    this.stopLocaleWatch = undefined
    this.hookUnsubscribers.forEach(off => off())
    this.hookUnsubscribers = []
  }
}
