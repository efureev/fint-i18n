export type MessageFunction = (params?: Record<string, any>) => string

/**
 * JIT-компилятор шаблонов.
 * Преобразует строку "Привет, {name}!" в функцию (p) => "Привет, " + p.name + "!"
 */
export function compileTemplate(template: string): MessageFunction {
  if (!template.includes('{')) {
    return () => template
  }

  const parts: (string | { key: string, fallback: string })[] = []
  let lastIndex = 0
  const regex = /\{(\w+)\}/g
  let match = regex.exec(template)

  while (match) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index))
    }
    parts.push({ key: match[1], fallback: match[0] })
    lastIndex = match.index + match[0].length
    match = regex.exec(template)
  }

  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex))
  }

  return (params?: Record<string, any>) => {
    if (!params) {
      return template
    }

    let result = ''

    for (const part of parts) {
      if (typeof part === 'string') {
        result += part
      } else {
        const val = params[part.key]
        result += val !== undefined ? String(val) : part.fallback
      }
    }

    return result
  }
}
