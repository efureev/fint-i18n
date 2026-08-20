import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'

function loaders() {
  return {
    en: { auth: vi.fn(async () => ({ login: 'Sign in', only: { en: 'English only' } })) },
    ru: { auth: vi.fn(async () => ({ login: 'Войти' })) },
  }
}

/**
 * `preloadFallback` — единственный способ получить fallback на **не загруженный**
 * блок: обычный fallback работает только по уже смерженным сообщениям.
 */
describe('preloadFallback', () => {
  it('loads the block for the fallback locale as well', async () => {
    const source = loaders()
    const i18n = createFintI18n({
      locale: 'ru',
      fallbackLocale: 'en',
      preloadFallback: true,
      loaders: source,
    })

    await i18n.loadBlock('auth')

    expect(source.ru.auth).toHaveBeenCalledTimes(1)
    expect(source.en.auth).toHaveBeenCalledTimes(1)
    expect(i18n.isBlockLoaded('auth', 'ru')).toBe(true)
    expect(i18n.isBlockLoaded('auth', 'en')).toBe(true)
  })

  it('is what makes a key missing in the current locale resolve', async () => {
    const i18n = createFintI18n({
      locale: 'ru',
      fallbackLocale: 'en',
      preloadFallback: true,
      loaders: loaders(),
    })

    await i18n.loadBlock('auth')

    expect(i18n.t('auth.login')).toBe('Войти')
    // Ключа нет в `ru` — он приходит из предзагруженного `en`.
    expect(i18n.t('auth.only.en')).toBe('English only')
  })

  it('leaves the fallback block unloaded without the option', async () => {
    const source = loaders()
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'en', loaders: source })

    await i18n.loadBlock('auth')

    expect(source.ru.auth).toHaveBeenCalledTimes(1)
    expect(source.en.auth).not.toHaveBeenCalled()
    expect(i18n.t('auth.only.en')).toBe('auth.only.en')
  })

  it('does not load twice when the fallback is the current locale', async () => {
    const source = loaders()
    const i18n = createFintI18n({
      locale: 'en',
      fallbackLocale: 'en',
      preloadFallback: true,
      loaders: source,
    })

    await i18n.loadBlock('auth')

    expect(source.en.auth).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a fallback locale', async () => {
    const source = loaders()
    const i18n = createFintI18n({ locale: 'ru', preloadFallback: true, loaders: source })

    await i18n.loadBlock('auth')

    expect(source.ru.auth).toHaveBeenCalledTimes(1)
    expect(source.en.auth).not.toHaveBeenCalled()
  })

  it('preloads for an explicitly requested locale too', async () => {
    const source = loaders()
    const i18n = createFintI18n({
      locale: 'en',
      fallbackLocale: 'en',
      preloadFallback: true,
      loaders: source,
    })

    await i18n.loadBlock('auth', 'ru')

    expect(source.ru.auth).toHaveBeenCalledTimes(1)
    expect(source.en.auth).toHaveBeenCalledTimes(1)
  })

  it('survives a fallback loader that is missing entirely', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ru = vi.fn(async () => ({ login: 'Войти' }))
    const i18n = createFintI18n({
      locale: 'ru',
      fallbackLocale: 'de',
      preloadFallback: true,
      loaders: { ru: { auth: ru } },
    })

    await i18n.loadBlock('auth')

    expect(ru).toHaveBeenCalledTimes(1)
    expect(i18n.t('auth.login')).toBe('Войти')

    warn.mockRestore()
  })

  it('preloads through setLocale for blocks already in use', async () => {
    const source = loaders()
    const i18n = createFintI18n({
      locale: 'en',
      fallbackLocale: 'en',
      preloadFallback: true,
      loaders: source,
    })

    i18n.registerUsage('auth')
    await i18n.loadUsedBlocks('en')
    source.en.auth.mockClear()

    await i18n.setLocale('ru')

    expect(i18n.locale.value).toBe('ru')
    expect(source.ru.auth).toHaveBeenCalledTimes(1)
    expect(i18n.t('auth.login')).toBe('Войти')
  })
})
