import { describe, expect, it } from 'vitest'
import { createFintI18n } from '../../core'
import { createDevtools } from '../index'

function setup() {
  const devtools = createDevtools(undefined, { bridge: false })
  const i18n = createFintI18n({
    locale: 'en',
    plugins: [devtools],
    loaders: { en: { common: async () => ({ hello: 'Hello', bye: 'Bye' }) } },
  })

  return { devtools, i18n }
}

describe('метрики', () => {
  it('подписчик появляется только на время сбора', () => {
    const { devtools, i18n } = setup()

    expect(devtools.metrics.enabled).toBe(false)
    expect(i18n.hooks.has('onTranslate')).toBe(false)

    devtools.metrics.enable()
    expect(devtools.metrics.enabled).toBe(true)
    expect(i18n.hooks.has('onTranslate')).toBe(true)

    // Повторное включение не должно давать второго подписчика.
    devtools.metrics.enable()

    devtools.metrics.disable()
    expect(devtools.metrics.enabled).toBe(false)
    expect(i18n.hooks.has('onTranslate')).toBe(false)
  })

  it('считает вызовы и собирает топ ключей', async () => {
    const { devtools, i18n } = setup()
    await i18n.loadBlock('common')

    devtools.metrics.enable()
    i18n.t('common.hello')
    i18n.t('common.hello')
    i18n.t('common.hello')
    i18n.t('common.bye')

    const snapshot = devtools.metrics.snapshot()

    expect(snapshot.calls).toBe(4)
    expect(snapshot.counted).toBe(4)
    expect(snapshot.distinctKeys).toBe(2)
    expect(snapshot.topKeys).toEqual([
      { key: 'common.hello', calls: 3 },
      { key: 'common.bye', calls: 1 },
    ])
  })

  it('не считает то, что случилось до включения', async () => {
    const { devtools, i18n } = setup()
    await i18n.loadBlock('common')

    i18n.t('common.hello')
    devtools.metrics.enable()
    i18n.t('common.hello')

    expect(devtools.metrics.snapshot().calls).toBe(1)
  })

  it('семплирование считает каждый N-й и пересчитывает в оценку', async () => {
    const { devtools, i18n } = setup()
    await i18n.loadBlock('common')

    devtools.metrics.enable({ sampling: 4 })
    for (let i = 0; i < 12; i++) i18n.t('common.hello')

    const snapshot = devtools.metrics.snapshot()

    expect(snapshot.sampling).toBe(4)
    expect(snapshot.counted).toBe(3)
    expect(snapshot.calls).toBe(12)
    expect(snapshot.topKeys).toEqual([{ key: 'common.hello', calls: 12 }])
  })

  it('reset обнуляет счётчики, не снимая подписку', async () => {
    const { devtools, i18n } = setup()
    await i18n.loadBlock('common')

    devtools.metrics.enable()
    i18n.t('common.hello')
    devtools.metrics.reset()

    expect(devtools.metrics.snapshot().calls).toBe(0)
    expect(devtools.metrics.enabled).toBe(true)

    i18n.t('common.bye')
    expect(devtools.metrics.snapshot().calls).toBe(1)
  })

  it('отдаёт длительности загрузок, объём словарей и число скомпилированных ключей', async () => {
    const { devtools, i18n } = setup()
    await i18n.loadBlock('common')
    i18n.t('common.hello')

    const snapshot = devtools.metrics.snapshot()

    expect(snapshot.slowestBlocks).toEqual([
      { block: 'common', locale: 'en', duration: expect.any(Number) },
    ])
    expect(snapshot.dictionaryChars.en).toBeGreaterThan(0)
    expect(snapshot.compiled).toEqual({ en: 1 })
  })

  it('отцепление снимает сбор вместе с подпиской', async () => {
    const { devtools, i18n } = setup()

    devtools.metrics.enable()
    devtools.detach()

    expect(i18n.hooks.has('onTranslate')).toBe(false)
    expect(() => devtools.metrics).toThrow('not attached')
  })

  it('не мешает режиму диагностики: подписчиков ровно столько, сколько включено', async () => {
    const { devtools, i18n } = setup()
    await i18n.loadBlock('common')

    devtools.setMode('keys')
    devtools.metrics.enable()

    // Режим подменяет вывод, метрики его считают — оба видят один и тот же вызов.
    expect(i18n.t('common.hello')).toBe('common.hello')
    expect(devtools.metrics.snapshot().calls).toBe(1)

    devtools.setMode('off')
    expect(i18n.hooks.has('onTranslate')).toBe(true)

    devtools.metrics.disable()
    expect(i18n.hooks.has('onTranslate')).toBe(false)
  })
})
