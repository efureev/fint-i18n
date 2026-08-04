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

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

/** Ключ формы: категория CLDR либо точное значение счётчика (`=0`). */
export type PluralFormKey = PluralCategory | `=${number}`

/**
 * Набор плюральных форм. `other` обязателен — он гарантирует, что у любой
 * локали и любого счётчика есть куда упасть.
 *
 * ```json
 * { "=0": "нет файлов", "one": "{n} файл", "few": "{n} файла", "many": "{n} файлов", "other": "{n} файла" }
 * ```
 */
export type PluralForms =
  & { other: string }
  & Partial<Record<Exclude<PluralCategory, 'other'>, string>>
  & Partial<Record<`=${number}`, string>>

export type MessageValue = MessagePrimitive | MessageFunction | MessageSchema

type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * Ограничение дженерика схемы. Намеренно шире `MessageSchema`: у `interface`
 * нет неявной индексной сигнатуры, поэтому под `MessageSchema` он не подходит,
 * а описывать схему интерфейсом — первое, что делает потребитель.
 */
export type MessageSchemaConstraint = Record<string, any>

/** Объект, все ключи которого — ключи форм, адресуется целиком, а не по частям. */
type IsPluralForms<T> = [keyof T] extends [PluralFormKey] ? true : false

/**
 * Все листовые ключи схемы в dot-нотации:
 * `{ common: { welcome: string } }` → `'common.welcome'`.
 * Набор плюральных форм — лист: у `{ files: { one, other } }` ключ `'files'`,
 * а не `'files.one'`.
 */
export type MessageKeys<S> = S extends object
  ? { [K in keyof S & string]:
      S[K] extends (...args: any[]) => any
        ? K
        : S[K] extends object
          ? (IsPluralForms<S[K]> extends true ? K : `${K}.${MessageKeys<S[K]>}`)
          : K
  }[keyof S & string]
  : never

/**
 * Тип ключа для `t()`: литеральные ключи схемы (автодополнение) плюс
 * произвольная строка — для динамически конструируемых ключей и обратной
 * совместимости (`string & {}` не сворачивает union в `string`).
 * Опечатка при этом ошибкой компиляции не является: любая строка допустима.
 */
export type MessageKey<S> = IsAny<S> extends true
  ? string
  : MessageKeys<S> | (string & {})

export interface TranslateOptions {
  fallbackLocale?: Locale
}