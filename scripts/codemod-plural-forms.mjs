#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

/**
 * Перевод словарей с плюрализации через `|` (0.4.0) на формы-объект (0.5.0).
 *
 *   node scripts/codemod-plural-forms.mjs <пути...> [--write] [--locale=ru] [--positional]
 *
 * Автоматически конвертируется только то, где намерение автора однозначно, —
 * строки с метками (`one:`, `few:`, `=0:`). Всё остальное попадает в отчёт
 * «требует решения»: в синтаксисе 0.4.0 `"Name | Email"` и
 * `"{n} file | {n} files"` неотличимы, и угадывать здесь нельзя — ровно этим
 * молчаливым угадыванием и был плох сам синтаксис.
 */

const PLURAL_LABEL = /^(zero|one|two|few|many|other|=-?\d+(?:\.\d+)?)\s*:\s*/
const CANONICAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other']
const LOCALE_TAG = /^[a-z]{2,3}(?:[-_][A-Za-z0-9]+)*$/

/** Разбор веток по правилам 0.4.0: `||` — экранированный литеральный `|`. */
export function splitBranches(template) {
  const branches = []
  let current = ''
  let start = 0

  for (let i = 0; i < template.length; i++) {
    if (template.charCodeAt(i) !== 124 /* '|' */) continue

    if (template.charCodeAt(i + 1) === 124) {
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

export function pluralCategories(locale) {
  try {
    const available = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
    return CANONICAL_CATEGORIES.filter(category => available.includes(category))
  }
  catch {
    return ['one', 'other']
  }
}

function orderForms(forms) {
  const exact = Object.keys(forms).filter(k => k.startsWith('=')).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const named = CANONICAL_CATEGORIES.filter(c => c in forms)
  const ordered = {}

  for (const key of [...exact, ...named]) ordered[key] = forms[key]

  return ordered
}

/**
 * Классификация строки. `null` — трогать нечего.
 * `convert` — намерение однозначно; `review` — решает человек.
 */
export function analyseString(value, locale) {
  if (!value.includes('|')) return null

  const branches = splitBranches(value)

  if (branches.length === 1) {
    // Разделителей не было, только `||`. В 0.4.0 такая строка выводилась с
    // одним `|`, в 0.5.0 выведется с двумя — рендер меняется в любом случае.
    return {
      action: 'review',
      reason: 'escaped-pipe',
      note: 'Строка содержит `||`. В 0.4.0 это выводилось как один `|`, теперь выведется как два. '
        + 'Решите, что имелось в виду, и запишите символ буквально.',
      suggestion: branches[0],
    }
  }

  const labelled = branches.filter(branch => PLURAL_LABEL.test(branch.trim()))

  if (labelled.length === 0) {
    const categories = pluralCategories(locale)
    const hasCounter = branches.some(branch => /\{(?:n|count)\}/.test(branch))
    // Подсказку показываем, только когда строка вообще похожа на формы:
    // иначе заголовок таблицы «Имя | Почта» получал бы предложение
    // разложить его по категориям, и отчёт превращался бы в шум.
    const looksPlural = hasCounter || branches.length === categories.length

    if (!looksPlural) {
      return {
        action: 'review',
        reason: 'positional',
        note: `Похоже на обычный текст: веток ${branches.length}, категорий у "${locale}" — ${categories.length}, `
          + 'плейсхолдера счётчика нет. Скорее всего, оставить как есть.',
        suggestion: null,
      }
    }

    const forms = {}
    for (let i = 0; i < categories.length; i++) {
      forms[categories[i]] = branches[Math.min(i, branches.length - 1)].trim()
    }

    return {
      action: 'review',
      reason: 'positional',
      note: `Формы без меток: веток ${branches.length}, категорий у "${locale}" — ${categories.length}`
        + `${hasCounter ? ', плейсхолдер счётчика есть' : ''}. `
        + 'Если это плюрализация — подставьте объект ниже; если `|` был просто символом — оставьте строку как есть.',
      suggestion: orderForms(forms),
    }
  }

  if (labelled.length !== branches.length) {
    return {
      action: 'review',
      reason: 'partial-labels',
      note: 'Размечена только часть веток — неразмеченные в 0.4.0 были недостижимы. Восстановите намерение вручную.',
      suggestion: null,
    }
  }

  const forms = {}
  for (const branch of branches) {
    const text = branch.trim()
    const label = PLURAL_LABEL.exec(text)
    forms[label[1]] = text.slice(label[0].length)
  }

  const ordered = orderForms(forms)
  const missing = pluralCategories(locale).filter(category => !(category in ordered))

  return {
    action: 'convert',
    value: ordered,
    warning: missing.length > 0
      ? `нет форм для категорий локали "${locale}": ${missing.join(', ')}`
      : null,
  }
}

/** Обход дерева словаря. Возвращает новое дерево и списки изменений. */
export function migrateTree(tree, locale, options = {}) {
  const converted = []
  const review = []

  const walk = (node, path) => {
    if (Array.isArray(node)) return node
    if (!node || typeof node !== 'object') return node

    const out = {}

    for (const [key, value] of Object.entries(node)) {
      const keyPath = path ? `${path}.${key}` : key

      if (typeof value === 'string') {
        const result = analyseString(value, locale)

        if (!result) {
          out[key] = value
        }
        else if (result.action === 'convert') {
          converted.push({ key: keyPath, from: value, to: result.value, warning: result.warning })
          out[key] = result.value
        }
        else if (result.reason === 'positional' && options.positional && result.suggestion) {
          converted.push({ key: keyPath, from: value, to: result.suggestion, warning: 'принято по флагу --positional' })
          out[key] = result.suggestion
        }
        else {
          review.push({ key: keyPath, value, ...result })
          out[key] = value
        }

        continue
      }

      out[key] = walk(value, keyPath)
    }

    return out
  }

  return { tree: walk(tree, ''), converted, review }
}

function detectIndent(source) {
  const match = source.match(/\n(\s+)\S/)
  return match ? match[1].length : 2
}

/**
 * Локаль берётся из имени файла (`ru.json`) или из папки, в которой он лежит
 * (`locales/ru/common.json`) — и больше ниоткуда: сканировать путь целиком
 * нельзя, `Intl` считает структурно валидным тегом почти любые 2–3 буквы.
 * Вдобавок кандидат обязан иметь данные CLDR, иначе `lib` или `tmp` тихо
 * становились бы локалью.
 */
export function inferLocale(filePath, override) {
  if (override) return override

  const segments = filePath.split(sep)
  const stem = segments[segments.length - 1].replace(/\.json$/i, '')
  const parent = segments[segments.length - 2]

  for (const candidate of [stem, parent]) {
    if (!candidate || !LOCALE_TAG.test(candidate)) continue
    try {
      const [canonical] = Intl.getCanonicalLocales(candidate.replace('_', '-'))
      if (canonical && Intl.PluralRules.supportedLocalesOf([canonical]).length > 0) return canonical
    }
    catch {
      continue
    }
  }

  return null
}

function collectFiles(target) {
  const stats = statSync(target)
  if (!stats.isDirectory()) return target.endsWith('.json') ? [target] : []

  return readdirSync(target).flatMap(entry => collectFiles(join(target, entry)))
}

function main(argv) {
  const paths = argv.filter(a => !a.startsWith('--'))
  const write = argv.includes('--write')
  const positional = argv.includes('--positional')
  const localeArg = argv.find(a => a.startsWith('--locale='))?.slice('--locale='.length)

  if (paths.length === 0) {
    console.error('Usage: node scripts/codemod-plural-forms.mjs <paths...> [--write] [--locale=ru] [--positional]')
    return 1
  }

  const files = paths.flatMap(collectFiles)
  let totalConverted = 0
  let totalReview = 0
  let failed = false

  for (const file of files) {
    const fromCwd = relative(process.cwd(), file)
    const shown = fromCwd.startsWith('..') ? file : fromCwd
    const locale = inferLocale(file, localeArg)

    if (!locale) {
      console.error(`✗ ${shown}: не удалось определить локаль по пути, передайте --locale=<tag>`)
      failed = true
      continue
    }

    const source = readFileSync(file, 'utf8')
    let parsed

    try {
      parsed = JSON.parse(source)
    }
    catch (error) {
      console.error(`✗ ${shown}: невалидный JSON — ${error.message}`)
      failed = true
      continue
    }

    const { tree, converted, review } = migrateTree(parsed, locale, { positional })
    if (converted.length === 0 && review.length === 0) continue

    console.log(`\n${shown}  (локаль: ${locale})`)

    for (const item of converted) {
      console.log(`  ✓ ${item.key}`)
      console.log(`      было:  ${JSON.stringify(item.from)}`)
      console.log(`      стало: ${JSON.stringify(item.to)}`)
      if (item.warning) console.log(`      ! ${item.warning}`)
    }

    for (const item of review) {
      console.log(`  ? ${item.key}  [${item.reason}]`)
      console.log(`      ${JSON.stringify(item.value)}`)
      console.log(`      ${item.note}`)
      if (item.suggestion) console.log(`      вариант: ${JSON.stringify(item.suggestion)}`)
    }

    totalConverted += converted.length
    totalReview += review.length

    if (write && converted.length > 0) {
      writeFileSync(file, `${JSON.stringify(tree, null, detectIndent(source))}\n`)
    }
  }

  console.log(`\nФайлов просмотрено: ${files.length}`)
  console.log(`Сконвертировано автоматически: ${totalConverted}${write ? ' (записано)' : ' (пробный прогон, файлы не тронуты)'}`)
  console.log(`Требует решения: ${totalReview}`)

  if (!write && totalConverted > 0) {
    console.log('\nПовторите с --write, чтобы применить.')
  }

  return failed ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(main(process.argv.slice(2)))
}
