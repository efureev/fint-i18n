import { describe, expect, it } from 'vitest'
// @ts-expect-error — скрипт миграции на чистом JS, типов у него нет
import { analyseString, inferLocale, migrateTree, pluralCategories, splitBranches } from '../codemod-plural-forms.mjs'

describe('splitBranches', () => {
  it('splits on a separator and unescapes `||`', () => {
    expect(splitBranches('a|b')).toEqual(['a', 'b'])
    expect(splitBranches('a||b')).toEqual(['a|b'])
    expect(splitBranches('one:x | other:y')).toEqual(['one:x ', ' other:y'])
  })
})

describe('pluralCategories', () => {
  it('returns CLDR categories in canonical order', () => {
    expect(pluralCategories('en')).toEqual(['one', 'other'])
    expect(pluralCategories('ru')).toEqual(['one', 'few', 'many', 'other'])
  })
})

describe('analyseString: converts unambiguous input', () => {
  it('converts a fully labelled message', () => {
    const result = analyseString('one:{n} файл | few:{n} файла | many:{n} файлов | other:{n} файла', 'ru')

    expect(result.action).toBe('convert')
    expect(result.value).toEqual({
      one: '{n} файл',
      few: '{n} файла',
      many: '{n} файлов',
      other: '{n} файла',
    })
    expect(result.warning).toBeNull()
  })

  it('puts exact forms first and keeps categories in canonical order', () => {
    const result = analyseString('other:{n} files | =0:no files | one:{n} file', 'en')

    expect(Object.keys(result.value)).toEqual(['=0', 'one', 'other'])
  })

  it('warns when the locale needs forms the message does not have', () => {
    const result = analyseString('one:{n} файл | other:{n} файлов', 'ru')

    expect(result.action).toBe('convert')
    expect(result.warning).toContain('few, many')
  })

  it('unescapes `||` inside a converted branch', () => {
    const result = analyseString('one:Ctrl || Shift | other:Ctrl || Alt', 'en')

    expect(result.value).toEqual({ one: 'Ctrl | Shift', other: 'Ctrl | Alt' })
  })
})

describe('analyseString: refuses to guess', () => {
  it('leaves plain text alone', () => {
    expect(analyseString('Just a message', 'en')).toBeNull()
    expect(analyseString('Hello, {name}!', 'ru')).toBeNull()
  })

  it('sends unlabelled forms to review with a suggestion', () => {
    const result = analyseString('{n} файл | {n} файла | {n} файлов | {n} файла', 'ru')

    expect(result.action).toBe('review')
    expect(result.reason).toBe('positional')
    expect(result.suggestion).toEqual({
      one: '{n} файл',
      few: '{n} файла',
      many: '{n} файлов',
      other: '{n} файла',
    })
  })

  it('sends a table header to review rather than mangling it', () => {
    const result = analyseString('Имя | Почта', 'ru')

    expect(result.action).toBe('review')
    expect(result.reason).toBe('positional')
    // Ни счётчика, ни совпадения числа веток с категориями — подсказка была бы шумом.
    expect(result.suggestion).toBeNull()
    expect(result.note).toContain('обычный текст')
  })

  it('offers a suggestion when the shape actually looks plural', () => {
    const result = analyseString('{n} file | {n} files', 'en')

    expect(result.suggestion).toEqual({ one: '{n} file', other: '{n} files' })
  })

  it('flags a message with only an escaped pipe', () => {
    const result = analyseString('Ctrl || Shift', 'en')

    expect(result.action).toBe('review')
    expect(result.reason).toBe('escaped-pipe')
    expect(result.suggestion).toBe('Ctrl | Shift')
  })

  it('flags partially laballed messages', () => {
    const result = analyseString('one:{n} file | {n} files', 'en')

    expect(result.action).toBe('review')
    expect(result.reason).toBe('partial-labels')
  })
})

describe('inferLocale', () => {
  it('reads the locale from the containing directory', () => {
    expect(inferLocale('/app/src/i18n/locales/ru/common.json')).toBe('ru')
    expect(inferLocale('/app/src/i18n/locales/pt-BR/common.json')).toBe('pt-BR')
    expect(inferLocale('/app/locales/ru_RU/common.json')).toBe('ru-RU')
  })

  it('reads the locale from the file name', () => {
    expect(inferLocale('/app/src/i18n/en.json')).toBe('en')
  })

  it('does not mistake an ordinary directory for a locale', () => {
    // `Intl` канонизирует `tmp` в `tyj`, а `lib` считает валидным тегом:
    // без проверки на данные CLDR такая директория стала бы локалью.
    expect(inferLocale('/private/tmp/fixtures/flat/dict.json')).toBeNull()
    expect(inferLocale('/app/src/lib/dict.json')).toBeNull()
    expect(inferLocale('/project/app/dict.json')).toBeNull()
  })

  it('prefers an explicit override', () => {
    expect(inferLocale('/app/locales/ru/common.json', 'de')).toBe('de')
  })
})

describe('migrateTree', () => {
  const tree = {
    welcome: 'Welcome, {name}!',
    files: 'one:{n} file | other:{n} files',
    ui: {
      columns: 'Name | Email',
      actions: { save: 'Save' },
    },
  }

  it('converts only what is unambiguous and reports the rest', () => {
    const result = migrateTree(tree, 'en')

    expect(result.tree.files).toEqual({ one: '{n} file', other: '{n} files' })
    expect(result.tree.welcome).toBe('Welcome, {name}!')
    expect(result.tree.ui.columns).toBe('Name | Email')
    expect(result.tree.ui.actions.save).toBe('Save')

    expect(result.converted.map((c: any) => c.key)).toEqual(['files'])
    expect(result.review.map((r: any) => r.key)).toEqual(['ui.columns'])
  })

  it('leaves the source tree untouched', () => {
    migrateTree(tree, 'en')

    expect(tree.files).toBe('one:{n} file | other:{n} files')
  })

  it('converts positional forms only when explicitly asked', () => {
    const positional = { files: '{n} file | {n} files' }

    expect(migrateTree(positional, 'en').tree.files).toBe('{n} file | {n} files')
    expect(migrateTree(positional, 'en', { positional: true }).tree.files)
      .toEqual({ one: '{n} file', other: '{n} files' })
  })

  it('keeps key order', () => {
    const result = migrateTree({ a: '1', files: 'one:x | other:y', z: '2' }, 'en')

    expect(Object.keys(result.tree)).toEqual(['a', 'files', 'z'])
  })
})
