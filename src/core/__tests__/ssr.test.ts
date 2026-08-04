import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'
import { getSSRState, hydrate } from '../ssr'

function makeServerInstance() {
  return createFintI18n({
    locale: 'en',
    loaders: {
      en: {
        auth: async () => ({ login: 'Log in', hello: 'Hi, {name}!' }),
        cart: async () => ({ items: { one: '{n} item', other: '{n} items' } }),
        unused: async () => ({ k: 'never loaded' }),
      },
      ru: { auth: async () => ({ login: 'Войти', hello: 'Привет, {name}!' }) },
    },
  })
}

describe('getSSRState', () => {
  it('captures loaded messages and block names', async () => {
    const i18n = makeServerInstance()
    await i18n.loadBlock('auth')
    await i18n.loadBlock('cart')

    const state = getSSRState(i18n)

    expect(state.messages.en).toEqual({
      auth: { login: 'Log in', hello: 'Hi, {name}!' },
      cart: { items: { one: '{n} item', other: '{n} items' } },
    })
    expect(state.blocks.en.sort()).toEqual(['auth', 'cart'])
  })

  it('omits blocks that were never loaded', async () => {
    const i18n = makeServerInstance()
    await i18n.loadBlock('auth')

    const state = getSSRState(i18n)

    expect(state.messages.en.unused).toBeUndefined()
    expect(state.blocks.en).toEqual(['auth'])
  })

  it('returns a plain, JSON-safe tree', async () => {
    const i18n = makeServerInstance()
    await i18n.loadBlock('auth')

    const state = getSSRState(i18n)
    const roundTripped = JSON.parse(JSON.stringify(state))

    expect(roundTripped).toEqual(state)
  })

  it('can be narrowed to specific locales', async () => {
    const i18n = makeServerInstance()
    await i18n.loadBlock('auth', 'en')
    await i18n.loadBlock('auth', 'ru')

    const state = getSSRState(i18n, { locales: ['ru'] })

    expect(Object.keys(state.messages)).toEqual(['ru'])
    expect(Object.keys(state.blocks)).toEqual(['ru'])
  })

  it('warns about message functions that JSON cannot carry', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'a', { fn: ((p: any) => `x${p?.n}`) as any, plain: 'ok' })

    getSSRState(i18n)

    expect(warn.mock.calls[0][0]).toContain('message functions')
    expect(warn.mock.calls[0][0]).toContain('en.a.fn')

    warn.mockRestore()
  })

  it('stays silent when everything is serialisable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i18n = makeServerInstance()
    await i18n.loadBlock('auth')

    getSSRState(i18n)

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('is empty for an instance that loaded nothing', () => {
    const state = getSSRState(createFintI18n({ locale: 'en' }))

    expect(state).toEqual({ messages: {}, blocks: {} })
  })
})

describe('hydrate', () => {
  async function transferredState() {
    const server = makeServerInstance()
    await server.loadBlock('auth')
    await server.loadBlock('cart')
    // Через JSON — ровно так состояние и доедет до клиента.
    return JSON.parse(JSON.stringify(getSSRState(server)))
  }

  it('restores translations without touching the loaders', async () => {
    const state = await transferredState()

    const loader = vi.fn(async () => ({ login: 'should not be called' }))
    const client = createFintI18n({ locale: 'en', loaders: { en: { auth: loader } } })

    hydrate(client, state)
    await client.loadBlock('auth')

    expect(loader).not.toHaveBeenCalled()
    expect(client.t('auth.login')).toBe('Log in')
    expect(client.t('auth.hello', { name: 'Alex' })).toBe('Hi, Alex!')
  })

  it('restores plural forms', async () => {
    const state = await transferredState()
    const client = createFintI18n({ locale: 'en' })

    hydrate(client, state)

    expect(client.t('cart.items', { n: 1 })).toBe('1 item')
    expect(client.t('cart.items', { n: 5 })).toBe('5 items')
  })

  it('marks the blocks as loaded', async () => {
    const state = await transferredState()
    const client = createFintI18n({ locale: 'en' })

    hydrate(client, state)

    expect(client.isBlockLoaded('auth')).toBe(true)
    expect(client.isBlockLoaded('cart')).toBe(true)
    expect(client.isBlockLoaded('unused')).toBe(false)
  })

  it('still loads blocks the server did not render', async () => {
    const state = await transferredState()
    const loader = vi.fn(async () => ({ k: 'loaded on client' }))
    const client = createFintI18n({ locale: 'en', loaders: { en: { later: loader } } })

    hydrate(client, state)
    await client.loadBlock('later')

    expect(loader).toHaveBeenCalledTimes(1)
    expect(client.t('later.k')).toBe('loaded on client')
  })

  it('keeps locales separate', async () => {
    const server = makeServerInstance()
    await server.loadBlock('auth', 'en')
    await server.loadBlock('auth', 'ru')
    const state = JSON.parse(JSON.stringify(getSSRState(server)))

    const client = createFintI18n({ locale: 'ru' })
    hydrate(client, state)

    expect(client.t('auth.login')).toBe('Войти')
    expect(client.isBlockLoaded('auth', 'en')).toBe(true)
    expect(client.isBlockLoaded('auth', 'ru')).toBe(true)
  })

  it('does not alias the payload into the store', async () => {
    const state = await transferredState()
    const client = createFintI18n({ locale: 'en' })

    hydrate(client, state)
    state.messages.en.auth.login = 'mutated after hydration'

    expect(client.t('auth.login')).toBe('Log in')
  })

  it('survives an empty state', () => {
    const client = createFintI18n({ locale: 'en' })

    expect(() => hydrate(client, { messages: {}, blocks: {} })).not.toThrow()
    expect(client.t('a.b')).toBe('a.b')
  })

  it('round-trips through a second snapshot unchanged', async () => {
    const state = await transferredState()
    const client = createFintI18n({ locale: 'en' })

    hydrate(client, state)

    expect(getSSRState(client)).toEqual(state)
  })
})
