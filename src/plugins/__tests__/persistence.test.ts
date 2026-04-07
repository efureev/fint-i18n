import { describe, it, expect, vi } from 'vitest'
import { createFintI18n } from '../../core/instance'
import { PersistencePlugin } from '../../plugins/persistence'

describe('PersistencePlugin', () => {
  it('should load locale from storage', () => {
    const storage = {
      getItem: vi.fn().mockReturnValue('ru'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0
    }
    
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new PersistencePlugin({ storage })]
    })
    
    expect(i18n.locale.value).toBe('ru')
  })

  it('should use a custom storage key', async () => {
    const storage = {
      getItem: vi.fn().mockReturnValue('fr'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0
    }

    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new PersistencePlugin({ storage, key: 'custom-locale-key' })]
    })

    expect(storage.getItem).toHaveBeenCalledWith('custom-locale-key')
    expect(i18n.locale.value).toBe('fr')

    await i18n.setLocale('de')

    expect(storage.setItem).toHaveBeenCalledWith('custom-locale-key', 'de')
  })

  it('should save locale to storage on change', async () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0
    }
    
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new PersistencePlugin({ storage })]
    })
    
    await i18n.setLocale('es')
    expect(storage.setItem).toHaveBeenCalledWith('fint-i18n-locale', 'es')
  })

  it('should skip persistence when storage is unavailable', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new PersistencePlugin({ storage: undefined })]
    })

    await i18n.setLocale('ru')

    expect(i18n.locale.value).toBe('ru')
  })

  it('should sync locale changes from storage events when syncTabs is enabled', async () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0
    }

    const addEventListener = vi.fn<(type: string, listener: (event: StorageEvent) => void) => void>()
    const originalWindow = globalThis.window
    const windowStub = {
      addEventListener,
      localStorage: storage
    } as unknown as Window & typeof globalThis

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: windowStub
    })

    try {
      const i18n = createFintI18n({
        locale: 'en',
        plugins: [new PersistencePlugin({ storage, syncTabs: true })]
      })

      const storageHandler = addEventListener.mock.calls[0]?.[1] as ((event: StorageEvent) => void) | undefined

      expect(addEventListener).toHaveBeenCalledWith('storage', expect.any(Function))

      storageHandler?.({
        key: 'fint-i18n-locale',
        newValue: 'pl'
      } as StorageEvent)

      expect(i18n.locale.value).toBe('pl')
    }
    finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: originalWindow
      })
    }
  })
})
