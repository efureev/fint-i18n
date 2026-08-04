import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error — инструмент на чистом JS, типов у него нет
import { checkLocaleParity, checkPluralCompleteness, collectMessageKeys, extractUsedKeys, isPluralForms } from '../check-messages.mjs'

function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'fint-check-'))

  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }

  return root
}

describe('collectMessageKeys', () => {
  it('walks nested namespaces', () => {
    const keys = [...collectMessageKeys({ a: { b: 'x', c: { d: 'y' } } }).keys()]

    expect(keys).toEqual(['a.b', 'a.c.d'])
  })

  it('treats a set of plural forms as one key, not one per form', () => {
    const keys = [...collectMessageKeys({ files: { one: '{n}', other: '{n}' } }).keys()]

    expect(keys).toEqual(['files'])
  })

  it('recognises exact-value forms as part of the set', () => {
    expect(isPluralForms({ '=0': 'none', 'one': 'a', 'other': 'b' })).toBe(true)
    expect(isPluralForms({ one: 'a', title: 'b' })).toBe(false)
  })
})

describe('checkLocaleParity', () => {
  it('is silent when the key sets match', () => {
    const locales = new Map([
      ['en', { a: { b: 'x' } }],
      ['ru', { a: { b: 'икс' } }],
    ])

    expect(checkLocaleParity(locales)).toEqual([])
  })

  it('reports a key that only one locale has', () => {
    const locales = new Map([
      ['en', { a: { b: 'x', onlyEn: 'e' } }],
      ['ru', { a: { b: 'икс' } }],
    ])

    expect(checkLocaleParity(locales)).toEqual([{ key: 'a.onlyEn', missing: ['ru'] }])
  })

  it('does not mistake different CLDR categories for a divergence', () => {
    // В `ru` форм четыре, в `en` две — это норма, а не расхождение словарей.
    const locales = new Map([
      ['en', { files: { one: '{n} file', other: '{n} files' } }],
      ['ru', { files: { one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' } }],
    ])

    expect(checkLocaleParity(locales)).toEqual([])
  })
})

describe('checkPluralCompleteness', () => {
  it('accepts a complete set', () => {
    const locales = new Map([
      ['ru', { files: { one: 'a', few: 'b', many: 'c', other: 'd' } }],
      ['en', { files: { one: 'a', other: 'b' } }],
    ])

    expect(checkPluralCompleteness(locales)).toEqual([])
  })

  it('names the categories a locale is missing', () => {
    const locales = new Map([['ru', { files: { one: 'a', other: 'b' } }]])

    expect(checkPluralCompleteness(locales)).toEqual([
      { locale: 'ru', key: 'files', missing: ['few', 'many'] },
    ])
  })

  it('ignores exact-value keys when counting coverage', () => {
    const locales = new Map([['en', { files: { '=0': 'none', 'one': 'a', 'other': 'b' } }]])

    expect(checkPluralCompleteness(locales)).toEqual([])
  })
})

describe('extractUsedKeys', () => {
  it('finds keys in calls, templates and the v-t directive', async () => {
    const root = fixture({
      'src/a.ts': `const x = t('plain.key'); i18n.te('checked.key'); scope.tm('sub.tree')`,
      'src/B.vue': `<script setup lang="ts">
        const label = t('script.key')
        </script>
        <template>
          <p>{{ t('template.key') }}</p>
          <span v-t="'directive.key'" />
          <span v-t="{ path: 'directive.object' }" />
        </template>`,
    })

    const { used, subtrees } = await extractUsedKeys([join(root, 'src')])

    expect([...used].sort()).toEqual([
      'checked.key',
      'directive.key',
      'directive.object',
      'plain.key',
      'script.key',
      'sub.tree',
      'template.key',
    ])
    expect([...subtrees]).toEqual(['sub.tree'])
  })

  it('records a dynamic key instead of guessing it', async () => {
    // eslint-disable-next-line no-template-curly-in-string -- фикстура: подстановка должна остаться неразвёрнутой
    const root = fixture({ 'src/a.ts': 'const x = t(`widgets.${id}.title`); const y = t(someKey)' })

    const { used, dynamic } = await extractUsedKeys([join(root, 'src')])

    expect([...used]).toEqual([])
    expect(dynamic).toHaveLength(2)
  })

  it('understands keys relative to a prefixed scope', async () => {
    const root = fixture({
      'src/a.ts': `const scope = useI18nScopeSync(['profile'], { prefix: true })
        const a = scope.t('title')
        const b = t('ui.absolute')`,
    })

    const { used, probes } = await extractUsedKeys([join(root, 'src')])

    // Обе трактовки помечены использованными…
    expect(used.has('profile.title')).toBe(true)
    expect(used.has('title')).toBe(true)
    // …но проверка «пропал ли ключ» ищет хотя бы одну существующую.
    const forTitle = probes.find((alternatives: string[]) => alternatives[0] === 'title')
    expect(forTitle).toEqual(['title', 'profile.title'])
  })

  it('ignores a plain string that merely looks like a call', async () => {
    const root = fixture({ 'src/a.ts': `const s = "t('not.a.call')" // t('neither.this')` })

    const { used } = await extractUsedKeys([join(root, 'src')])

    expect([...used]).toEqual([])
  })
})
