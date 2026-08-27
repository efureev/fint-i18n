import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

const ENDPOINT = '/__fint-i18n/messages'
const SAFE_SEGMENT = /^[\w-]+$/

export interface FintI18nDevtoolsOptions {
  /**
   * Каталог локалей — тот же, что понимает `fint-i18n-check-messages`:
   * `<локаль>/<блок>.json` (вложенные папки дают точки в имени блока) либо
   * плоский `<локаль>.json`.
   */
  locales: string
}

export interface MessagePatch {
  [locale: string]: Record<string, unknown>
}

/** Куда лечь ключу и что от его пути останется внутри файла. */
export function resolveTarget(localeDir: string, path: string[]): { file: string, rest: string[] } {
  for (let i = path.length - 1; i >= 1; i--) {
    const candidate = `${join(localeDir, ...path.slice(0, i))}.json`
    if (existsSync(candidate)) return { file: candidate, rest: path.slice(i) }
  }

  // Ничего похожего нет — заводим файл по первому сегменту: `common.hello`
  // ложится в `common.json`, как и во всех словарях витрины.
  return { file: `${join(localeDir, path[0])}.json`, rest: path.slice(1) }
}

/** Плоское дерево ключей: `{ a: { b: 'x' } }` → `[['a','b'], 'x']`. */
export function flatten(tree: Record<string, unknown>, prefix: string[] = []): [string[], unknown][] {
  const out: [string[], unknown][] = []

  for (const key in tree) {
    const value = tree[key]
    const path = [...prefix, key]

    if (value && typeof value === 'object' && !Array.isArray(value)) out.push(...flatten(value as Record<string, unknown>, path))
    else out.push([path, value])
  }

  return out
}

/**
 * Кладёт значение по пути. Возвращает `false`, если значение уже было и
 * перезапись не разрешена: заготовка из промахов не должна затирать перевод.
 */
export function setDeep(target: Record<string, any>, path: string[], value: unknown, overwrite: boolean): boolean {
  let node = target

  for (let i = 0; i < path.length - 1; i++) {
    if (!node[path[i]] || typeof node[path[i]] !== 'object') node[path[i]] = {}
    node = node[path[i]]
  }

  const leaf = path[path.length - 1]
  if (!overwrite && leaf in node) return false

  node[leaf] = value
  return true
}

function readJson(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {}

  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  }
  catch {
    throw new Error(`[fint-i18n] cannot parse ${file}`)
  }
}

/**
 * Записывает патч в словари. Возвращает пути изменённых файлов.
 *
 * Экспортируется отдельно от плагина, потому что вся содержательная часть —
 * здесь, и проверять её сподручнее без поднятого сервера.
 */
export function writePatch(localesRoot: string, patch: MessagePatch, overwrite: boolean): string[] {
  const root = resolve(localesRoot)
  const touched = new Set<string>()

  for (const locale in patch) {
    if (!SAFE_SEGMENT.test(locale)) throw new Error(`[fint-i18n] unsafe locale name: ${locale}`)

    // Плоская раскладка (`ru.json`) и каталог (`ru/*.json`) — обе законны.
    const flatFile = join(root, `${locale}.json`)
    const localeDir = join(root, locale)
    const flat = existsSync(flatFile) && !existsSync(localeDir)

    for (const [path, value] of flatten(patch[locale])) {
      if (!path.every(segment => SAFE_SEGMENT.test(segment))) {
        throw new Error(`[fint-i18n] unsafe key path: ${path.join('.')}`)
      }

      const target = flat
        ? { file: flatFile, rest: path }
        : resolveTarget(localeDir, path)

      // Записываем только внутрь каталога локалей: путь пришёл по сети.
      if (!resolve(target.file).startsWith(root + sep)) {
        throw new Error(`[fint-i18n] refusing to write outside ${root}`)
      }

      const content = readJson(target.file)
      if (!setDeep(content, target.rest, value, overwrite)) continue

      mkdirSync(dirname(target.file), { recursive: true })
      writeFileSync(target.file, `${JSON.stringify(content, null, 2)}\n`)
      touched.add(target.file)
    }
  }

  return [...touched]
}

/**
 * Плагин dev-сервера: принимает от панели devtools ключи и дописывает их в
 * словари на диске. Замыкает цикл «промах виден → ключ заведён», который иначе
 * заканчивается выгрузкой JSON и копированием руками.
 *
 * `apply: 'serve'` не декоративен: эндпоинт пишет файлы, и в прод-сборке его не
 * должно существовать ни в каком виде.
 */
export function fintI18nDevtools(options: FintI18nDevtoolsOptions): Plugin {
  const root = resolve(options.locales)

  return {
    name: 'fint-i18n-devtools',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use(ENDPOINT, (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: true, locales: root }))
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          res.setHeader('content-type', 'application/json')

          try {
            const { patch, overwrite } = JSON.parse(body || '{}')
            const written = writePatch(root, patch ?? {}, overwrite === true)

            res.end(JSON.stringify({ ok: true, written }))
          }
          catch (error) {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
          }
        })
      })
    },
  }
}

export { ENDPOINT as FINT_I18N_DEVTOOLS_ENDPOINT }
