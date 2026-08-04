import { bench, describe } from 'vitest'
import { compileTemplate } from '@/core/compiler'
import { createFormatters } from '@/core/format'
import { createFintI18n } from '@/core/instance'
import { compilePluralForms } from '@/core/plural'
import type { MessageSchema } from '@/core/types'

const baseMessages = {
  common: {
    greeting: 'Hello, {name}! You have {count} new notifications.',
    nested: {
      title: 'Dashboard',
    },
  },
} satisfies MessageSchema

const analyticsMessages = {
  analytics: {
    summary: 'Revenue: {revenue}, growth: {growth}%.',
  },
} satisfies MessageSchema

const translateInstance = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders: {
    en: {
      analytics: async () => analyticsMessages,
    },
  },
})

translateInstance.mergeMessages('en', 'common', baseMessages.common)
translateInstance.registerUsage('analytics')

const localeSwitchInstance = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders: {
    en: {
      analytics: async () => analyticsMessages,
    },
    ru: {
      analytics: async () => analyticsMessages,
    },
  },
})

localeSwitchInstance.mergeMessages('en', 'common', baseMessages.common)
localeSwitchInstance.mergeMessages('ru', 'common', baseMessages.common)
localeSwitchInstance.registerUsage('analytics')

await translateInstance.loadBlock('analytics', 'en')
translateInstance.t('common.greeting', { name: 'Alex', count: 3 })
translateInstance.t('common.nested.title')
translateInstance.t('analytics.summary', { revenue: '$12k', growth: 8 })

await localeSwitchInstance.loadBlock('analytics', 'en')
await localeSwitchInstance.loadBlock('analytics', 'ru')

const pluralInstance = createFintI18n({
  locale: 'ru',
  fallbackLocale: 'ru',
})

pluralInstance.mergeMessages('ru', 'cart', {
  items: {
    one: '{count} товар',
    few: '{count} товара',
    many: '{count} товаров',
    other: '{count} товара',
  },
})

pluralInstance.t('cart.items', { count: 3 })

const { n, d } = createFormatters(() => 'ru')
const currency = { style: 'currency', currency: 'EUR' } as const
const dateStyle = { dateStyle: 'long' } as const
const moment = new Date(Date.UTC(2026, 7, 4))

n(1234.5, currency)
d(moment, dateStyle)

const defaultBenchOptions = {
  iterations: 200,
  time: 250,
  warmupIterations: 50,
  warmupTime: 100,
} as const

describe('fint-i18n core benchmarks', () => {
  bench(
    'compileTemplate() cold compile',
    () => {
      const fn = compileTemplate('Hello, {name}! Balance: {balance}.')
      fn({ name: 'Alex', balance: '$120.00' })
    },
    defaultBenchOptions,
  )

  bench(
    'i18n.t() warm cached lookup',
    () => {
      translateInstance.t('common.greeting', { name: 'Alex', count: 3 })
    },
    defaultBenchOptions,
  )

  bench(
    'i18n.t() nested cached lookup',
    () => {
      translateInstance.t('common.nested.title')
    },
    defaultBenchOptions,
  )

  bench(
    'compilePluralForms() cold compile',
    () => {
      const fn = compilePluralForms(
        { one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' },
        'ru',
      )
      fn({ n: 3 })
    },
    defaultBenchOptions,
  )

  bench(
    'i18n.t() warm cached lookup, plural',
    () => {
      pluralInstance.t('cart.items', { count: 3 })
    },
    defaultBenchOptions,
  )

  bench(
    'n() warm cached formatter',
    () => {
      n(1234.5, currency)
    },
    defaultBenchOptions,
  )

  bench(
    'd() warm cached formatter',
    () => {
      d(moment, dateStyle)
    },
    defaultBenchOptions,
  )

  bench(
    'Intl.NumberFormat construction (no cache)',
    () => {
      new Intl.NumberFormat('ru', currency).format(1234.5)
    },
    defaultBenchOptions,
  )

  bench(
    'i18n.setLocale() with used blocks',
    async () => {
      await localeSwitchInstance.setLocale(
        localeSwitchInstance.locale.value === 'en' ? 'ru' : 'en',
      )
    },
    {
      iterations: 50,
      time: 250,
      warmupIterations: 10,
      warmupTime: 100,
    },
  )
})
