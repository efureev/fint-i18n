import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDevServer } from '../dev-server'

const original = globalThis.fetch

afterEach(() => { globalThis.fetch = original })

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const spy = vi.fn(async (url: string, init?: RequestInit) => handler(url, init) as any)
  globalThis.fetch = spy as any

  return spy
}

describe('клиент dev-сервера', () => {
  it('до проверки не знает, доступен ли плагин', () => {
    expect(createDevServer().available).toBeNull()
  })

  it('признаёт доступным только свой ответ', async () => {
    const bridge = createDevServer()
    mockFetch(() => ({ ok: true, json: async () => ({ ok: true, locales: '/tmp' }) }))

    expect(await bridge.probe()).toBe(true)
    expect(bridge.available).toBe(true)
  })

  it('index.html со статусом 200 за плагин не принимает', async () => {
    const bridge = createDevServer()
    // Dev-сервер без плагина отдаёт страницу на любой путь — одного `ok` мало.
    mockFetch(() => ({ ok: true, json: async () => { throw new Error('not json') } }))

    expect(await bridge.probe()).toBe(false)
  })

  it('переживает отсутствие сети и отсутствие fetch', async () => {
    const bridge = createDevServer()
    mockFetch(() => { throw new Error('connection refused') })
    expect(await bridge.probe()).toBe(false)

    // @ts-expect-error проверяем окружение без fetch
    globalThis.fetch = undefined
    expect(await createDevServer().probe()).toBe(false)
  })

  it('шлёт патч и отдаёт список записанных файлов', async () => {
    const bridge = createDevServer()
    const spy = mockFetch(() => ({ ok: true, json: async () => ({ ok: true, written: ['/loc/ru/common.json'] }) }))

    const written = await bridge.write({ ru: { common: { hello: '' } } }, { overwrite: true })

    expect(written).toEqual(['/loc/ru/common.json'])
    expect(spy).toHaveBeenCalledWith('/__fint-i18n/messages', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      patch: { ru: { common: { hello: '' } } },
      overwrite: true,
    })
  })

  it('превращает отказ плагина в исключение с его текстом', async () => {
    const bridge = createDevServer()
    mockFetch(() => ({ ok: false, json: async () => ({ ok: false, error: 'unsafe key path: ../etc' }) }))

    await expect(bridge.write({ ru: {} })).rejects.toThrow('unsafe key path')
  })

  it('слушает заданный эндпоинт', async () => {
    const bridge = createDevServer('/custom/endpoint')
    const spy = mockFetch(() => ({ ok: true, json: async () => ({ ok: true }) }))

    await bridge.probe()
    expect(spy).toHaveBeenCalledWith('/custom/endpoint')
  })
})
