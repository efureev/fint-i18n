/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createFintI18n, type FintI18n } from '../../core'
import { installI18n } from '../../vue'
// @ts-expect-error — инструмент на чистом JS, типов у него нет
import { checkLocaleParity, collectMessageKeys } from '../../../scripts/check-messages.mjs'
import { buildMissingKeysPatch, createDevtools } from '../index'

function mountWith(i18n: FintI18n, key: string) {
  const Component = defineComponent({ setup: () => () => h('span', i18n.t(key)) })

  return mount(Component, {
    global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] },
  })
}

describe('actions: правка перевода на лету', () => {
  it('перерисовывает даже компонент, отрисованный на прогретом кэше', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    // Прогрев вне эффекта — тот самый стенд, на котором ломался #12.
    i18n.t('common.hello')

    const devtools = createDevtools(i18n, { bridge: false })
    const wrapper = mountWith(i18n, 'common.hello')
    expect(wrapper.text()).toBe('Hello')

    devtools.actions.patchMessage('en', 'common.hello', 'Edited')
    await nextTick()

    expect(wrapper.text()).toBe('Edited')
  })

  it('кладёт значение по вложенному ключу, не ломая соседей', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'page', { articles: { title: 'Articles', lead: 'Lead' } })

    const devtools = createDevtools(i18n, { bridge: false })
    devtools.actions.patchMessage('en', 'page.articles.title', 'Posts')

    expect(i18n.t('page.articles.title')).toBe('Posts')
    expect(i18n.t('page.articles.lead')).toBe('Lead')
  })

  it('заводит ключ верхнего уровня без точек', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const devtools = createDevtools(i18n, { bridge: false })

    devtools.actions.patchMessage('en', 'standalone', 'Value')

    expect(i18n.t('standalone')).toBe('Value')
  })
})

describe('actions: перезагрузка блока', () => {
  it('зовёт лоадер повторно и подхватывает изменившееся сообщение', async () => {
    let payload = 'Hello'
    const loader = vi.fn(async () => ({ hello: payload }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { common: loader } } })
    const devtools = createDevtools(i18n, { bridge: false })

    await i18n.loadBlock('common')
    expect(i18n.t('common.hello')).toBe('Hello')

    payload = 'Reloaded'
    await devtools.actions.reloadBlock('common')

    expect(loader).toHaveBeenCalledTimes(2)
    expect(i18n.t('common.hello')).toBe('Reloaded')
  })

  it('выгружает по имени фактически загруженного блока при восходящем резолвинге', async () => {
    let title = 'Articles'
    const loader = vi.fn(async () => ({ articles: { title } }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { pages: loader } } })
    const devtools = createDevtools(i18n, { bridge: false })

    await i18n.loadBlock('pages.articles')
    expect(i18n.t('pages.articles.title')).toBe('Articles')

    title = 'Posts'
    // Запрошен `pages.articles`, а помечен загруженным `pages` — выгружать
    // нужно родителя, иначе повторная загрузка ничего не сделает.
    await devtools.actions.reloadBlock('pages.articles')

    expect(loader).toHaveBeenCalledTimes(2)
    expect(i18n.t('pages.articles.title')).toBe('Posts')
  })
})

describe('actions: сброс кэшей', () => {
  it('инвалидация кэша компиляции не теряет сообщений, включая листы верхнего уровня', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    i18n.mergeMessages('en', 'standalone', 'Value')
    i18n.t('common.hello')

    const devtools = createDevtools(i18n, { bridge: false })
    devtools.actions.clearCompiled()

    expect(i18n.t('common.hello')).toBe('Hello')
    expect(i18n.t('standalone')).toBe('Value')
  })
})

describe('actions: заготовка словаря из промахов', () => {
  it('собирает дерево по локалям с пустыми значениями', () => {
    const patch = buildMissingKeysPatch([
      { key: 'common.hello', locale: 'ru', count: 3 },
      { key: 'page.articles.title', locale: 'ru', count: 1 },
      { key: 'common.bye', locale: 'en', count: 1 },
    ])

    expect(patch).toEqual({
      ru: { common: { hello: '' }, page: { articles: { title: '' } } },
      en: { common: { bye: '' } },
    })
  })

  it('даёт словарь, который check-messages разбирает и сверяет как обычный', () => {
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'ru' })
    const devtools = createDevtools(i18n, { bridge: false })

    i18n.t('common.hello')
    i18n.t('page.articles.title')

    const patch = devtools.actions.missingKeysPatch()

    // Тем же разбором, что и настоящие словари: ключи видны, паритет считается.
    expect([...collectMessageKeys(patch.ru).keys()]).toEqual(['common.hello', 'page.articles.title'])
    expect(checkLocaleParity(new Map([['ru', patch.ru], ['en', patch.ru]]), new Set())).toEqual([])
  })
})
