import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../../core'
import { BRIDGE_KEY, createDevtools } from '../index'
import type { DevtoolsBridge } from '../index'

function bridge(): (DevtoolsBridge & { entries: unknown[] }) | undefined {
  return (window as any)[BRIDGE_KEY]
}

afterEach(() => {
  delete (window as any)[BRIDGE_KEY]
})

describe('createDevtools: теневое состояние и лента', () => {
  it('отражает загрузку блока, смену локали и промах ключа', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: {
        en: { common: async () => ({ hello: 'Hello' }) },
        ru: { common: async () => ({ hello: 'Привет' }) },
      },
    })

    await i18n.loadBlock('common')
    i18n.t('common.nope')
    await i18n.setLocale('ru')

    const snapshot = devtools.snapshot()

    expect(snapshot.locale).toBe('ru')
    expect(snapshot.loadedBlocks).toEqual({ en: ['common'] })
    expect(snapshot.blocks).toEqual([
      { block: 'common', locale: 'en', status: 'loaded', duration: expect.any(Number), resolvedAs: undefined, error: undefined },
    ])
    expect(snapshot.missingKeys).toEqual([{ key: 'common.nope', locale: 'en', count: 1 }])
    expect(snapshot.registeredBlocks).toEqual(['common'])
    expect(snapshot.plugins).toEqual(['devtools'])
    expect(snapshot.messages).toEqual({ en: { common: 1 } })

    // Порядок событий — это и есть главная ценность ленты.
    expect(devtools.events.map(event => event.type)).toEqual([
      'init',
      'blockRequested',
      'blockLoadStart',
      'messagesMerged',
      'blockLoadEnd',
      'missingKey',
      'localeChange',
    ])
  })

  it('считает длительность загрузки по паре блок + локаль, а не по имени', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({
      locale: 'ru',
      fallbackLocale: 'en',
      preloadFallback: true,
      plugins: [devtools],
      loaders: {
        ru: { auth: async () => ({ login: 'Войти' }) },
        en: { auth: async () => ({ login: 'Sign in' }) },
      },
    })

    await i18n.loadBlock('auth')

    const loaded = devtools.snapshot().blocks
    expect(loaded).toHaveLength(2)
    expect(loaded.map(block => block.locale).sort()).toEqual(['en', 'ru'])
    for (const block of loaded) {
      expect(block.status).toBe('loaded')
      expect(block.duration).toEqual(expect.any(Number))
    }
  })

  it('видит имя блока, который отработал вместо запрошенного', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: { en: { pages: async () => ({ articles: { title: 'Articles' } }) } },
    })

    await i18n.loadBlock('pages.articles')

    expect(devtools.snapshot().blocks).toEqual([
      { block: 'pages.articles', locale: 'en', status: 'loaded', duration: expect.any(Number), resolvedAs: 'pages', error: undefined },
    ])
  })

  it('помечает блок отказавшим и кладёт причину', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const devtools = createDevtools()
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: { en: { bad: async () => { throw new Error('boom') } } },
    })

    await expect(i18n.loadBlock('bad')).rejects.toThrow('boom')
    error.mockRestore()

    expect(devtools.snapshot().blocks).toEqual([
      { block: 'bad', locale: 'en', status: 'failed', duration: expect.any(Number), error: 'boom' },
    ])
    expect(devtools.events.map(event => event.type)).toContain('error')
  })

  it('показывает блоки, загруженные до подключения — это случай гидрации', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { common: async () => ({ hello: 'Hello' }) } },
    })
    await i18n.loadBlock('common')

    const devtools = createDevtools(i18n, { bridge: false })
    const snapshot = devtools.snapshot()

    // Длительности у такого блока нет и взяться ей неоткуда: загрузка прошла
    // мимо devtools. Но в таблице он обязан быть, иначе панель врёт.
    expect(snapshot.blocks).toEqual([{ block: 'common', locale: 'en', status: 'loaded' }])
    expect(snapshot.messages).toEqual({ en: { common: 1 } })
  })

  it('дедуплицирует промахи и фолбэки: в ленте первый, в снимке счётчик', () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'common', { only: 'English only' })

    i18n.t('common.only')
    i18n.t('common.only')
    i18n.t('common.only')

    expect(devtools.snapshot().fallbacks).toEqual([
      { key: 'common.only', locale: 'ru', fallbackLocale: 'en', count: 3 },
    ])
    expect(devtools.events.filter(event => event.type === 'fallback')).toHaveLength(1)
  })

  it('пишет предупреждения инстанса', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools], loaders: { en: {} } })

    await i18n.loadBlock('nope')

    expect(devtools.snapshot().warnings).toEqual([
      {
        code: 'no-loader',
        message: 'No loader for block "nope" in locale "en"',
        context: { block: 'nope', locale: 'en' },
        count: 1,
      },
    ])
  })

  it('ограничивает ленту заданным лимитом', () => {
    const devtools = createDevtools(undefined, { eventLimit: 3, bridge: false })
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })

    for (let i = 0; i < 10; i++) i18n.mergeMessages('en', `block${i}`, { k: 'v' })

    expect(devtools.events).toHaveLength(3)
    expect((devtools.events[2].payload as any).block).toBe('block9')
  })
})

describe('createDevtools: отцепление', () => {
  it('возвращает исходные ссылки на обёрнутые методы', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const before = {
      registerUsage: i18n.registerUsage,
      unregisterUsage: i18n.unregisterUsage,
      loadBlock: i18n.loadBlock,
      unloadBlock: i18n.unloadBlock,
      mergeMessages: i18n.mergeMessages,
      addLoaders: i18n.addLoaders,
      dispose: i18n.dispose,
    }

    const devtools = createDevtools(i18n)
    expect(i18n.mergeMessages).not.toBe(before.mergeMessages)

    devtools.detach()

    for (const [method, original] of Object.entries(before)) {
      expect((i18n as any)[method]).toBe(original)
    }
  })

  it('снимает подписки: после detach лента не растёт', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const devtools = createDevtools(i18n)

    i18n.mergeMessages('en', 'a', { k: 'v' })
    const before = devtools.events.length

    devtools.detach()
    i18n.mergeMessages('en', 'b', { k: 'v' })
    i18n.t('a.nope')

    expect(devtools.events).toHaveLength(before)
    expect(i18n.hooks.has('onMissingKey')).toBe(false)
  })

  it('dispose() инстанса отцепляет devtools через uninstall', () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })

    i18n.dispose()

    expect(devtools.events.map(event => event.type)).toContain('dispose')
    expect(() => devtools.snapshot()).toThrow('not attached')
  })
})

describe('createDevtools: мост в window', () => {
  it('публикует инстанс и отдаёт снимок по имени', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: { en: { common: async () => ({ hello: 'Hello' }) } },
    })

    expect(bridge()!.list()).toEqual(['i18n'])
    expect(bridge()!.version).toBe(devtools.snapshot().version)
    expect(bridge()!.snapshot()!.locale).toBe('en')

    const waiting = bridge()!.waitFor('common', 'en')
    await i18n.loadBlock('common')
    await expect(waiting).resolves.toBeUndefined()

    // Загруженный блок ждать не нужно — резолвится сразу.
    await expect(bridge()!.waitFor('common', 'en')).resolves.toBeUndefined()
  })

  it('два инстанса не видят состояние друг друга, а после dispose реестр их не держит', async () => {
    const first = createDevtools()
    const second = createDevtools(undefined, { name: 'second' })

    const a = createFintI18n({ locale: 'en', plugins: [first], loaders: { en: { a: async () => ({ k: 'A' }) } } })
    const b = createFintI18n({ locale: 'ru', plugins: [second], loaders: { ru: { b: async () => ({ k: 'B' }) } } })

    await a.loadBlock('a')

    expect(bridge()!.list()).toEqual(['i18n', 'second'])
    expect(bridge()!.snapshot('i18n')!.locale).toBe('en')
    expect(bridge()!.snapshot('second')!.locale).toBe('ru')
    expect(second.snapshot().blocks).toEqual([])

    a.dispose()

    expect(bridge()!.list()).toEqual(['second'])
    expect(bridge()!.snapshot('i18n')).toBeNull()

    b.dispose()
    expect(bridge()!.list()).toEqual([])
  })

  it('не публикуется, когда мост выключен опцией', () => {
    const devtools = createDevtools(undefined, { bridge: false })
    createFintI18n({ locale: 'en', plugins: [devtools] })

    expect(bridge()).toBeUndefined()
  })
})
