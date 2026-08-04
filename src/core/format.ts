import type { Locale } from './types'

export type NumberValue = number | bigint
export type DateValue = Date | number | string

const DEFAULT_FORMAT_LOCALE = 'en'

/**
 * Потолок кэша форматтеров. `Intl`-инстансы тяжёлые, а ключ зависит от опций —
 * приложение с генерируемыми опциями иначе растило бы кэш бесконечно.
 * При переполнении кэш сбрасывается целиком: это дешевле LRU и достаточно,
 * потому что реальные приложения используют единицы наборов опций.
 */
const MAX_CACHED_FORMATTERS = 64

const numberFormats = new Map<string, Intl.NumberFormat>()
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>()

/**
 * Ключ кэша: локаль плюс пары «опция-значение».
 * Без `JSON.stringify` и без сортировки ключей — порядок полей влияет только
 * на попадание в кэш, но не на корректность, а лишний проход стоит дороже,
 * чем изредка созданный дублирующий форматтер.
 */
function formatterKey(locale: Locale, options?: object): string {
  if (!options) return locale

  let key = locale
  for (const option in options) {
    key += `|${option}:${String((options as Record<string, unknown>)[option])}`
  }

  return key
}

function guardCacheSize(cache: Map<string, unknown>): void {
  if (cache.size >= MAX_CACHED_FORMATTERS) cache.clear()
}

/** Создание форматтера — самая дорогая часть работы, кэш по «локаль + опции». */
export function getNumberFormat(locale: Locale, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = formatterKey(locale, options)

  let format = numberFormats.get(key)
  if (format) return format

  try {
    format = new Intl.NumberFormat(locale, options)
  }
  catch {
    console.warn(`[fint-i18n] Cannot create Intl.NumberFormat for locale "${locale}", falling back to "${DEFAULT_FORMAT_LOCALE}"`)
    format = new Intl.NumberFormat(DEFAULT_FORMAT_LOCALE, options)
  }

  guardCacheSize(numberFormats)
  numberFormats.set(key, format)

  return format
}

/** См. `getNumberFormat`. */
export function getDateTimeFormat(locale: Locale, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = formatterKey(locale, options)

  let format = dateTimeFormats.get(key)
  if (format) return format

  try {
    format = new Intl.DateTimeFormat(locale, options)
  }
  catch {
    console.warn(`[fint-i18n] Cannot create Intl.DateTimeFormat for locale "${locale}", falling back to "${DEFAULT_FORMAT_LOCALE}"`)
    format = new Intl.DateTimeFormat(DEFAULT_FORMAT_LOCALE, options)
  }

  guardCacheSize(dateTimeFormats)
  dateTimeFormats.set(key, format)

  return format
}

export function formatNumber(locale: Locale, value: NumberValue, options?: Intl.NumberFormatOptions): string {
  return getNumberFormat(locale, options).format(value)
}

/**
 * Принимает `Date`, timestamp или строку, разбираемую `new Date()`.
 * Невалидное значение возвращается как есть — форматирование не должно
 * ронять рендер из-за плохих данных.
 */
export function formatDate(locale: Locale, value: DateValue, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'object' ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    console.warn('[fint-i18n] Invalid date passed to d():', value)
    return String(value)
  }

  return getDateTimeFormat(locale, options).format(date)
}

export interface I18nFormatters {
  /** Число: `n(1234.5, { style: 'currency', currency: 'EUR' })`. */
  n: (value: NumberValue, options?: Intl.NumberFormatOptions) => string
  /** Дата: `d(Date.now(), { dateStyle: 'long' })`. */
  d: (value: DateValue, options?: Intl.DateTimeFormatOptions) => string
}

/**
 * Локаль читается в момент вызова, поэтому внутри `computed`/рендера
 * результат сам пересчитывается при смене локали:
 *
 * ```ts
 * const { n, d } = createFormatters(() => i18n.locale.value)
 * ```
 */
export function createFormatters(getLocale: () => Locale): I18nFormatters {
  return {
    n: (value, options) => formatNumber(getLocale(), value, options),
    d: (value, options) => formatDate(getLocale(), value, options),
  }
}

/** Сброс кэша форматтеров — для тестов и сценариев с ограничением памяти. */
export function clearFormatterCache(): void {
  numberFormats.clear()
  dateTimeFormats.clear()
}
