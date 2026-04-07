import { describe, it, expect } from 'vitest'
import { createFintI18n } from '../instance'

describe('FintI18n Messages Debug', () => {
  it('should store messages in a nested block structure', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          common: () => Promise.resolve({ welcome: 'Welcome', user: { profile: 'Profile' } }),
          auth: () => Promise.resolve({ login: 'Login' })
        }
      }
    })

    await i18n.loadBlock('common')
    await i18n.loadBlock('auth')

    // Check 'en' locale
    expect(i18n.messages.en).toBeDefined()
    expect(i18n.messages.en.common).toBeDefined()
    expect(i18n.messages.en.auth).toBeDefined()

    // Check keys in 'common' block
    expect(Object.keys(i18n.messages.en.common)).toContain('welcome')
    expect(Object.keys(i18n.messages.en.common)).toContain('user')
    
    // Check nested keys
    const common = i18n.messages.en.common
    expect(common.user.profile).toBe('Profile')

    // Check keys in 'auth' block
    expect(Object.keys(i18n.messages.en.auth)).toContain('login')
  })

  it('should handle multiple locales and blocks correctly', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          common: () => Promise.resolve({ hi: 'Hi' })
        },
        ru: {
          common: () => Promise.resolve({ hi: 'Привет' })
        }
      }
    })

    await i18n.loadBlock('common', 'en')
    await i18n.loadBlock('common', 'ru')

    expect(Object.keys(i18n.messages)).toContain('en')
    expect(Object.keys(i18n.messages)).toContain('ru')

    expect((i18n.messages.en.common).hi).toBe('Hi')
    expect((i18n.messages.ru.common).hi).toBe('Привет')
  })
})
