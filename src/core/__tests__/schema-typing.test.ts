import { describe, expect, expectTypeOf, it } from 'vitest'
import { createFintI18n } from '../instance'
import type { MessageKeys } from '../types'

// Схема интерфейсом — форма, которую потребитель выбирает первой.
interface AppSchemaInterface {
  common: { welcome: string, user: { profile: string } }
  files: { one: string, other: string }
}

type AppSchemaType = {
  common: { welcome: string, user: { profile: string } }
  files: { one: string, other: string }
}

describe('schema generic accepts both interface and type alias', () => {
  it('compiles with an interface', () => {
    const i18n = createFintI18n<AppSchemaInterface>({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { welcome: 'Hi, {name}!' })

    expect(i18n.t('common.welcome', { name: 'Alex' })).toBe('Hi, Alex!')
  })

  it('compiles with a type alias', () => {
    const i18n = createFintI18n<AppSchemaType>({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { welcome: 'Hi, {name}!' })

    expect(i18n.t('common.welcome', { name: 'Alex' })).toBe('Hi, Alex!')
  })
})

describe('MessageKeys', () => {
  it('produces the same leaf keys for an interface and a type alias', () => {
    expectTypeOf<MessageKeys<AppSchemaInterface>>()
      .toEqualTypeOf<'common.welcome' | 'common.user.profile' | 'files'>()

    expectTypeOf<MessageKeys<AppSchemaType>>()
      .toEqualTypeOf<'common.welcome' | 'common.user.profile' | 'files'>()
  })

  it('treats a set of plural forms as a leaf', () => {
    type S = { files: { one: string, few: string, many: string, other: string } }

    expectTypeOf<MessageKeys<S>>().toEqualTypeOf<'files'>()
  })

  it('treats a message function as a leaf', () => {
    type S = { greet: (params?: Record<string, any>) => string }

    expectTypeOf<MessageKeys<S>>().toEqualTypeOf<'greet'>()
  })

  it('keeps ordinary namespaces addressable by their leaves', () => {
    type S = { ui: { actions: { save: string, cancel: string } } }

    expectTypeOf<MessageKeys<S>>().toEqualTypeOf<'ui.actions.save' | 'ui.actions.cancel'>()
  })

  it('still accepts dynamically built keys at the call site', () => {
    const i18n = createFintI18n<AppSchemaInterface>({ locale: 'en' })
    const dynamic = 'welcome'

    expect(i18n.t(`common.${dynamic}`)).toBe('common.welcome')
  })
})
