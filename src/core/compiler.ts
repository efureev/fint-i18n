import type { Locale } from './types'
import { getPluralCategories, getPluralRules } from './plural'

export type MessageFunction = (params?: Record<string, any>) => string

const PIPE = 124 /* '|' */

/**
 * Метка ветки плюрализации: категория CLDR либо точное совпадение (`=0`).
 * Список категорий закрытый — произвольный текст вида `Note: ...` меткой
 * не считается.
 */
const PLURAL_LABEL = /^(zero|one|two|few|many|other|=\d+)\s*:\s*/

/**
 * JIT-компилятор шаблонов.
 * Преобразует строку "Привет, {name}!" в функцию (p) => "Привет, " + p.name + "!"
 *
 * Интерполяция:
 * - `{name}` — подстановка параметра; имя: буквы/цифры/`_`, а также `.` и `-`.
 * - `{{` и `}}` — экранирование: выводятся как литеральные `{` и `}`.
 * - Отсутствующий или null/undefined параметр оставляет плейсхолдер как есть.
 *
 * Плюрализация (`|` разделяет формы, `||` — литеральный `|`):
 * - с метками: `one:{n} файл | few:{n} файла | many:{n} файлов`;
 * - позиционно: формы в каноническом порядке категорий CLDR **этой** локали;
 * - точное значение: `=0:нет файлов | one:{n} файл | ...`.
 *
 * Форма выбирается по `params.count` (или `params.n`) через `Intl.PluralRules`.
 * Разбор и выбор правил происходят один раз при компиляции; в рантайме
 * остаются чтение счётчика, `select()` и вызов ветки.
 *
 * `locale` определяет правила плюрализации. Компилированные сообщения кэшируются
 * по локали, поэтому передавать её обязан вызывающий; без неё берутся правила `en`.
 */
export function compileTemplate(template: string, locale?: Locale): MessageFunction {
  if (template.includes('|')) {
    return compilePlural(template, locale)
  }

  return compileInterpolation(template)
}

function compileInterpolation(template: string): MessageFunction {
  if (!template.includes('{') && !template.includes('}}')) {
    return () => template
  }

  const parts: (string | { key: string, fallback: string })[] = []
  let lastIndex = 0
  let hasPlaceholders = false
  const regex = /\{\{|\}\}|\{([\w.-]+)\}/g
  let match = regex.exec(template)

  while (match) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index))
    }
    if (match[0] === '{{') {
      parts.push('{')
    }
    else if (match[0] === '}}') {
      parts.push('}')
    }
    else {
      parts.push({ key: match[1], fallback: match[0] })
      hasPlaceholders = true
    }
    lastIndex = match.index + match[0].length
    match = regex.exec(template)
  }

  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex))
  }

  // Плейсхолдеров нет (только текст и экранированные скобки) — статичная строка.
  if (!hasPlaceholders) {
    const staticResult = parts.join('')
    return () => staticResult
  }

  return (params?: Record<string, any>) => {
    let result = ''

    for (const part of parts) {
      if (typeof part === 'string') {
        result += part
      }
      else {
        const val = params?.[part.key]
        // null трактуем как отсутствие значения, а не как строку "null"
        result += val == null ? part.fallback : String(val)
      }
    }

    return result
  }
}

/**
 * Разбить шаблон по `|`, схлопнув экранированные `||` в литеральный `|`.
 * Один элемент на выходе означает, что разделителей не было — только экранирование.
 */
function splitBranches(template: string): string[] {
  const branches: string[] = []
  let current = ''
  let start = 0

  for (let i = 0; i < template.length; i++) {
    if (template.charCodeAt(i) !== PIPE) continue

    if (template.charCodeAt(i + 1) === PIPE) {
      current += `${template.slice(start, i)}|`
      i++
      start = i + 1
      continue
    }

    branches.push(current + template.slice(start, i))
    current = ''
    start = i + 1
  }

  branches.push(current + template.slice(start))

  return branches
}

/**
 * Позиционный разбор: i-я форма соответствует i-й категории локали.
 * Форм меньше, чем категорий, — хвост категорий делит последнюю форму
 * (`"{n} item | {n} items"` в `ru` даст `one` и общую форму на остальные).
 */
function mapPositionalBranches(branches: MessageFunction[], locale?: Locale): Map<string, MessageFunction> {
  const categories = getPluralCategories(locale)
  const map = new Map<string, MessageFunction>()
  const last = branches.length - 1

  for (let i = 0; i < categories.length; i++) {
    map.set(categories[i], branches[i > last ? last : i])
  }

  return map
}

/**
 * Счётчик, пришедший строкой (типичная ситуация для данных из JSON/API),
 * приводится к числу. Вызывается только когда параметр не число, поэтому
 * штатный путь ничего за это не платит.
 */
function coerceCount(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined

  const parsed = Number(raw)

  return Number.isFinite(parsed) ? parsed : undefined
}

function compilePlural(template: string, locale?: Locale): MessageFunction {
  const rawBranches = splitBranches(template)

  // Разделителей не было — сообщение обычное, пайпы были экранированы.
  if (rawBranches.length === 1) {
    return compileInterpolation(rawBranches[0])
  }

  const branches: MessageFunction[] = []
  let byLabel: Map<string, MessageFunction> | undefined
  let byExact: Map<number, MessageFunction> | undefined

  for (let i = 0; i < rawBranches.length; i++) {
    const raw = rawBranches[i].trim()
    const label = PLURAL_LABEL.exec(raw)
    const fn = compileInterpolation(label ? raw.slice(label[0].length) : raw)

    branches.push(fn)

    if (!label) continue

    if (label[1].charCodeAt(0) === 61 /* '=' */) {
      (byExact ||= new Map()).set(Number(label[1].slice(1)), fn)
    }
    else {
      (byLabel ||= new Map()).set(label[1], fn)
    }
  }

  const lastBranch = branches[branches.length - 1]
  const byCategory = byLabel || mapPositionalBranches(branches, locale)

  // Счётчик не передан. С метками намерение автора однозначно — отдаём `other`.
  // Без меток `|` мог быть просто символом в тексте: возвращаем строку целиком,
  // чтобы не менять смысл уже существующих словарей.
  const fallback = byLabel
    ? byLabel.get('other') || lastBranch
    : compileInterpolation(rawBranches.join('|'))

  // Правила резолвятся на этапе компиляции: в рантайме остаётся только select().
  const rules = getPluralRules(locale)

  return (params?: Record<string, any>) => {
    const raw = params?.count ?? params?.n
    const count = typeof raw === 'number' ? raw : coerceCount(raw)

    if (count === undefined) return fallback(params)

    if (byExact) {
      const exact = byExact.get(count)
      if (exact) return exact(params)
    }

    return (byCategory.get(rules.select(count)) || lastBranch)(params)
  }
}
