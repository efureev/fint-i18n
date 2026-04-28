import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import { isBlockPattern, LocaleLoaderRegistry } from '../loader-registry'
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

  describe('wildcard pattern expansion', () => {
    const noop = async () => ({})

    it('detects pattern names', () => {
      expect(isBlockPattern('components.*')).toBe(true)
      expect(isBlockPattern('components.**')).toBe(true)
      expect(isBlockPattern('components')).toBe(false)
      expect(isBlockPattern('components.first')).toBe(false)
      expect(isBlockPattern('*')).toBe(false)
      expect(isBlockPattern('.*')).toBe(true) // суффикс есть, но префикс пустой — отсечёт expandPattern
    })

    it('expands "prefix.*" to direct children only (single segment)', () => {
      const registry = new LocaleLoaderRegistry({
        en: {
          'components.first': noop,
          'components.second': noop,
          'components.deep.x': noop,
          'page.articles': noop,
          'components': noop,
        },
      })

      const expanded = registry.expandPattern('components.*').sort()
      expect(expanded).toEqual(['components.first', 'components.second'])
    })

    it('expands "prefix.**" to all descendants (any depth)', () => {
      const registry = new LocaleLoaderRegistry({
        en: {
          'components.first': noop,
          'components.second': noop,
          'components.deep.x': noop,
          'components.deep.y.z': noop,
          'page.articles': noop,
        },
      })

      const expanded = registry.expandPattern('components.**').sort()
      expect(expanded).toEqual([
        'components.deep.x',
        'components.deep.y.z',
        'components.first',
        'components.second',
      ])
    })

    it('does not include the parent literal itself', () => {
      const registry = new LocaleLoaderRegistry({
        en: {
          components: noop,
          'components.first': noop,
        },
      })

      expect(registry.expandPattern('components.*')).toEqual(['components.first'])
      expect(registry.expandPattern('components.**')).toEqual(['components.first'])
    })

    it('returns empty array for unknown prefix or empty prefix', () => {
      const registry = new LocaleLoaderRegistry({
        en: { 'components.first': noop },
      })

      expect(registry.expandPattern('unknown.*')).toEqual([])
      expect(registry.expandPattern('.*')).toEqual([])
      expect(registry.expandPattern('plain-name')).toEqual([])
    })

    it('unions known block names across all locales', () => {
      const registry = new LocaleLoaderRegistry({
        en: { 'components.first': noop },
        ru: { 'components.second': noop },
      })

      const expanded = registry.expandPattern('components.*').sort()
      expect(expanded).toEqual(['components.first', 'components.second'])
    })

    it('avoids partial-prefix false positives (requires trailing dot)', () => {
      const registry = new LocaleLoaderRegistry({
        en: {
          'componentsX': noop,
          'components-extra': noop,
          'components.first': noop,
        },
      })

      expect(registry.expandPattern('components.*')).toEqual(['components.first'])
    })
  })
})