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
