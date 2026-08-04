import type { Locale } from './types'

/**
 * Категории множественного числа CLDR в каноническом порядке.
 * Порядок фиксируем сами, а не берём из `resolvedOptions()`, — движки не
 * обязаны возвращать его отсортированным, а от порядка зависит позиционный
 * (без меток) разбор шаблона.
 */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

export type PluralCategory = (typeof PLURAL_CATEGORIES)[number]

const DEFAULT_PLURAL_LOCALE = 'en'

const rulesCache = new Map<Locale, Intl.PluralRules>()
const categoriesCache = new Map<Locale, PluralCategory[]>()

/**
 * Создание `Intl.PluralRules` дорогое — инстансы кэшируются по локали.
 *
 * `Locale` в библиотеке — произвольный строковый ключ, поэтому невалидный
 * BCP 47 тег не должен ронять перевод: откатываемся на английские правила.
 */
export function getPluralRules(locale?: Locale): Intl.PluralRules {
  const key = locale || DEFAULT_PLURAL_LOCALE

  let rules = rulesCache.get(key)
  if (rules) return rules

  try {
    rules = new Intl.PluralRules(key)
  }
  catch {
    console.warn(`[fint-i18n] Invalid locale tag "${key}", plural rules fall back to "${DEFAULT_PLURAL_LOCALE}"`)
    // Прямое создание, а не рекурсия: защищает от бесконечного цикла,
    // если сам DEFAULT_PLURAL_LOCALE окажется недоступен.
    rules = new Intl.PluralRules(DEFAULT_PLURAL_LOCALE)
  }

  rulesCache.set(key, rules)
  return rules
}

/**
 * Категории, реально используемые локалью, в каноническом порядке CLDR.
 * Для `en` — `['one', 'other']`, для `ru` — `['one', 'few', 'many', 'other']`.
 * На этот порядок опирается позиционный синтаксис плюрализации.
 */
export function getPluralCategories(locale?: Locale): PluralCategory[] {
  const key = locale || DEFAULT_PLURAL_LOCALE

  let categories = categoriesCache.get(key)
  if (categories) return categories

  const available = getPluralRules(key).resolvedOptions().pluralCategories
  categories = PLURAL_CATEGORIES.filter(category => available.includes(category))
  categoriesCache.set(key, categories)

  return categories
}

/** Нефинитные значения дают `other`. */
export function selectPluralCategory(locale: Locale | undefined, count: number): PluralCategory {
  return getPluralRules(locale).select(count)
}

/** Сброс кэшей правил — для тестов и сценариев с ограничением памяти. */
export function clearPluralCache(): void {
  rulesCache.clear()
  categoriesCache.clear()
}
