import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'
import { getMessageValue, mergeMessageValues } from '../message-utils'

describe('getMessageValue', () => {
  const messages = {
    common: { title: 'Title', nested: { deep: 'Deep' } },
    count: 42,
    flag: false,
  }

  it('walks a dotted path', () => {
    expect(getMessageValue(messages, 'common.title')).toBe('Title')
    expect(getMessageValue(messages, 'common.nested.deep')).toBe('Deep')
  })

  it('returns the subtree for a partial path', () => {
    expect(getMessageValue(messages, 'common.nested')).toEqual({ deep: 'Deep' })
  })

  it('returns undefined for a missing segment', () => {
    expect(getMessageValue(messages, 'common.missing')).toBeUndefined()
    expect(getMessageValue(messages, 'missing.entirely.deep')).toBeUndefined()
  })

  // Путь упёрся в примитив на полпути — дальше идти некуда.
  it('returns undefined when the path runs into a leaf', () => {
    expect(getMessageValue(messages, 'common.title.longer')).toBeUndefined()
    expect(getMessageValue(messages, 'count.more')).toBeUndefined()
  })

  it('reads non-string leaves as they are', () => {
    expect(getMessageValue(messages, 'count')).toBe(42)
    expect(getMessageValue(messages, 'flag')).toBe(false)
  })

  it('handles an empty key and a trailing dot', () => {
    expect(getMessageValue(messages, '')).toBeUndefined()
    expect(getMessageValue(messages, 'common.')).toBeUndefined()
  })
})

describe('mergeMessageValues', () => {
  it('merges two objects deeply', () => {
    const merged = mergeMessageValues({ a: { x: '1' }, b: '2' }, { a: { y: '3' } })

    expect(merged).toEqual({ a: { x: '1', y: '3' }, b: '2' })
  })

  it('lets a non-object source replace the target outright', () => {
    expect(mergeMessageValues({ a: '1' }, 'plain')).toBe('plain')
    expect(mergeMessageValues('plain', { a: '1' })).toEqual({ a: '1' })
  })
})

describe('t(): resolution edge cases', () => {
  it('returns the key when the path runs into a leaf', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { title: 'Title' })

    expect(i18n.t('common.title.deeper')).toBe('common.title.deeper')
  })

  it('returns a namespace key rather than an object', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { nested: { deep: 'Deep' } })

    expect(i18n.t('common.nested')).toBe('common.nested')
  })

  it('stringifies non-string leaves', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'stats', { count: 42, enabled: true })

    expect(i18n.t('stats.count')).toBe('42')
    expect(i18n.t('stats.enabled')).toBe('true')
  })

  it('accepts a function message and passes params to it', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { greet: (params?: Record<string, any>) => `Hi, ${params?.name}` })

    expect(i18n.t('common.greet', { name: 'Ann' })).toBe('Hi, Ann')
  })

  it('takes a per-call fallback locale over the instance one', () => {
    const i18n = createFintI18n({ locale: 'en', fallbackLocale: 'ru' })
    i18n.mergeMessages('ru', 'common', { only: 'Русский' })
    i18n.mergeMessages('de', 'common', { only: 'Deutsch' })

    expect(i18n.t('common.only')).toBe('Русский')
    expect(i18n.t('common.only', undefined, { fallbackLocale: 'de' })).toBe('Deutsch')
  })
})

describe('mergeMessages: shapes', () => {
  it('replaces a block whose value is not an object', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'motd', 'Plain string block')
    expect(i18n.t('motd')).toBe('Plain string block')

    i18n.mergeMessages('en', 'motd', { nested: 'Now an object' })
    expect(i18n.t('motd.nested')).toBe('Now an object')
  })

  it('merges into a nested block path', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'pages.articles', { title: 'Articles' })
    i18n.mergeMessages('en', 'pages.articles', { subtitle: 'Latest' })

    expect(i18n.t('pages.articles.title')).toBe('Articles')
    expect(i18n.t('pages.articles.subtitle')).toBe('Latest')
  })

  it('overwrites a leaf that a nested path needs to walk through', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.mergeMessages('en', 'pages', 'was a string')
    i18n.mergeMessages('en', 'pages.articles', { title: 'Articles' })

    expect(i18n.t('pages.articles.title')).toBe('Articles')
  })
})

describe('unloadBlock', () => {
  it('removes a nested block and leaves its siblings alone', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          'pages.articles': async () => ({ title: 'Articles' }),
          'pages.terms': async () => ({ title: 'Terms' }),
        },
      },
    })

    await i18n.loadBlock('pages.articles')
    await i18n.loadBlock('pages.terms')
    expect(i18n.t('pages.articles.title')).toBe('Articles')

    i18n.unloadBlock('pages.articles')

    expect(i18n.t('pages.articles.title')).toBe('pages.articles.title')
    expect(i18n.t('pages.terms.title')).toBe('Terms')
    expect(i18n.isBlockLoaded('pages.articles', 'en')).toBe(false)
  })

  it('lets the block load again afterwards', async () => {
    const loader = vi.fn(async () => ({ title: 'Articles' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { 'pages.articles': loader } } })

    await i18n.loadBlock('pages.articles')
    i18n.unloadBlock('pages.articles')
    await i18n.loadBlock('pages.articles')

    expect(loader).toHaveBeenCalledTimes(2)
    expect(i18n.t('pages.articles.title')).toBe('Articles')
  })

  it('is a no-op for a block that was never loaded', () => {
    const i18n = createFintI18n({ locale: 'en' })

    expect(() => i18n.unloadBlock('nothing.here')).not.toThrow()
    expect(() => i18n.unloadBlock('nothing', 'de')).not.toThrow()
  })

  it('unloads only the locale it was asked for', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: { common: async () => ({ title: 'Title' }) },
        ru: { common: async () => ({ title: 'Заголовок' }) },
      },
    })

    await i18n.loadBlock('common', 'en')
    await i18n.loadBlock('common', 'ru')

    i18n.unloadBlock('common', 'en')

    expect(i18n.isBlockLoaded('common', 'en')).toBe(false)
    expect(i18n.isBlockLoaded('common', 'ru')).toBe(true)
  })
})
