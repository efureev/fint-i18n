import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../../core/instance'
import type { FintI18n } from '../../core/instance'
import { installI18n } from '../plugin'
import { useI18nScope, useI18nScopeSync } from '../scope'
import type { I18nScope, I18nScopeSync, UseI18nScopeOptions } from '../scope'

function makeI18n() {
  return createFintI18n({
    locale: 'en',
    loaders: {
      en: {
        auth: async () => ({ login: 'Sign in', hint: 'Use {provider}' }),
        cart: async () => ({ title: 'Cart' }),
        'pages.articles': async () => ({ title: 'Articles' }),
      },
      ru: {
        auth: async () => ({ login: 'Войти', hint: 'Через {provider}' }),
        cart: async () => ({ title: 'Корзина' }),
      },
    },
  })
}

/** Смонтировать синхронный скоуп и вернуть его вместе с обёрткой. */
function mountSync(i18n: FintI18n, blocks: string | string[], options: UseI18nScopeOptions = {}) {
  let scope: I18nScopeSync

  const wrapper = mount(defineComponent({
    setup() {
      scope = useI18nScopeSync(blocks, options)
      return {}
    },
    template: '<div />',
  }), { global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] } })

  return { scope: scope!, wrapper }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 10))

describe('useI18nScope: prefix option', () => {
  it('prefixes keys with a single concrete block name', async () => {
    const i18n = makeI18n()
    const { scope } = mountSync(i18n, 'auth', { prefix: true })
    await settle()

    expect(scope.t('login')).toBe('Sign in')
    expect(scope.t('hint', { provider: 'GitHub' })).toBe('Use GitHub')
  })

  it('works for a nested block name', async () => {
    const i18n = makeI18n()
    const { scope } = mountSync(i18n, 'pages.articles', { prefix: true })
    await settle()

    expect(scope.t('title')).toBe('Articles')
  })

  // Префикс осмыслен только при одном конкретном блоке — иначе из какого
  // именно блока брать префикс, неизвестно.
  it('is ignored with a warning for several blocks', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i18n = makeI18n()

    const { scope } = mountSync(i18n, ['auth', 'cart'], { prefix: true })
    await settle()

    expect(warn.mock.calls[0][0]).toContain('`prefix` option is ignored')
    expect(scope.t('auth.login')).toBe('Sign in')
    expect(scope.t('login')).toBe('login')

    warn.mockRestore()
  })

  it('is ignored with a warning for a wildcard pattern', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i18n = makeI18n()

    const { scope } = mountSync(i18n, 'pages.*', { prefix: true })
    await settle()

    expect(warn.mock.calls.some(call => String(call[0]).includes('`prefix` option is ignored'))).toBe(true)
    expect(scope.t('pages.articles.title')).toBe('Articles')

    warn.mockRestore()
  })

  it('leaves keys untouched without the option', async () => {
    const i18n = makeI18n()
    const { scope } = mountSync(i18n, 'auth')
    await settle()

    expect(scope.t('auth.login')).toBe('Sign in')
    expect(scope.t('login')).toBe('login')
  })
})

describe('useI18nScope: usage counting', () => {
  it('registers every block on setup and releases them on unmount', async () => {
    const i18n = makeI18n()
    const register = vi.spyOn(i18n, 'registerUsage')
    const unregister = vi.spyOn(i18n, 'unregisterUsage')

    const { wrapper } = mountSync(i18n, ['auth', 'cart'])
    await settle()

    expect(register.mock.calls.map(call => call[0])).toEqual(['auth', 'cart'])
    expect(unregister).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(unregister.mock.calls.map(call => call[0])).toEqual(['auth', 'cart'])
  })

  it('unloads a block on unmount when unloadUnusedBlocks is on', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      unloadUnusedBlocks: true,
      loaders: { en: { auth: async () => ({ login: 'Sign in' }) } },
    })

    const { wrapper } = mountSync(i18n, 'auth')
    await settle()
    expect(i18n.t('auth.login')).toBe('Sign in')

    wrapper.unmount()

    expect(i18n.isBlockLoaded('auth', 'en')).toBe(false)
    expect(i18n.t('auth.login')).toBe('auth.login')
  })

  it('keeps the block while another component still uses it', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      unloadUnusedBlocks: true,
      loaders: { en: { auth: async () => ({ login: 'Sign in' }) } },
    })

    const first = mountSync(i18n, 'auth')
    const second = mountSync(i18n, 'auth')
    await settle()

    first.wrapper.unmount()
    expect(i18n.t('auth.login')).toBe('Sign in')

    second.wrapper.unmount()
    expect(i18n.t('auth.login')).toBe('auth.login')
  })
})

describe('useI18nScope: locale surface', () => {
  it('exposes a reactive locale and switches through setLocale', async () => {
    const i18n = makeI18n()
    const { scope } = mountSync(i18n, 'auth', { prefix: true })
    await settle()

    expect(scope.locale.value).toBe('en')
    expect(scope.t('login')).toBe('Sign in')

    await scope.setLocale('ru')

    expect(scope.locale.value).toBe('ru')
    expect(i18n.locale.value).toBe('ru')
    expect(scope.t('login')).toBe('Войти')
  })
})

describe('useI18nScope: async variant', () => {
  it('resolves after the blocks are loaded', async () => {
    const i18n = makeI18n()
    let scope: I18nScope

    const Component = defineComponent({
      async setup() {
        scope = await useI18nScope(['auth', 'cart'])
        return {}
      },
      template: '<div />',
    })

    mount(defineComponent({
      components: { Component },
      template: '<Suspense><Component /></Suspense>',
    }), { global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] } })

    await settle()

    expect(scope!.t('auth.login')).toBe('Sign in')
    expect(scope!.t('cart.title')).toBe('Cart')
  })

  it('accepts a single block name as a bare string', async () => {
    const i18n = makeI18n()
    const { scope } = mountSync(i18n, 'cart')
    await settle()

    expect(scope.ready.value).toBe(true)
    expect(scope.t('cart.title')).toBe('Cart')
  })
})
