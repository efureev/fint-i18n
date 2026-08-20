import type { Locale } from './types'

/**
 * Базовый язык тега: `ru-RU` → `ru`. Тег без подтега базового языка не имеет —
 * возвращается `undefined`, иначе `ru` считался бы производным от самого себя.
 */
export function baseLanguage(tag: string): string | undefined {
  const dash = tag.indexOf('-')

  return dash > 0 ? tag.slice(0, dash) : undefined
}

/**
 * Выбрать локаль из доступных под запрошенные.
 *
 * Порядок запроса важнее точности совпадения: из `['ru-RU', 'en']` при
 * доступных `['en', 'ru']` победит `ru`, а не точное `en`. Каждый запрошенный
 * тег проходит полный каскад — точное совпадение, базовый язык (`ru-RU` → `ru`),
 * любой региональный вариант (`ru` → `ru-RU`) — и только потом наступает
 * очередь следующего.
 *
 * ```ts
 * const locale = negotiateLocale(navigator.languages, i18n.getAvailableLocales(), 'en')
 * ```
 */
export function negotiateLocale(
  requested: readonly Locale[] | Locale | undefined,
  available: readonly Locale[],
  fallback?: Locale,
): Locale | undefined {
  if (!requested || available.length === 0) return fallback

  const tags = typeof requested === 'string' ? [requested] : requested
  if (tags.length === 0) return fallback

  // Теги BCP 47 сравниваются без учёта регистра, но вернуть нужно исходное
  // написание из `available` — оно же ключ словаря.
  const byLower = new Map<string, Locale>()
  for (const locale of available) {
    const lower = locale.toLowerCase()
    if (!byLower.has(lower)) byLower.set(lower, locale)
  }

  for (const tag of tags) {
    const lower = tag.toLowerCase()

    const exact = byLower.get(lower)
    if (exact !== undefined) return exact

    const base = baseLanguage(lower)
    if (base !== undefined) {
      const byBase = byLower.get(base)
      if (byBase !== undefined) return byBase
    }

    // Обратное направление: запрошен `ru`, а есть только `ru-RU`.
    const prefix = `${base ?? lower}-`
    for (const [candidateLower, candidate] of byLower) {
      if (candidateLower.startsWith(prefix)) return candidate
    }
  }

  return fallback
}

/**
 * Разобрать заголовок `Accept-Language` в список тегов по убыванию `q`.
 *
 * ```ts
 * parseAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8') // ['ru-RU', 'ru', 'en']
 * ```
 *
 * Результат предназначен для `negotiateLocale` — это единственный способ
 * выбрать локаль на сервере, где `navigator.languages` нет.
 */
export function parseAcceptLanguage(header: string): Locale[] {
  const parsed: { tag: Locale, q: number }[] = []

  for (const part of header.split(',')) {
    const [rawTag, ...params] = part.split(';')
    const tag = rawTag.trim()

    // `*` — «любая подойдёт»; конкретного тега для сопоставления не даёт.
    if (!tag || tag === '*') continue

    let q = 1
    for (const param of params) {
      const eq = param.indexOf('=')
      if (eq === -1 || param.slice(0, eq).trim() !== 'q') continue

      const value = Number.parseFloat(param.slice(eq + 1))
      if (Number.isFinite(value)) q = value
    }

    // `q=0` — явный отказ от языка, а не низкий приоритет.
    if (q > 0) parsed.push({ tag, q })
  }

  // Сортировка устойчива, поэтому при равном `q` сохраняется порядок заголовка.
  return parsed.sort((a, b) => b.q - a.q).map(entry => entry.tag)
}
