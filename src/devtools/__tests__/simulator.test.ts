import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../../core'
import { createDevtools } from '../index'

// Отказы здесь намеренные, а необработанный отказ уходит в `onError` и без
// подписчика печатается в консоль. Глушим, чтобы ожидаемое не выглядело поломкой.
let errorLog: ReturnType<typeof vi.spyOn>

beforeEach(() => { errorLog = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { errorLog.mockRestore() })

function setup(options: Parameters<typeof createFintI18n>[0] = { locale: 'en' }) {
  const loader = vi.fn(async () => ({ hello: 'Hello' }))
  const devtools = createDevtools(undefined, { bridge: false })
  const i18n = createFintI18n({
    ...options,
    plugins: [devtools],
    loaders: { en: { common: loader }, ru: { common: loader } },
  })

  return { devtools, i18n, loader }
}

describe('симулятор лоадеров', () => {
  it('по умолчанию выключен и ничего не ломает', async () => {
    const { devtools, i18n } = setup()

    expect(devtools.simulator.active).toBe(false)

    await i18n.loadBlock('common')
    expect(i18n.t('common.hello')).toBe('Hello')
  })

  it('роняет загрузку блока настоящим путём — через onError', async () => {
    const { devtools, i18n } = setup()
    const onError = vi.fn()
    i18n.hooks.on('onError', onError)

    devtools.simulator.start({ failureRate: 1 })

    await expect(i18n.loadBlock('common')).rejects.toThrow('simulated failure')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(i18n.isBlockLoaded('common')).toBe(false)
  })

  it('не трогает настоящие сообщения: после остановки блок грузится как обычно', async () => {
    const { devtools, i18n } = setup()

    devtools.simulator.start({ failureRate: 1 })
    await expect(i18n.loadBlock('common')).rejects.toThrow()

    devtools.simulator.stop()
    await i18n.loadBlock('common')

    expect(i18n.t('common.hello')).toBe('Hello')
    expect(devtools.simulator.active).toBe(false)
  })

  it('ограничивается перечисленными блоками', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const devtools = createDevtools(undefined, { bridge: false })
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: { en: { common: loader, auth: loader } },
    })

    devtools.simulator.start({ failureRate: 1, blocks: ['auth'] })

    await expect(i18n.loadBlock('auth')).rejects.toThrow('simulated failure')
    await i18n.loadBlock('common')
    expect(i18n.t('common.k')).toBe('v')
  })

  it('отказывает первые K попыток, а дальше пропускает — это и есть повторы', async () => {
    const { devtools, i18n } = setup({
      locale: 'en',
      retry: { attempts: 3, backoff: () => 0 },
    })

    const onRetry = vi.fn()
    i18n.hooks.on('onRetry', onRetry)

    devtools.simulator.start({ failAttempts: 2 })
    await i18n.loadBlock('common')

    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(i18n.t('common.hello')).toBe('Hello')
  })

  it('задержка отодвигает загрузку, а не подменяет её', async () => {
    const { devtools, i18n } = setup()

    devtools.simulator.start({ delay: 60 })

    const startedAt = Date.now()
    await i18n.loadBlock('common')

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(50)
    expect(i18n.t('common.hello')).toBe('Hello')
  })

  it('счётчик попыток обнуляется при новом запуске', async () => {
    const { devtools, i18n } = setup({
      locale: 'en',
      retry: { attempts: 2, backoff: () => 0 },
    })

    devtools.simulator.start({ failAttempts: 1 })
    await i18n.loadBlock('common')
    expect(i18n.t('common.hello')).toBe('Hello')

    i18n.unloadBlock('common')
    devtools.simulator.start({ failAttempts: 1 })

    const onRetry = vi.fn()
    i18n.hooks.on('onRetry', onRetry)
    await i18n.loadBlock('common')

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('отцепление снимает симуляцию', () => {
    const { devtools } = setup()

    devtools.simulator.start({ failureRate: 1 })
    devtools.detach()

    expect(() => devtools.simulator).toThrow('not attached')
  })
})
