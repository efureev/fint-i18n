import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEV_SERVER_ENDPOINT } from '../../devtools/dev-server'
import { FINT_I18N_DEVTOOLS_ENDPOINT, fintI18nDevtools, flatten, resolveTarget, setDeep, writePatch } from '../index'

function fixture(files: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'fint-vite-'))

  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, `${JSON.stringify(content, null, 2)}\n`)
  }

  return root
}

const read = (root: string, path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'))

describe('эндпоинт', () => {
  // Строка продублирована по разные стороны слоя: браузер и node. Разъедутся —
  // панель будет молча писать в никуда.
  it('совпадает у плагина и у клиента', () => {
    expect(FINT_I18N_DEVTOOLS_ENDPOINT).toBe(DEV_SERVER_ENDPOINT)
  })
})

describe('flatten / setDeep / resolveTarget', () => {
  it('разворачивает дерево в пути', () => {
    expect(flatten({ a: { b: 'x', c: { d: 'y' } } })).toEqual([[['a', 'b'], 'x'], [['a', 'c', 'd'], 'y']])
  })

  it('не затирает существующее значение без разрешения', () => {
    const target = { a: { b: 'old' } }

    expect(setDeep(target, ['a', 'b'], 'new', false)).toBe(false)
    expect(target.a.b).toBe('old')

    expect(setDeep(target, ['a', 'b'], 'new', true)).toBe(true)
    expect(target.a.b).toBe('new')
  })

  it('находит самый глубокий существующий файл блока', () => {
    const root = fixture({ 'en/widgets/alpha.json': { title: 'A' }, 'en/common.json': { hello: 'H' } })

    expect(resolveTarget(join(root, 'en'), ['widgets', 'alpha', 'title']))
      .toEqual({ file: join(root, 'en/widgets/alpha.json'), rest: ['title'] })
    expect(resolveTarget(join(root, 'en'), ['common', 'hello']))
      .toEqual({ file: join(root, 'en/common.json'), rest: ['hello'] })
  })

  it('для незнакомого блока заводит файл по первому сегменту', () => {
    const root = fixture({ 'en/common.json': {} })

    expect(resolveTarget(join(root, 'en'), ['auth', 'login']))
      .toEqual({ file: join(root, 'en/auth.json'), rest: ['login'] })
  })
})

describe('writePatch', () => {
  it('дописывает ключи в каталожную раскладку, не трогая соседей', () => {
    const root = fixture({ 'en/common.json': { hello: 'Hello' }, 'ru/common.json': { hello: 'Привет' } })

    const written = writePatch(root, { ru: { common: { bye: '' } } }, false)

    expect(written).toEqual([join(root, 'ru/common.json')])
    expect(read(root, 'ru/common.json')).toEqual({ hello: 'Привет', bye: '' })
    expect(read(root, 'en/common.json')).toEqual({ hello: 'Hello' })
  })

  it('уважает вложенные файлы блоков', () => {
    const root = fixture({ 'en/widgets/alpha.json': { title: 'A' } })

    writePatch(root, { en: { widgets: { alpha: { lead: 'L' } } } }, false)

    expect(read(root, 'en/widgets/alpha.json')).toEqual({ title: 'A', lead: 'L' })
  })

  it('понимает плоскую раскладку', () => {
    const root = fixture({ 'en.json': { common: { hello: 'Hello' } } })

    writePatch(root, { en: { common: { bye: '' } } }, false)

    expect(read(root, 'en.json')).toEqual({ common: { hello: 'Hello', bye: '' } })
  })

  it('без overwrite существующий перевод остаётся', () => {
    const root = fixture({ 'ru/common.json': { hello: 'Привет' } })

    expect(writePatch(root, { ru: { common: { hello: '' } } }, false)).toEqual([])
    expect(read(root, 'ru/common.json')).toEqual({ hello: 'Привет' })

    writePatch(root, { ru: { common: { hello: 'Здравствуйте' } } }, true)
    expect(read(root, 'ru/common.json')).toEqual({ hello: 'Здравствуйте' })
  })

  it('создаёт файл нового блока', () => {
    const root = fixture({ 'en/common.json': {} })

    writePatch(root, { en: { auth: { login: '' } } }, false)

    expect(read(root, 'en/auth.json')).toEqual({ login: '' })
  })

  it('отказывается писать за пределы каталога локалей', () => {
    const root = fixture({ 'en/common.json': {} })

    // Путь приходит по сети, поэтому проверяется каждый сегмент.
    expect(() => writePatch(root, { '../evil': { a: 'x' } }, false)).toThrow('unsafe locale')
    expect(() => writePatch(root, { en: { '../../etc': { passwd: 'x' } } }, false)).toThrow('unsafe key path')
  })

  it('сохраняет форматирование словарей: два пробела и перевод строки', () => {
    const root = fixture({ 'en/common.json': { hello: 'Hello' } })

    writePatch(root, { en: { common: { bye: 'Bye' } } }, false)

    expect(readFileSync(join(root, 'en/common.json'), 'utf8'))
      .toBe('{\n  "hello": "Hello",\n  "bye": "Bye"\n}\n')
  })
})

describe('плагин', () => {
  it('живёт только на dev-сервере', () => {
    const plugin = fintI18nDevtools({ locales: 'anywhere' })

    expect(plugin.name).toBe('fint-i18n-devtools')
    // Эндпоинт пишет файлы — в прод-сборке его быть не должно ни в каком виде.
    expect(plugin.apply).toBe('serve')
  })
})

/** Ручка эндпоинта, снятая с плагина: настоящего dev-сервера здесь нет. */
function handler(root: string) {
  const plugin = fintI18nDevtools({ locales: root })
  const captured: ((req: FakeRequest, res: FakeResponse) => void)[] = []
  const server = { middlewares: { use: (_: string, fn: (req: FakeRequest, res: FakeResponse) => void) => { captured.push(fn) } } }

  ;(plugin.configureServer as (s: unknown) => void)(server)
  const [handle] = captured
  if (!handle) throw new Error('плагин не повесил обработчик')

  return handle
}

interface FakeRequest {
  method: string
  on: (event: string, fn: (chunk?: string) => void) => void
}

interface FakeResponse {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body?: string) => void
}

function call(root: string, method: string, body?: string) {
  const listeners: Record<string, ((chunk?: string) => void)[]> = {}
  const res = { statusCode: 200, headers: {} as Record<string, string>, body: '' }
  const response: FakeResponse = {
    get statusCode() { return res.statusCode },
    set statusCode(value: number) { res.statusCode = value },
    setHeader: (name, value) => { res.headers[name] = value },
    end: (payload) => { res.body = payload ?? '' },
  }

  handler(root)({ method, on: (event, fn) => { (listeners[event] ??= []).push(fn) } }, response)

  if (body !== undefined) {
    listeners.data?.forEach(fn => fn(body))
    listeners.end?.forEach(fn => fn())
  }

  return { ...res, json: () => JSON.parse(res.body) }
}

describe('эндпоинт плагина', () => {
  it('на GET отвечает каталогом локалей', () => {
    const root = fixture({ 'en/common.json': { hello: 'Hello' } })
    const res = call(root, 'GET')

    expect(res.headers['content-type']).toBe('application/json')
    expect(res.json()).toEqual({ ok: true, locales: root })
  })

  it('прочие методы отклоняет', () => {
    expect(call(fixture({}), 'DELETE').statusCode).toBe(405)
  })

  it('на POST пишет патч и называет тронутые файлы', () => {
    const root = fixture({ 'en/common.json': { hello: 'Hello' } })
    const res = call(root, 'POST', JSON.stringify({ patch: { en: { common: { bye: 'Bye' } } } }))

    expect(res.json().ok).toBe(true)
    expect(res.json().written).toEqual([join(root, 'en/common.json')])
    expect(read(root, 'en/common.json')).toEqual({ hello: 'Hello', bye: 'Bye' })
  })

  it('пустое тело — не ошибка, просто писать нечего', () => {
    expect(call(fixture({}), 'POST', '').json()).toEqual({ ok: true, written: [] })
  })

  it('на битом теле отвечает 400 и текстом ошибки, а не падает', () => {
    const res = call(fixture({}), 'POST', '{ это не json')

    expect(res.statusCode).toBe(400)
    expect(res.json().ok).toBe(false)
    expect(res.json().error).toBeTypeOf('string')
  })

  it('путь с выходом вверх отклоняется, и отказ доезжает до клиента', () => {
    const root = fixture({})
    const res = call(root, 'POST', JSON.stringify({ patch: { en: { '../../escape': { key: 'x' } } } }))

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('unsafe key path')
  })

  it('нечитаемый словарь называется по имени', () => {
    const root = fixture({})
    mkdirSync(join(root, 'en'), { recursive: true })
    writeFileSync(join(root, 'en/common.json'), '{ сломано')

    const res = call(root, 'POST', JSON.stringify({ patch: { en: { common: { key: 'x' } } } }))

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('cannot parse')
  })
})
