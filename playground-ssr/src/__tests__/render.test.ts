import { describe, expect, it } from 'vitest'
import { hydrate } from '@feugene/fint-i18n/core'
import { render } from '../entry-server'
import { createI18n } from '../i18n'

function parsePayload(payload: string) {
  // Сервер экранирует `<`; JSON.parse понимает < как обычный символ.
  return JSON.parse(payload) as {
    i18n: { messages: Record<string, any>, blocks: Record<string, string[]> }
    app: { renderedAt: string, hydrated: boolean, serverCalls: string[] }
  }
}

describe('SSR playground: server render', () => {
  it('renders russian plural forms on the server', async () => {
    const { html } = await render('/?locale=ru')

    expect(html).toContain('SSR-витрина')
    expect(html).toContain('Отрисовано на сервере для Eugene')
    // 5 → категория `many`
    expect(html).toContain('5 товаров')
  })

  it('renders english forms for the english locale', async () => {
    const { html } = await render('/?locale=en')

    expect(html).toContain('SSR playground')
    expect(html).toContain('5 items')
  })

  it('falls back to english for an unknown locale', async () => {
    const { locale, html } = await render('/?locale=klingon')

    expect(locale).toBe('en')
    expect(html).toContain('SSR playground')
  })

  it('renders a string containing a pipe whole', async () => {
    const { html } = await render('/?locale=ru')

    expect(html).toContain('Имя | Почта | Роль')
  })

  it('loads every block the page needs, and only those', async () => {
    const { payload } = await render('/?locale=ru')
    const state = parsePayload(payload)

    expect(state.app.serverCalls.sort()).toEqual(['ru:cart', 'ru:common', 'ru:stats'])
    expect(state.i18n.blocks.ru.sort()).toEqual(['cart', 'common', 'stats'])
  })

  it('carries only the rendered locale', async () => {
    const { payload } = await render('/?locale=ru')
    const state = parsePayload(payload)

    expect(Object.keys(state.i18n.messages)).toEqual(['ru'])
  })

  it('escapes `<` so a translation cannot close the script tag', async () => {
    const { payload } = await render('/?locale=ru')

    expect(payload).not.toContain('<')
  })

  it('survives dispose(): the snapshot is taken before the instance is released', async () => {
    const { payload } = await render('/?locale=ru')
    const state = parsePayload(payload)

    expect(state.i18n.messages.ru.common.title).toBe('SSR-витрина')
    expect(state.i18n.messages.ru.cart.items.many).toBe('{n} товаров')
  })

  it('keeps parallel renders isolated', async () => {
    const [ru, en] = await Promise.all([render('/?locale=ru'), render('/?locale=en')])

    expect(Object.keys(parsePayload(ru.payload).i18n.messages)).toEqual(['ru'])
    expect(Object.keys(parsePayload(en.payload).i18n.messages)).toEqual(['en'])
    expect(ru.html).toContain('5 товаров')
    expect(en.html).toContain('5 items')
  })
})

describe('SSR playground: client hydration', () => {
  it('needs no loader after hydration', async () => {
    const { payload } = await render('/?locale=ru')
    const state = parsePayload(payload)

    const { i18n, stats } = createI18n('ru')
    hydrate(i18n, state.i18n)

    await Promise.all([i18n.loadBlock('common'), i18n.loadBlock('cart'), i18n.loadBlock('stats')])

    expect(stats.calls).toEqual([])
    expect(i18n.t('common.title')).toBe('SSR-витрина')
    expect(i18n.t('cart.items', { n: 5 })).toBe('5 товаров')
  })

  it('loads the blocks when hydration is skipped', async () => {
    const { payload } = await render('/?locale=ru&hydrate=0')
    const state = parsePayload(payload)

    expect(state.app.hydrated).toBe(false)

    const { i18n, stats } = createI18n('ru')
    await Promise.all([i18n.loadBlock('common'), i18n.loadBlock('cart'), i18n.loadBlock('stats')])

    expect(stats.calls.sort()).toEqual(['ru:cart', 'ru:common', 'ru:stats'])
  })

  it('reproduces the server output after hydration', async () => {
    const { payload } = await render('/?locale=ru')
    const state = parsePayload(payload)

    const { i18n } = createI18n('ru')
    hydrate(i18n, state.i18n)

    for (const [n, expected] of [[0, 'корзина пуста'], [1, '1 товар'], [3, '3 товара'], [5, '5 товаров']] as const) {
      expect(i18n.t('cart.items', { n })).toBe(expected)
    }
  })
})
