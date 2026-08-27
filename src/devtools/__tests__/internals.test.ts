import { describe, expect, it } from 'vitest'
import { createFintI18n } from '../../core'
import {
  readCompiledCounts,
  readDisposed,
  readOptions,
  readPluginNames,
  readRegisteredBlocks,
  readUsageCounters,
} from '../internals'

/**
 * Контрактный тест на приватные поля `FintI18n`.
 *
 * Devtools читает их, потому что публичного пути к ним нет, а заводить геттеры
 * в ядре значило бы брать байты со всех потребителей. Плата за это — вот такой
 * тест: переименовали поле — он падает здесь, а не тихо гасит половину панели.
 * Если он упал, чинить нужно `src/devtools/internals.ts`, а не отключать его.
 */
describe('internals: контракт с приватными полями FintI18n', () => {
  function instance() {
    return createFintI18n({
      locale: 'en',
      fallbackLocale: 'ru',
      preloadFallback: true,
      unloadUnusedBlocks: true,
      retry: { attempts: 2 },
      loaders: { en: { common: async () => ({ k: 'v' }) }, ru: { common: async () => ({ k: 'v' }) } },
    })
  }

  it('loaderRegistry отдаёт имена зарегистрированных блоков', () => {
    expect(readRegisteredBlocks(instance())).toEqual(['common'])
  })

  it('опции инстанса читаются', () => {
    expect(readOptions(instance())).toEqual({
      fallbackLocale: 'ru',
      preloadFallback: true,
      unloadUnusedBlocks: true,
      retry: { attempts: 2 },
    })
  })

  it('installedPlugins отдаёт имена', () => {
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [{ name: 'probe', install: () => {} }],
    })

    expect(readPluginNames(i18n)).toEqual(['probe'])
  })

  it('disposed отражает освобождение', () => {
    const i18n = instance()
    expect(readDisposed(i18n)).toBe(false)

    i18n.dispose()
    expect(readDisposed(i18n)).toBe(true)
  })

  it('blockUsageCounters отдаёт счётчики использований', () => {
    const i18n = instance()
    i18n.registerUsage('common')
    i18n.registerUsage('common')

    expect(readUsageCounters(i18n)).toEqual({ common: 2 })
  })

  it('compiledMessages отдаёт число скомпилированных ключей по локалям', async () => {
    const i18n = instance()
    await i18n.loadBlock('common')

    expect(readCompiledCounts(i18n)).toEqual({})

    i18n.t('common.k')
    expect(readCompiledCounts(i18n)).toEqual({ en: 1 })
  })

  it('каждое чтение переживает объект без нужных полей', () => {
    const alien = { fallbackLocale: '' } as any

    expect(readRegisteredBlocks(alien)).toBeNull()
    expect(readOptions(alien)).toBeNull()
    expect(readPluginNames(alien)).toBeNull()
    expect(readUsageCounters(alien)).toBeNull()
    expect(readCompiledCounts(alien)).toBeNull()
    expect(readDisposed(alien)).toBe(false)
  })
})
