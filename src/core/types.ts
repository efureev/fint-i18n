import type { MessageFunction } from './compiler'
import type { FintI18n } from './instance'

export type Locale = string

export type LocaleBlockLoader = () => Promise<{ default: MessageValue } | MessageValue>

export type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[]

export type LocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoaders>>

export type LocaleLoaderSource = LocaleLoaderCollection | LocaleLoaderCollection[]

export interface FintI18nPlugin {
  name: string
  install: (instance: FintI18n) => void
  /**
   * Деинициализация плагина: снятие подписок, слушателей событий и т.п.
   * Вызывается из `FintI18n.dispose()`.
   */
  uninstall?: (instance: FintI18n) => void
}

export interface FintI18nOptions {
  locale: Locale
  fallbackLocale?: Locale
  loaders?: LocaleLoaderSource
  plugins?: FintI18nPlugin[]
  /**
   * Грузить блоки также для `fallbackLocale` при каждом `loadBlock`.
   * Без этого fallback срабатывает только по уже загруженным сообщениям.
   */
  preloadFallback?: boolean
  /**
   * Выгружать блок из памяти (сообщения + кэш компиляции), когда счётчик
   * его использований опускается до нуля (unmount последнего компонента,
   * вызвавшего `useI18nScope` с этим блоком). По умолчанию выключено.
   */
  unloadUnusedBlocks?: boolean
}

export type MessagePrimitive = string | number | boolean

export interface MessageSchema {
  [key: string]: MessagePrimitive | MessageFunction | MessageSchema
}

export type MessageValue = MessagePrimitive | MessageFunction | MessageSchema

type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Все листовые ключи схемы в dot-нотации:
 * `{ common: { welcome: string } }` → `'common.welcome'`.
 */
export type MessageKeys<S> = S extends MessageSchema
  ? { [K in keyof S & string]: S[K] extends MessageSchema
      ? `${K}.${MessageKeys<S[K]>}`
      : K
  }[keyof S & string]
  : never

/**
 * Тип ключа для `t()`: литеральные ключи схемы (автодополнение и проверка
 * опечаток) плюс произвольная строка — для динамически конструируемых ключей
 * и обратной совместимости (`string & {}` не сворачивает union в `string`).
 */
export type MessageKey<S> = IsAny<S> extends true
  ? string
  : MessageKeys<S> | (string & {})

export interface TranslateOptions {
  fallbackLocale?: Locale
}