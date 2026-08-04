import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'

describe('addLoaders for a child of an already-loaded parent', () => {
  it('invokes the newly registered child loader', async () => {
    const parent = vi.fn(async () => ({ articles: { title: 'from parent bundle' } }))
    const child = vi.fn(async () => ({ title: 'from micro-frontend' }))

    const i18n = createFintI18n({ locale: 'en', loaders: { en: { pages: parent } } })

    await i18n.loadBlock('pages')
    expect(i18n.t('pages.articles.title')).toBe('from parent bundle')

    i18n.addLoaders({ en: { 'pages.articles': child } })
    await i18n.loadBlock('pages.articles')

    expect(child).toHaveBeenCalledTimes(1)
    expect(i18n.t('pages.articles.title')).toBe('from micro-frontend')
  })

  it('does not re-run the parent loader', async () => {
    const parent = vi.fn(async () => ({ articles: { title: 'parent' } }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { pages: parent } } })

    await i18n.loadBlock('pages')
    i18n.addLoaders({ en: { 'pages.articles': async () => ({ title: 'child' }) } })
    await i18n.loadBlock('pages.articles')

    expect(parent).toHaveBeenCalledTimes(1)
  })

  it('keeps a child covered by its parent when the child has no loader of its own', async () => {
    const parent = vi.fn(async () => ({ articles: { title: 'from parent' } }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { pages: parent } } })

    await i18n.loadBlock('pages')

    expect(i18n.isBlockLoaded('pages.articles')).toBe(true)
    await i18n.loadBlock('pages.articles')
    expect(parent).toHaveBeenCalledTimes(1)
  })

  it('keeps a block loaded through markBlockLoaded covered without any loader', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'pages', { articles: { title: 'injected' } })
    i18n.markBlockLoaded('pages', 'en')

    expect(i18n.isBlockLoaded('pages.articles')).toBe(true)
  })

  it('reports a child with its own loader as not loaded until it runs', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          'pages': async () => ({ articles: { title: 'parent' } }),
          'pages.articles': async () => ({ title: 'child' }),
        },
      },
    })

    await i18n.loadBlock('pages')

    expect(i18n.isBlockLoaded('pages')).toBe(true)
    expect(i18n.isBlockLoaded('pages.articles')).toBe(false)

    await i18n.loadBlock('pages.articles')
    expect(i18n.isBlockLoaded('pages.articles')).toBe(true)
  })

  it('scopes the check to the locale', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: { pages: async () => ({ articles: { title: 'en parent' } }) },
        ru: { 'pages.articles': async () => ({ title: 'ru child' }) },
      },
    })

    await i18n.loadBlock('pages', 'en')

    expect(i18n.isBlockLoaded('pages.articles', 'en')).toBe(true)
    expect(i18n.isBlockLoaded('pages.articles', 'ru')).toBe(false)
  })
})
