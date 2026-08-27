/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { createFintI18n } from '../../core'
import { BRIDGE_KEY, createDevtools } from '../index'

/**
 * SSR и node-прогоны: `window` там нет, и devtools обязан это пережить молча.
 * Инстанс на запрос — обычное дело для сервера, и оставлять на нём глобальный
 * реестр значило бы держать в памяти каждый отрендеренный запрос.
 */
describe('devtools без window', () => {
  it('подключается, работает и не трогает глобальный объект', async () => {
    expect(typeof window).toBe('undefined')

    const devtools = createDevtools()
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: { en: { common: async () => ({ hello: 'Hello' }) } },
    })

    await i18n.loadBlock('common')

    expect(devtools.snapshot().loadedBlocks).toEqual({ en: ['common'] })
    expect(devtools.events.map(event => event.type)).toContain('blockLoadEnd')
    expect((globalThis as Record<string, unknown>)[BRIDGE_KEY]).toBeUndefined()

    i18n.dispose()
    expect((globalThis as Record<string, unknown>)[BRIDGE_KEY]).toBeUndefined()
  })
})
