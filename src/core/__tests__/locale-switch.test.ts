import { describe, it, expect, vi } from 'vitest'
import { FintI18n } from '../instance'

describe('FintI18n Locale Switching', () => {
  it('should switch locale and update translations', async () => {
    const i18n = new FintI18n({
      locale: 'en',
      loaders: {
        en: {
          common: async () => ({ welcome: 'Welcome' })
        },
        ru: {
          common: async () => ({ welcome: 'Добро пожаловать' })
        }
      }
    })

    await i18n.loadBlock('common')
    expect(i18n.t('common.welcome')).toBe('Welcome')

    i18n.registerUsage('common')
    await i18n.setLocale('ru')
    expect(i18n.locale.value).toBe('ru')
    
    expect(i18n.t('common.welcome')).toBe('Добро пожаловать')
  })

  it('should load blocks when locale.value is changed directly', async () => {
    const i18n = new FintI18n({
      locale: 'en',
      loaders: {
        en: { common: async () => ({ welcome: 'Welcome' }) },
        ru: { common: async () => ({ welcome: 'Привет' }) }
      }
    })

    i18n.registerUsage('common')
    await i18n.loadBlock('common')
    
    i18n.locale.value = 'ru'
    
    // Дождемся загрузки блока
    await new Promise(resolve => i18n.hooks.on('afterLoadBlock', resolve))
    
    expect(i18n.t('common.welcome')).toBe('Привет')
  })

  it('should emit onLocaleChange hook', async () => {
    const i18n = new FintI18n({ locale: 'en' })
    const spy = vi.fn()
    i18n.hooks.on('onLocaleChange', spy)

    await i18n.setLocale('ru')
    expect(spy).toHaveBeenCalledWith({ locale: 'ru', previous: 'en' })
  })

  it('should keep the current locale until used blocks for the next locale are loaded', async () => {
    let resolveRuCommon: ((value: { welcome: string }) => void) | undefined

    const i18n = new FintI18n({
      locale: 'en',
      fallbackLocale: 'en',
      loaders: {
        en: {
          common: async () => ({ welcome: 'Welcome' }),
        },
        ru: {
          common: () => new Promise(resolve => {
            resolveRuCommon = resolve
          }),
        },
      },
    })
    const onLocaleChange = vi.fn()

    i18n.hooks.on('onLocaleChange', onLocaleChange)
    i18n.registerUsage('common')
    await i18n.loadBlock('common')

    const switchPromise = i18n.setLocale('ru')

    await Promise.resolve()

    expect(i18n.locale.value).toBe('en')
    expect(i18n.t('common.welcome')).toBe('Welcome')
    expect(onLocaleChange).not.toHaveBeenCalled()

    resolveRuCommon?.({ welcome: 'Добро пожаловать' })
    await switchPromise

    expect(i18n.locale.value).toBe('ru')
    expect(i18n.t('common.welcome')).toBe('Добро пожаловать')
    expect(onLocaleChange).toHaveBeenCalledWith({ locale: 'ru', previous: 'en' })
  })
})
