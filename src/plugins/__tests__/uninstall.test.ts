import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../../core/instance'
import { BridgePlugin } from '../bridge'
import { HookLoggerPlugin } from '../hook-logger'
import { PersistencePlugin } from '../persistence'

function makeStorage(value: string | null = null) {
  return {
    getItem: vi.fn().mockReturnValue(value),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  } as unknown as Storage
}

/**
 * Плагин без снятых подписок — утечка: инстанс освобождён, а сторонний объект
 * продолжает держать на него ссылку. Проверяется через `dispose()`, который и
 * вызывает `uninstall`.
 */
describe('plugin uninstall: BridgePlugin', () => {
  it('stops syncing vue-i18n -> fint after dispose', async () => {
    const target = { locale: ref('en'), t: (key: string) => key }
    const i18n = createFintI18n({ locale: 'en', plugins: [new BridgePlugin({ i18n: target })] })

    target.locale.value = 'ru'
    await Promise.resolve()
    expect(i18n.locale.value).toBe('ru')

    i18n.dispose()

    target.locale.value = 'fr'
    await Promise.resolve()
    expect(i18n.locale.value).toBe('ru')
  })

  it('stops syncing fint -> vue-i18n after dispose', async () => {
    const target = { locale: ref('en'), t: (key: string) => key }
    const i18n = createFintI18n({ locale: 'en', plugins: [new BridgePlugin({ i18n: target })] })

    await i18n.setLocale('ru')
    expect(target.locale.value).toBe('ru')

    i18n.dispose()

    await i18n.setLocale('fr')
    expect(target.locale.value).toBe('ru')
  })

  it('stops proxying translations after dispose', () => {
    const target = { locale: ref('en'), t: (key: string) => (key === 'only.in.vue' ? 'From vue-i18n' : key) }
    const i18n = createFintI18n({ locale: 'en', plugins: [new BridgePlugin({ i18n: target })] })

    expect(i18n.t('only.in.vue')).toBe('From vue-i18n')

    i18n.dispose()

    expect(i18n.t('only.in.vue')).toBe('only.in.vue')
  })

  it('is safe to uninstall twice', () => {
    const target = { locale: ref('en'), t: (key: string) => key }
    const plugin = new BridgePlugin({ i18n: target })
    const i18n = createFintI18n({ locale: 'en', plugins: [plugin] })

    i18n.dispose()

    expect(() => plugin.uninstall()).not.toThrow()
  })
})

describe('BridgePlugin: priority and target shape', () => {
  it('lets vue-i18n override a translation fint already resolved', () => {
    const target = { locale: ref('en'), t: () => 'From vue-i18n' }
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new BridgePlugin({ i18n: target, priority: 'vue-i18n' })],
    })
    i18n.mergeMessages('en', 'common', { title: 'From fint' })

    expect(i18n.t('common.title')).toBe('From vue-i18n')
  })

  it('keeps the fint translation with the default priority', () => {
    const target = { locale: ref('en'), t: () => 'From vue-i18n' }
    const i18n = createFintI18n({ locale: 'en', plugins: [new BridgePlugin({ i18n: target })] })
    i18n.mergeMessages('en', 'common', { title: 'From fint' })

    expect(i18n.t('common.title')).toBe('From fint')
  })

  it('unwraps an object exposing `.global`', async () => {
    const global = { locale: ref('en'), t: (key: string) => key }
    const i18n = createFintI18n({ locale: 'en', plugins: [new BridgePlugin({ i18n: { global } })] })

    global.locale.value = 'ru'
    await Promise.resolve()

    expect(i18n.locale.value).toBe('ru')
  })

  // Промах в обоих словарях не должен превратиться в чужой ключ.
  it('leaves the key alone when vue-i18n does not know it either', () => {
    const target = { locale: ref('en'), t: (key: string) => key }
    const i18n = createFintI18n({ locale: 'en', plugins: [new BridgePlugin({ i18n: target })] })

    expect(i18n.t('nobody.knows')).toBe('nobody.knows')
  })
})

describe('plugin uninstall: HookLoggerPlugin', () => {
  it('stops logging after dispose', async () => {
    const logger = vi.fn()
    const i18n = createFintI18n({ locale: 'en', plugins: [new HookLoggerPlugin({ logger })] })

    await i18n.setLocale('ru')
    expect(logger).toHaveBeenCalled()

    logger.mockClear()
    i18n.dispose()

    await i18n.setLocale('fr')
    i18n.t('anything')

    expect(logger).not.toHaveBeenCalled()
  })

  it('is safe to uninstall twice', () => {
    const plugin = new HookLoggerPlugin({ logger: vi.fn() })
    const i18n = createFintI18n({ locale: 'en', plugins: [plugin] })

    i18n.dispose()

    expect(() => plugin.uninstall()).not.toThrow()
  })
})

describe('plugin uninstall: PersistencePlugin', () => {
  it('stops writing to storage after dispose', async () => {
    const setItem = vi.fn()
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage

    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new PersistencePlugin({ storage, syncTabs: false, allowedLocales: ['en', 'ru', 'fr'] })],
    })

    await i18n.setLocale('ru')
    expect(setItem).toHaveBeenCalledWith('fint-i18n-locale', 'ru')

    setItem.mockClear()
    i18n.dispose()

    await i18n.setLocale('fr')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('removes the storage listener on dispose', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const original = globalThis.window
    const storage = makeStorage()

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: { addEventListener, removeEventListener, localStorage: storage },
    })

    try {
      const i18n = createFintI18n({
        locale: 'en',
        plugins: [new PersistencePlugin({ storage, syncTabs: true, allowedLocales: ['en', 'ru'] })],
      })

      expect(addEventListener).toHaveBeenCalledWith('storage', expect.any(Function))

      i18n.dispose()

      expect(removeEventListener).toHaveBeenCalledWith('storage', addEventListener.mock.calls[0][1])
    }
    finally {
      Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: original })
    }
  })

  it('is safe to uninstall twice', () => {
    const plugin = new PersistencePlugin({ storage: makeStorage(), syncTabs: false })
    const i18n = createFintI18n({ locale: 'en', plugins: [plugin] })

    i18n.dispose()

    expect(() => plugin.uninstall()).not.toThrow()
  })
})
