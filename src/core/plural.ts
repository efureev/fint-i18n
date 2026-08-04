import type { MessageFunction } from './compiler'
import type { Locale, PluralCategory } from './types'
import { compileTemplate } from './compiler'

/**
 * Категории множественного числа CLDR в каноническом порядке.
 * Порядок фиксируем сами, а не берём из `resolvedOptions()`, — движки не
 * обязаны возвращать его отсортированным.
 */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const

const DEFAULT_PLURAL_LOCALE = 'en'
const EXACT_KEY = /^=-?\d+(?:\.\d+)?$/

/** Счётчики свыше этого значения выбирают форму без памятки. */
const MEMO_LIMIT = 64

const categorySet = new Set<string>(PLURAL_CATEGORIES)
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

function isPluralKey(key: string): boolean {
  return categorySet.has(key) || (key.charCodeAt(0) === 61 /* '=' */ && EXACT_KEY.test(key))
}

/**
 * Набор форм — объект, **все** ключи которого являются ключами форм.
 * Обычное поддерево словаря под это условие не подходит, поэтому
 * `{ save, cancel }` остаётся пространством имён, а `{ one, other }` — сообщением.
 */
export function isPluralForms(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  let keys = 0
  for (const key in value) {
    if (!isPluralKey(key)) return false
    keys++
  }

  return keys > 0
}

function coerceCount(raw: unknown): number | undefined {
  if (typeof raw === 'bigint') return Number(raw)
  if (typeof raw !== 'string' || raw.length === 0) return undefined

  const parsed = Number(raw)

  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Компиляция набора форм в одну функцию сообщения.
 * Правила локали резолвятся здесь же, поэтому в рантайме остаются выбор ветки
 * и её вызов.
 */
export function compilePluralForms(forms: Record<string, string>, locale?: Locale): MessageFunction {
  const byCategory = new Map<string, MessageFunction>()
  const byExact = new Map<number, MessageFunction>()
  let anyForm: MessageFunction | undefined

  for (const key in forms) {
    const fn = compileTemplate(forms[key])
    anyForm = fn

    if (key.charCodeAt(0) === 61 /* '=' */) byExact.set(Number(key.slice(1)), fn)
    else byCategory.set(key, fn)
  }

  const other = byCategory.get('other')
  if (!other) {
    console.warn(`[fint-i18n] Plural forms without an "other" branch (locale "${locale ?? DEFAULT_PLURAL_LOCALE}"); some counts have no matching form`)
  }

  const fallback = other || anyForm!
  const rules = getPluralRules(locale)
  const hasExact = byExact.size > 0

  const pick = (count: number): MessageFunction => {
    if (hasExact) {
      const exact = byExact.get(count)
      if (exact) return exact
    }

    return byCategory.get(rules.select(count)) || fallback
  }

  // `select()` — 80% стоимости плюрального вызова, поэтому выбранная ветка
  // запоминается по значению счётчика. Массив, а не Map: доступ по индексу
  // дешевле, а диапазон ограничен, чтобы цены и идентификаторы не растили память.
  let memo: (MessageFunction | undefined)[] | undefined

  return (params?: Record<string, any>) => {
    const raw = params?.count ?? params?.n
    const count = typeof raw === 'number' ? raw : coerceCount(raw)

    if (count === undefined) return fallback(params)

    if (count >= 0 && count < MEMO_LIMIT && Number.isInteger(count)) {
      memo ||= Array.from({ length: MEMO_LIMIT })

      const cached = memo[count]
      if (cached) return cached(params)

      const fn = pick(count)
      memo[count] = fn

      return fn(params)
    }

    return pick(count)(params)
  }
}

/** Сброс кэшей правил — для тестов и сценариев с ограничением памяти. */
export function clearPluralCache(): void {
  rulesCache.clear()
  categoriesCache.clear()
}
