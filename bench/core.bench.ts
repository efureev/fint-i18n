import { bench, describe } from 'vitest'
import { compileTemplate } from '@/core/compiler'
import { createFintI18n } from '@/core/instance'
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

translateInstance.messages.en = baseMessages
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

localeSwitchInstance.messages.en = baseMessages
localeSwitchInstance.messages.ru = baseMessages
localeSwitchInstance.registerUsage('analytics')

await translateInstance.loadBlock('analytics', 'en')
translateInstance.t('common.greeting', { name: 'Alex', count: 3 })
translateInstance.t('common.nested.title')
translateInstance.t('analytics.summary', { revenue: '$12k', growth: 8 })

await localeSwitchInstance.loadBlock('analytics', 'en')
await localeSwitchInstance.loadBlock('analytics', 'ru')

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
