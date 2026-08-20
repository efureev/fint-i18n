import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createFintI18n } from '../instance'
import { normalizeTranslateParams } from '../translate-params'

/**
 * В шаблоне Vue разворачивает ref сам, а в обычном коде — нет: без нормализации
 * `t('hi', { name: someRef })` подставил бы `[object Object]`.
 */
describe('normalizeTranslateParams', () => {
  it('unwraps refs', () => {
    expect(normalizeTranslateParams({ name: ref('Ann') })).toEqual({ name: 'Ann' })
  })

  it('unwraps computed refs too', () => {
    expect(normalizeTranslateParams({ n: computed(() => 2 + 3) })).toEqual({ n: 5 })
  })

  it('unwraps only the refs in a mixed object', () => {
    const params = { plain: 'x', wrapped: ref('y'), count: 3 }

    expect(normalizeTranslateParams(params)).toEqual({ plain: 'x', wrapped: 'y', count: 3 })
  })

  it('does not mutate the object it was given', () => {
    const wrapped = ref('y')
    const params = { plain: 'x', wrapped }

    normalizeTranslateParams(params)

    expect(params.wrapped).toBe(wrapped)
  })

  // Копия делается только при наличии ref — на горячем пути это лишняя аллокация.
  it('returns the very same object when there is nothing to unwrap', () => {
    const params = { plain: 'x', count: 1 }

    expect(normalizeTranslateParams(params)).toBe(params)
  })

  it('passes undefined through', () => {
    expect(normalizeTranslateParams(undefined)).toBeUndefined()
  })

  it('handles an empty object', () => {
    const params = {}

    expect(normalizeTranslateParams(params)).toBe(params)
  })
})

describe('t() with ref params', () => {
  it('substitutes a ref value', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hi: 'Hi, {name}!' })

    expect(i18n.t('common.hi', { name: ref('Ann') })).toBe('Hi, Ann!')
  })

  it('reads the ref at call time, so a later value wins', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hi: 'Hi, {name}!' })
    const name = ref('Ann')

    expect(i18n.t('common.hi', { name })).toBe('Hi, Ann!')

    name.value = 'Bob'

    expect(i18n.t('common.hi', { name })).toBe('Hi, Bob!')
  })

  it('accepts a ref as a plural count', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'cart', { items: { one: '{n} item', other: '{n} items' } })

    expect(i18n.t('cart.items', { n: ref(1) })).toBe('1 item')
    expect(i18n.t('cart.items', { n: ref(5) })).toBe('5 items')
  })
})
