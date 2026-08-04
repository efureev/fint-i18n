#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { pluralCategories } from './codemod-plural-forms.mjs'

/**
 * Проверка словарей: расхождение локалей, полнота плюральных форм и
 * согласованность с кодом.
 *
 *   node scripts/check-messages.mjs <каталог локалей> [--source <каталог>] [--strict]
 *
 * Каталог локалей устроен как `<локаль>/*.json` либо `<локаль>.json`.
 * `--source` можно указывать несколько раз; без него проверки по коду не идут.
 */

const CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])
const EXACT_KEY = /^=-?\d+(?:\.\d+)?$/
// Методы, чей первый строковый аргумент является ключом сообщения.
const KEY_METHODS = new Set(['t', 'te', 'tm', '$t'])

/**
 * Форма набора плюральных форм. Дублирует `isPluralForms` из `src/core/plural.ts`
 * намеренно: скрипт публикуется как bin и не может импортировать TypeScript.
 */
function isPluralForms(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  let keys = 0
  for (const key in value) {
    if (!CATEGORIES.has(key) && !EXACT_KEY.test(key)) return false
    keys++
  }

  return keys > 0
}

/** Ключи сообщений. Набор форм — один ключ, а не по ключу на форму. */
function collectMessageKeys(tree, prefix = '', into = new Map()) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (value && typeof value === 'object' && !Array.isArray(value) && !isPluralForms(value)) {
      collectMessageKeys(value, path, into)
      continue
    }

    into.set(path, value)
  }

  return into
}

// ---------------------------------------------------------------- словари

function readLocales(dir) {
  const locales = new Map()

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      const tree = {}

      for (const file of walk(full)) {
        if (extname(file) !== '.json') continue

        // Имя блока — путь от каталога локали, а не basename: файл
        // `widgets/alpha.json` регистрируется как блок `widgets.alpha`.
        const segments = relative(full, file).replace(/\.json$/, '').split(sep)
        let node = tree
        for (const segment of segments.slice(0, -1)) node = (node[segment] ??= {})
        node[segments[segments.length - 1]] = JSON.parse(readFileSync(file, 'utf8'))
      }

      locales.set(entry, tree)
      continue
    }

    if (extname(entry) === '.json') {
      locales.set(basename(entry, '.json'), JSON.parse(readFileSync(full, 'utf8')))
    }
  }

  return locales
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield * walk(full)
    else yield full
  }
}

// ---------------------------------------------------------------- проверки

export function checkLocaleParity(locales) {
  const byLocale = new Map()
  for (const [locale, tree] of locales) byLocale.set(locale, collectMessageKeys(tree))

  const all = new Set()
  for (const keys of byLocale.values()) for (const key of keys.keys()) all.add(key)

  const problems = []
  for (const key of [...all].sort()) {
    const missing = [...byLocale.keys()].filter(locale => !byLocale.get(locale).has(key))
    if (missing.length > 0 && missing.length < byLocale.size) {
      problems.push({ key, missing })
    }
  }

  return problems
}

export function checkPluralCompleteness(locales) {
  const problems = []

  for (const [locale, tree] of locales) {
    const required = pluralCategories(locale)

    for (const [key, value] of collectMessageKeys(tree)) {
      if (!isPluralForms(value)) continue

      const present = new Set(Object.keys(value).filter(k => CATEGORIES.has(k)))
      const missing = required.filter(category => !present.has(category))

      if (missing.length > 0) problems.push({ locale, key, missing })
    }
  }

  return problems
}

// ---------------------------------------------------------------- код

const SCOPE_FNS = new Set(['useI18nScope', 'useI18nScopeSync'])

/**
 * Парсеры не входят в зависимости пакета: скрипт может запускаться из чужого
 * проекта через `npx`, и тащить туда `typescript` ради проверки словарей
 * неправильно. Он там почти всегда уже есть — а если нет, ошибка должна
 * называть пакет, а не падать стеком модулей.
 */
async function loadParser(name, purpose) {
  try {
    return await import(name)
  }
  catch {
    throw new Error(`Для разбора ${purpose} нужен пакет "${name}". Установите его: npm i -D ${name}`)
  }
}

/**
 * Ключи из одного файла. Разбор идёт по AST TypeScript, а не регулярками:
 * регулярка не отличит `t('a')` от такой же строки в комментарии.
 *
 * Возвращается три вещи, потому что «ключ использован» бывает трёх видов:
 * прямой вызов, поддерево через `tm()` и вызов относительно блока при
 * `prefix: true`.
 */
async function extractFromScript(code, fileName, acc) {
  const ts = (await loadParser('typescript', '.ts/.js')).default
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true)

  const literal = node => node && ts.isStringLiteralLike(node) && !ts.isTemplateExpression(node)
    ? node.text
    : null

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : null

      const [first, second] = node.arguments

      if (name && KEY_METHODS.has(name)) {
        const key = literal(first)

        if (key !== null) {
          acc.keys.add(key)
          // `tm(prefix)` означает, что использовано всё поддерево целиком.
          if (name === 'tm') acc.subtrees.add(key)
        }
        else if (first) {
          acc.dynamic.push(`${fileName}: ${name}(${first.getText().slice(0, 40)}…)`)
        }
      }

      // `useI18nScope(block, { prefix: true })` делает ключи в этом файле
      // относительными: `t('title')` разрешается как `block.title`.
      if (name && SCOPE_FNS.has(name) && second && ts.isObjectLiteralExpression(second)) {
        const prefixed = second.properties.some(prop =>
          ts.isPropertyAssignment(prop)
          && prop.name.getText() === 'prefix'
          && prop.initializer.kind === ts.SyntaxKind.TrueKeyword)

        if (prefixed) {
          const blocks = literal(first) !== null
            ? [literal(first)]
            : first && ts.isArrayLiteralExpression(first)
              ? first.elements.map(literal).filter(Boolean)
              : []

          for (const block of blocks) acc.prefixes.add(block)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
}

async function extractFromVue(code, fileName, acc) {
  const { parse } = await loadParser('@vue/compiler-sfc', '.vue')
  const { descriptor } = parse(code, { filename: fileName })

  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (block) await extractFromScript(block.content, fileName, acc)
  }

  if (!descriptor.template) return

  // Выражения шаблона — те же вызовы, только строками; прогоняем тем же разбором.
  const expressions = []
  const collect = (node) => {
    if (node.type === 5 /* INTERPOLATION */ && node.content?.content) {
      expressions.push(node.content.content)
    }

    for (const prop of node.props ?? []) {
      if (prop.type !== 7 /* DIRECTIVE */ || !prop.exp?.content) continue

      // У `v-t` ключ — это само выражение, а не аргумент вызова:
      // `v-t="'a.b'"` и `v-t="{ path: 'a.b' }"`.
      if (prop.name === 't') {
        const raw = prop.exp.content.trim()
        const direct = raw.match(/^['"`]([^'"`]+)['"`]$/)
        const viaPath = raw.match(/path\s*:\s*['"`]([^'"`]+)['"`]/)

        if (direct) acc.keys.add(direct[1])
        else if (viaPath) acc.keys.add(viaPath[1])
        else acc.dynamic.push(`${fileName}: v-t="${raw.slice(0, 40)}…"`)

        continue
      }

      expressions.push(prop.exp.content)
    }

    for (const child of node.children ?? []) {
      if (typeof child === 'object') collect(child)
    }
  }
  collect(descriptor.template.ast)

  for (const expression of expressions) {
    await extractFromScript(`(${expression})`, fileName, acc)
  }
}

export async function extractUsedKeys(dirs) {
  // `used` — для поиска неиспользуемых: сюда попадают все трактовки ключа,
  // потому что лишняя пометка «использован» безопасна.
  // `probes` — для поиска отсутствующих: ключ считается пропавшим, только если
  // в словарях нет **ни одной** его трактовки. Симметричное послабление здесь
  // дало бы ложные тревоги на файлах, где префиксные и абсолютные вызовы
  // соседствуют.
  const used = new Set()
  const probes = []
  const subtrees = new Set()
  const dynamic = []

  for (const dir of dirs) {
    for (const file of walk(dir)) {
      const ext = extname(file)
      if (!['.vue', '.ts', '.mts', '.js', '.mjs'].includes(ext)) continue

      const code = readFileSync(file, 'utf8')
      const acc = { keys: new Set(), subtrees: new Set(), prefixes: new Set(), dynamic: [] }

      if (ext === '.vue') await extractFromVue(code, file, acc)
      else await extractFromScript(code, file, acc)

      for (const key of acc.keys) {
        const alternatives = [key, ...[...acc.prefixes].map(prefix => `${prefix}.${key}`)]
        for (const alternative of alternatives) used.add(alternative)
        probes.push(alternatives)
      }
      for (const subtree of acc.subtrees) {
        subtrees.add(subtree)
        for (const prefix of acc.prefixes) subtrees.add(`${prefix}.${subtree}`)
      }
      dynamic.push(...acc.dynamic)
    }
  }

  return { used, probes, subtrees, dynamic }
}

// ---------------------------------------------------------------- вывод

function parseArgs(argv) {
  const sources = []
  const allow = new Set()
  const positional = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--source' && argv[i + 1]) { sources.push(argv[++i]); continue }
    if (arg.startsWith('--source=')) { sources.push(arg.slice('--source='.length)); continue }
    if (arg === '--allow' && argv[i + 1]) { allow.add(argv[++i]); continue }
    if (arg.startsWith('--allow=')) { allow.add(arg.slice('--allow='.length)); continue }
    if (!arg.startsWith('--')) positional.push(arg)
  }

  return { messagesDir: positional[0], sources, allow, strict: argv.includes('--strict') }
}

async function run(argv) {
  const { messagesDir, sources, allow, strict } = parseArgs(argv)

  if (!messagesDir) {
    console.error('Usage: node scripts/check-messages.mjs <locales dir> [--source <dir>] [--allow <key>] [--strict]')
    return 1
  }

  const locales = readLocales(messagesDir)
  if (locales.size === 0) {
    console.error(`\u2717 ${messagesDir}: локали не найдены`)
    return 1
  }

  console.log(`Словари: ${[...locales.keys()].join(', ')} (${relative(process.cwd(), messagesDir) || messagesDir})\n`)

  let failed = false

  const parity = checkLocaleParity(locales).filter(problem => !allow.has(problem.key))
  if (parity.length === 0) {
    console.log('\u2713 наборы ключей во всех локалях совпадают')
  }
  else {
    failed = true
    console.log(`\u2717 ключи есть не во всех локалях (${parity.length}):`)
    for (const { key, missing } of parity) console.log(`    ${key} — нет в: ${missing.join(', ')}`)
    console.log('    намеренную асимметрию разрешайте флагом --allow <key>')
  }

  const plurals = checkPluralCompleteness(locales)
  if (plurals.length === 0) {
    console.log('\u2713 наборы плюральных форм покрывают категории своих локалей')
  }
  else {
    failed = true
    console.log(`\u2717 неполные наборы плюральных форм (${plurals.length}):`)
    for (const { locale, key, missing } of plurals) {
      console.log(`    ${locale}: ${key} — нет форм: ${missing.join(', ')}`)
    }
  }

  if (sources.length === 0) {
    console.log('\nИсходники не заданы (--source) — проверки по коду пропущены.')
    return failed ? 1 : 0
  }

  const { used, probes, subtrees, dynamic } = await extractUsedKeys(sources)

  const known = new Set()
  for (const tree of locales.values()) for (const key of collectMessageKeys(tree).keys()) known.add(key)

  const missing = [...new Set(
    probes
      .filter(alternatives => !alternatives.some(key => known.has(key) || allow.has(key)))
      .map(alternatives => alternatives[0]),
  )].sort()
  const covered = key => used.has(key) || [...subtrees].some(prefix => key.startsWith(`${prefix}.`))
  const unused = [...known].filter(key => !covered(key) && !allow.has(key)).sort()

  if (missing.length === 0) {
    console.log(`\u2713 все ключи из кода есть в словарях (проверено ${probes.length})`)
  }
  else {
    failed = true
    console.log(`\u2717 ключи есть в коде, но не в словарях (${missing.length}):`)
    for (const key of missing) console.log(`    ${key}`)
  }

  // «Неиспользуемый» — вывод ненадёжный: ключ мог быть собран динамически.
  // Поэтому по умолчанию это отчёт, а не ошибка.
  if (unused.length === 0) {
    console.log('\u2713 неиспользуемых ключей не найдено')
  }
  else {
    console.log(`${strict ? '\u2717' : '?'} ключи есть в словарях, но не найдены в коде (${unused.length}):`)
    for (const key of unused) console.log(`    ${key}`)
    if (strict) failed = true
  }

  if (dynamic.length > 0) {
    console.log(`\n! ключи, собранные динамически (${dynamic.length}) — из-за них список неиспользуемых неполон:`)
    for (const entry of dynamic.slice(0, 10)) console.log(`    ${entry.replace(process.cwd() + sep, '')}`)
    if (dynamic.length > 10) console.log(`    …и ещё ${dynamic.length - 10}`)
  }

  return failed ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(await run(process.argv.slice(2)))
}

export { collectMessageKeys, isPluralForms }
