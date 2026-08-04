import { describe, expect, it } from 'vitest'
import { createFintI18n } from '../instance'

describe('compilation cache invalidation', () => {
  it('drops a re-merged block and keeps the rest', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'a', { k: 'a first' })
    i18n.mergeMessages('en', 'b', { k: 'b first' })
    expect(i18n.t('a.k')).toBe('a first')
    expect(i18n.t('b.k')).toBe('b first')

    i18n.mergeMessages('en', 'a', { k: 'a second' })

    expect(i18n.t('a.k')).toBe('a second')
    expect(i18n.t('b.k')).toBe('b first')
  })

  it('drops nested keys of a re-merged block', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'pages', { articles: { title: 'first', sub: { deep: 'first deep' } } })
    expect(i18n.t('pages.articles.title')).toBe('first')
    expect(i18n.t('pages.articles.sub.deep')).toBe('first deep')

    i18n.mergeMessages('en', 'pages', { articles: { title: 'second', sub: { deep: 'second deep' } } })

    expect(i18n.t('pages.articles.title')).toBe('second')
    expect(i18n.t('pages.articles.sub.deep')).toBe('second deep')
  })

  it('drops only the merged subtree, not its siblings under the same root', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'pages', { articles: { t: 'articles first' }, profile: { t: 'profile first' } })
    expect(i18n.t('pages.articles.t')).toBe('articles first')
    expect(i18n.t('pages.profile.t')).toBe('profile first')

    i18n.mergeMessages('en', 'pages.articles', { t: 'articles second' })

    expect(i18n.t('pages.articles.t')).toBe('articles second')
    expect(i18n.t('pages.profile.t')).toBe('profile first')
  })

  it('keeps locales independent', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'a', { k: 'en first' })
    i18n.mergeMessages('ru', 'a', { k: 'ru first' })
    expect(i18n.t('a.k')).toBe('en first')

    i18n.mergeMessages('en', 'a', { k: 'en second' })

    expect(i18n.t('a.k')).toBe('en second')
    expect(i18n.t('a.k', undefined, { fallbackLocale: 'ru' })).toBe('en second')
  })

  it('invalidates a plural form set on re-merge', () => {
    const i18n = createFintI18n({ locale: 'ru' })

    i18n.mergeMessages('ru', 'cart', { items: { one: '{n} товар', other: '{n} товара' } })
    expect(i18n.t('cart.items', { n: 1 })).toBe('1 товар')

    i18n.mergeMessages('ru', 'cart', { items: { one: '{n} штука', other: '{n} штуки' } })

    expect(i18n.t('cart.items', { n: 1 })).toBe('1 штука')
  })

  it('invalidates on unloadBlock so a reload sees fresh messages', async () => {
    let generation = 0
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({ k: `gen ${++generation}` }) } },
    })

    await i18n.loadBlock('a')
    expect(i18n.t('a.k')).toBe('gen 1')

    i18n.unloadBlock('a')
    await i18n.loadBlock('a')

    expect(i18n.t('a.k')).toBe('gen 2')
  })

  it('handles a top-level key with no dot', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'title', 'first')
    expect(i18n.t('title')).toBe('first')

    i18n.mergeMessages('en', 'title', 'second')
    expect(i18n.t('title')).toBe('second')
  })
})
