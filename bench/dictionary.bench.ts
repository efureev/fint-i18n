import { bench, describe } from 'vitest'
import { createFintI18n } from '@/core/instance'
import type { MessageSchema } from '@/core/types'

/**
 * Пропускная способность на словаре размера реального приложения.
 *
 * `core.bench.ts` меряет стоимость одного вызова на трёх ключах — там кэш
 * компиляции всегда горячий и словарь помещается в кэш процессора. Здесь
 * обратное: 5 000 ключей, обращение вразнобой, и отдельно первый проход, где
 * каждый ключ компилируется впервые.
 */

const BLOCKS = 50
const KEYS_PER_BLOCK = 100
const TOTAL = BLOCKS * KEYS_PER_BLOCK

function buildDictionary(): MessageSchema {
  const messages: MessageSchema = {}

  for (let b = 0; b < BLOCKS; b++) {
    const block: Record<string, any> = {}

    for (let k = 0; k < KEYS_PER_BLOCK; k++) {
      // Треть сообщений с подстановкой — примерно та доля, что встречается
      // в реальных словарях; статические сворачиваются в константную функцию.
      block[`key${k}`] = k % 3 === 0
        ? `Block ${b} key ${k} for {name}, count {count}`
        : `Block ${b} key ${k}`
    }

    messages[`block${b}`] = block
  }

  return messages
}

const dictionary = buildDictionary()

/** Порядок обращения перемешан: последовательный проход льстит кэшу. */
const keys: string[] = []
for (let i = 0; i < TOTAL; i++) {
  const b = (i * 37) % BLOCKS
  const k = (i * 61) % KEYS_PER_BLOCK
  keys.push(`block${b}.key${k}`)
}

const params = { name: 'Alex', count: 7 }

const warm = createFintI18n({ locale: 'en' })
for (const [block, value] of Object.entries(dictionary)) warm.mergeMessages('en', block, value)
for (const key of keys) warm.t(key, params)

const benchOptions = { iterations: 20, time: 500, warmupIterations: 3, warmupTime: 200 } as const

describe('fint-i18n dictionary throughput', () => {
  bench(
    `t() × ${TOTAL} keys, warm cache`,
    () => {
      for (const key of keys) warm.t(key, params)
    },
    benchOptions,
  )

  bench(
    `first pass over ${TOTAL} keys (cold compile)`,
    () => {
      const i18n = createFintI18n({ locale: 'en' })
      for (const [block, value] of Object.entries(dictionary)) i18n.mergeMessages('en', block, value)
      for (const key of keys) i18n.t(key, params)
    },
    { ...benchOptions, iterations: 5 },
  )

  bench(
    `mergeMessages() ${TOTAL} keys`,
    () => {
      const i18n = createFintI18n({ locale: 'en' })
      for (const [block, value] of Object.entries(dictionary)) i18n.mergeMessages('en', block, value)
    },
    { ...benchOptions, iterations: 5 },
  )
})
