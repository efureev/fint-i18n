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
