import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import { LocaleLoaderRegistry } from '../loader-registry'
import type {
  FintI18nOptions,
  LocaleBlockLoaders,
  LocaleLoaderCollection,
  LocaleLoaderSource,
} from '../types'

describe('LocaleLoaderRegistry', () => {
  it('should normalize a single collection into loader arrays', () => {
    const commonLoader = vi.fn(async () => ({ title: 'Common' }))
    const registry = new LocaleLoaderRegistry({
      en: {
        common: commonLoader,
      },
    })

    expect(registry.resolve('en', 'common')).toEqual({
      resolvedBlockName: 'common',
      loaders: [commonLoader],
    })
  })

  it('should merge package collections from left to right', () => {
    const baseLoader = vi.fn(async () => ({ title: 'Base' }))
    const overrideLoader = vi.fn(async () => ({ title: 'Override' }))
    const actionsLoader = vi.fn(async () => ({ actions: { submit: 'Save' } }))

    const registry = new LocaleLoaderRegistry([
      {
        en: {
          common: baseLoader,
        },
      },
      {
        en: {
          common: [overrideLoader, actionsLoader],
        },
      },
    ])

    expect(registry.resolve('en', 'common')).toEqual({
      resolvedBlockName: 'common',
      loaders: [baseLoader, overrideLoader, actionsLoader],
    })
  })

  it('should resolve parent block loaders as a fallback', () => {
    const pagesLoader = vi.fn(async () => ({ articles: { title: 'Articles' } }))
    const registry = new LocaleLoaderRegistry({
      en: {
        pages: pagesLoader,
      },
    })

    expect(registry.resolve('en', 'pages.articles')).toEqual({
      resolvedBlockName: 'pages',
      loaders: [pagesLoader],
    })
  })

  it('should expose typed loader contracts', () => {
    const collection = {
      en: {
        common: async () => ({ title: 'Common' }),
      },
    } satisfies LocaleLoaderCollection
    const source = [collection] satisfies LocaleLoaderSource
    const options = {
      locale: 'en',
      loaders: source,
    } satisfies FintI18nOptions

    expectTypeOf(collection.en.common).toMatchTypeOf<LocaleBlockLoaders>()
    expectTypeOf(source).toMatchTypeOf<LocaleLoaderSource>()
    expectTypeOf(options.loaders).toMatchTypeOf<LocaleLoaderSource | undefined>()
  })
})