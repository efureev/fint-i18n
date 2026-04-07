import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FintI18n } from '../instance'

describe('Deep JSON and Partial Loading', () => {
  let i18n: FintI18n

  beforeEach(() => {
    i18n = new FintI18n({
      locale: 'en',
    })
  })

  it('should resolve nested keys in deep JSON', () => {
    i18n.mergeMessages('en', 'pages', {
      articles: {
        title: 'My Articles',
        buttons: {
          save: 'Save Article'
        }
      },
      terms: 'Terms of Service'
    })

    expect(i18n.t('pages.articles.title')).toBe('My Articles')
    expect(i18n.t('pages.articles.buttons.save')).toBe('Save Article')
    expect(i18n.t('pages.terms')).toBe('Terms of Service')
  })

  it('should support loading partial blocks', async () => {
    const articlesData = {
      title: 'Loaded Articles',
      list: 'Article List'
    }

    const loaders = {
      en: {
        'pages.articles': vi.fn().mockResolvedValue({ default: articlesData })
      }
    }

    const i18nWithLoaders = new FintI18n({
      locale: 'en',
      loaders
    })

    await i18nWithLoaders.loadBlock('pages.articles')

    // Проверяем структуру сообщений
    expect(i18nWithLoaders.messages.en.pages).toBeDefined()
    expect(i18nWithLoaders.messages.en.pages.articles).toBeDefined()
    expect(i18nWithLoaders.messages.en['pages.articles']).toBeUndefined()

    expect(i18nWithLoaders.t('pages.articles.title')).toBe('Loaded Articles')
    expect(i18nWithLoaders.t('pages.articles.list')).toBe('Article List')
  })

  it('should not conflict when loading different parts of same root block', async () => {
    const articlesData = { title: 'Articles' }
    const termsData = { title: 'Terms' }

    const i18nPartial = new FintI18n({
      locale: 'en',
      loaders: {
        en: {
          'pages.articles': async () => articlesData,
          'pages.terms': async () => termsData
        }
      }
    })

    await i18nPartial.loadBlock('pages.articles')
    await i18nPartial.loadBlock('pages.terms')

    expect(i18nPartial.t('pages.articles.title')).toBe('Articles')
    expect(i18nPartial.t('pages.terms.title')).toBe('Terms')
  })

  it('should fallback to parent loader if specific sub-block loader is missing', async () => {
    const pagesData = {
      articles: { title: 'Parent Articles' },
      terms: { title: 'Parent Terms' }
    }

    const i18nFallback = new FintI18n({
      locale: 'en',
      loaders: {
        en: {
          'pages': async () => pagesData
        }
      }
    })

    await i18nFallback.loadBlock('pages.articles')

    expect(i18nFallback.isBlockLoaded('pages')).toBe(true)
    expect(i18nFallback.isBlockLoaded('pages.articles')).toBe(true)
    expect(i18nFallback.t('pages.articles.title')).toBe('Parent Articles')
  })
})
