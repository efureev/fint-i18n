import { createSSRApp, defineComponent, h, resolveDirective, withDirectives } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../../core/instance'
import { getSSRState, hydrate } from '../../core/ssr'
import { installI18n } from '../plugin'
import { useI18nScope } from '../scope'

const loaders = {
  en: {
    auth: async () => ({ title: 'Sign in', greeting: 'Hi, {name}!' }),
    cart: async () => ({ items: { one: '{n} item', other: '{n} items' } }),
  },
  ru: {
    auth: async () => ({ title: 'Вход', greeting: 'Привет, {name}!' }),
    cart: async () => ({ items: { one: '{n} товар', few: '{n} товара', many: '{n} товаров', other: '{n} товара' } }),
  },
}

const Page = defineComponent({
  async setup() {
    const { t } = await useI18nScope(['auth', 'cart'])
    return () => h('div', [
      h('h1', t('auth.title')),
      h('p', t('auth.greeting', { name: 'Alex' })),
      h('span', t('cart.items', { n: 5 })),
    ])
  },
})

async function renderOnServer(locale: string) {
  const i18n = createFintI18n({ locale, loaders })
  const app = createSSRApp({ setup: () => () => h(Page) })
  installI18n(app, i18n)

  const html = await renderToString(app)
  // Ровно так состояние доедет до клиента: через JSON в разметке.
  const payload = JSON.parse(JSON.stringify(getSSRState(i18n)))

  return { html, payload }
}

describe('SSR round trip', () => {
  it('renders on the server and needs no loader on the client', async () => {
    const { html, payload } = await renderOnServer('ru')

    expect(html).toContain('Вход')
    expect(html).toContain('Привет, Alex!')
    expect(html).toContain('5 товаров')

    const clientLoaders = {
      ru: {
        auth: vi.fn(async () => ({ title: 'должен остаться невызванным' })),
        cart: vi.fn(async () => ({ items: { other: 'то же' } })),
      },
    }
    const client = createFintI18n({ locale: 'ru', loaders: clientLoaders })
    hydrate(client, payload)

    // Скоуп на клиенте запрашивает те же блоки — они уже помечены загруженными.
    await client.loadBlock('auth')
    await client.loadBlock('cart')

    expect(clientLoaders.ru.auth).not.toHaveBeenCalled()
    expect(clientLoaders.ru.cart).not.toHaveBeenCalled()
    expect(client.t('auth.title')).toBe('Вход')
    expect(client.t('cart.items', { n: 5 })).toBe('5 товаров')
  })

  it('produces the same markup on the client after hydration', async () => {
    const { html, payload } = await renderOnServer('ru')

    const client = createFintI18n({ locale: 'ru', loaders })
    hydrate(client, payload)

    const clientApp = createSSRApp({ setup: () => () => h(Page) })
    installI18n(clientApp, client)
    const clientHtml = await renderToString(clientApp)

    expect(clientHtml).toBe(html)
  })

  it('keeps parallel requests isolated', async () => {
    const [en, ru] = await Promise.all([renderOnServer('en'), renderOnServer('ru')])

    expect(en.html).toContain('Sign in')
    expect(ru.html).toContain('Вход')
    expect(Object.keys(en.payload.messages)).toEqual(['en'])
    expect(Object.keys(ru.payload.messages)).toEqual(['ru'])
  })

  it('carries only the locale that was rendered', async () => {
    const { payload } = await renderOnServer('en')

    expect(payload.messages.ru).toBeUndefined()
    expect(payload.blocks.en.sort()).toEqual(['auth', 'cart'])
  })

  it('renders v-t on the server through getSSRProps', async () => {
    const i18n = createFintI18n({ locale: 'ru', loaders })
    await i18n.loadBlock('auth')

    const Component = defineComponent({
      setup: () => () => withDirectives(h('span'), [[resolveDirective('t')!, 'auth.title']]),
    })
    const app = createSSRApp({ setup: () => () => h(Component) })
    installI18n(app, i18n)

    const html = await renderToString(app)

    expect(html).toContain('Вход')
  })
})
