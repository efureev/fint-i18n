export type MessageFunction = (params?: Record<string, any>) => string

/**
 * JIT-компилятор шаблонов.
 * Преобразует строку "Привет, {name}!" в функцию (p) => "Привет, " + p.name + "!"
 *
 * Синтаксис:
 * - `{name}` — подстановка параметра; имя: буквы/цифры/`_`, а также `.` и `-`.
 * - `{{` и `}}` — экранирование: выводятся как литеральные `{` и `}`.
 * - Отсутствующий или null/undefined параметр оставляет плейсхолдер как есть.
 */
export function compileTemplate(template: string): MessageFunction {
  if (!template.includes('{') && !template.includes('}}')) {
    return () => template
  }

  const parts: (string | { key: string, fallback: string })[] = []
  let lastIndex = 0
  let hasPlaceholders = false
  const regex = /\{\{|\}\}|\{([\w.-]+)\}/g
  let match = regex.exec(template)

  while (match) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index))
    }
    if (match[0] === '{{') {
      parts.push('{')
    }
    else if (match[0] === '}}') {
      parts.push('}')
    }
    else {
      parts.push({ key: match[1], fallback: match[0] })
      hasPlaceholders = true
    }
    lastIndex = match.index + match[0].length
    match = regex.exec(template)
  }

  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex))
  }

  // Плейсхолдеров нет (только текст и экранированные скобки) — статичная строка.
  if (!hasPlaceholders) {
    const staticResult = parts.join('')
    return () => staticResult
  }

  return (params?: Record<string, any>) => {
    let result = ''

    for (const part of parts) {
      if (typeof part === 'string') {
        result += part
      }
      else {
        const val = params?.[part.key]
        // null трактуем как отсутствие значения, а не как строку "null"
        result += val == null ? part.fallback : String(val)
      }
    }

    return result
  }
}
