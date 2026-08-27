export type DevtoolsMode = 'off' | 'keys' | 'pseudo'

const PLAIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ACCENTED = 'åƀçðéƒϱĥîĵķļɱñöþqŕšţûvŵxýžÅßÇÐÉƑƓĤÎĴĶĻṀÑÖÞQŔŠŢÛVŴXÝŽ'

const MAP = new Map<string, string>()
const accented = [...ACCENTED]
;[...PLAIN].forEach((char, index) => MAP.set(char, accented[index] ?? char))

/** Насколько длиннее становится строка: примерно так растут немецкий и финский. */
const EXPANSION = 0.3

/**
 * Псевдолокализация отвечает на два вопроса разом: какая строка на экране не
 * прошла через `t()` (она останется без акцентов) и что поедет в вёрстке от
 * перевода длиннее английского.
 *
 * Подстановка параметров к этому моменту уже случилась — `onTranslate` получает
 * готовый результат, — поэтому плейсхолдеры портить нечего.
 */
export function pseudo(text: string): string {
  let accented = ''
  for (const char of text) accented += MAP.get(char) ?? char

  const padding = '·'.repeat(Math.ceil(text.length * EXPANSION))

  return `[${accented}${padding}]`
}

/** Что режим делает с готовым результатом перевода. */
export function applyMode(mode: DevtoolsMode, key: string, result: string): string {
  if (mode === 'keys') return key
  if (mode === 'pseudo') return pseudo(result)

  return result
}
