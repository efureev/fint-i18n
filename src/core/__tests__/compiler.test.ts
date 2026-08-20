import { describe, it, expect } from 'vitest'
import { compileTemplate } from '../compiler'

describe('compiler', () => {
  it('should return a function for static strings', () => {
    const fn = compileTemplate('Hello')
    expect(fn()).toBe('Hello')
  })

  it('should interpolate single variable', () => {
    const fn = compileTemplate('Hello {name}!')
    expect(fn({ name: 'World' })).toBe('Hello World!')
  })

  it('should interpolate multiple variables', () => {
    const fn = compileTemplate('{greeting}, {name}!')
    expect(fn({ greeting: 'Hi', name: 'John' })).toBe('Hi, John!')
  })

  it('should handle missing variables with placeholder', () => {
    const fn = compileTemplate('Hello {name}!')
    expect(fn({})).toBe('Hello {name}!')
  })
})

describe('compiler: escaping', () => {
  it('unescapes {{ and }} into literal braces', () => {
    expect(compileTemplate('{{name}}')()).toBe('{name}')
    expect(compileTemplate('{{')()).toBe('{')
    expect(compileTemplate('}}')()).toBe('}')
  })

  // Строка без настоящих плейсхолдеров сворачивается в статическую функцию —
  // оптимизация из бенчмарков, её легко потерять незаметно.
  it('treats an escaped-only string as static', () => {
    const fn = compileTemplate('a {{b}} c')

    expect(fn()).toBe('a {b} c')
    expect(fn({ b: 'ignored' })).toBe('a {b} c')
  })

  it('mixes escaping with real placeholders', () => {
    const fn = compileTemplate('{{literal}} but {real}')

    expect(fn({ real: 'substituted' })).toBe('{literal} but substituted')
  })
})

describe('compiler: text around placeholders', () => {
  it('keeps text after the last placeholder', () => {
    expect(compileTemplate('{a} tail')({ a: 'X' })).toBe('X tail')
  })

  it('keeps text before the first placeholder', () => {
    expect(compileTemplate('head {a}')({ a: 'X' })).toBe('head X')
  })

  it('keeps text between adjacent placeholders', () => {
    expect(compileTemplate('{a}-{b}')({ a: '1', b: '2' })).toBe('1-2')
    expect(compileTemplate('{a}{b}')({ a: '1', b: '2' })).toBe('12')
  })

  it('handles an empty template', () => {
    expect(compileTemplate('')()).toBe('')
  })
})

describe('compiler: placeholder names and values', () => {
  it('accepts dots, dashes and underscores in a name', () => {
    const fn = compileTemplate('{user.name} {a-b} {c_d}')

    expect(fn({ 'user.name': 'Ann', 'a-b': 'x', 'c_d': 'y' })).toBe('Ann x y')
  })

  it('leaves the placeholder for null and undefined, but substitutes other falsy values', () => {
    const fn = compileTemplate('[{v}]')

    expect(fn({ v: null })).toBe('[{v}]')
    expect(fn({ v: undefined })).toBe('[{v}]')
    expect(fn({ v: 0 })).toBe('[0]')
    expect(fn({ v: false })).toBe('[false]')
    expect(fn({ v: '' })).toBe('[]')
  })

  it('leaves the placeholder when no params are passed at all', () => {
    expect(compileTemplate('Hi {name}')()).toBe('Hi {name}')
  })

  // Ни один символ, кроме фигурных скобок, не является специальным.
  it('treats a lone brace as ordinary text', () => {
    expect(compileTemplate('100% { done')()).toBe('100% { done')
    expect(compileTemplate('a } b')()).toBe('a } b')
  })
})
