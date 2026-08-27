import type { Locale, MessageSchema } from '../core'

/**
 * Тот же путь, что у плагина в `src/vite`. Строка продублирована намеренно:
 * слои развязаны — devtools живёт в браузере, плагин в node, — и импорт одного
 * из другого протащил бы `node:fs` в бандл. Расхождение стережёт тест
 * `dev-server.test.ts`.
 */
export const DEV_SERVER_ENDPOINT = '/__fint-i18n/messages'

export interface DevServerBridge {
  /** `null`, пока не спрашивали. */
  readonly available: boolean | null
  probe: () => Promise<boolean>
  /** Записывает патч в словари на диске; возвращает пути изменённых файлов. */
  write: (patch: Record<Locale, MessageSchema>, options?: { overwrite?: boolean }) => Promise<string[]>
}

/**
 * Клиент к плагину dev-сервера (`@feugene/fint-i18n/vite`). Замыкает цикл:
 * промах или правка в панели доезжают до словаря на диске, а не остаются в
 * памяти вкладки.
 *
 * Без плагина `probe()` вернёт `false`, и панель просто не покажет кнопок —
 * ошибок это не создаёт.
 */
export function createDevServer(endpoint = DEV_SERVER_ENDPOINT): DevServerBridge {
  let available: boolean | null = null

  return {
    get available() {
      return available
    },

    async probe() {
      if (typeof fetch !== 'function') {
        available = false
        return false
      }

      try {
        const response = await fetch(endpoint)
        // Плагина нет — dev-сервер отдаст index.html со статусом 200, поэтому
        // одного `ok` мало: сверяем, что ответ наш.
        available = response.ok && (await response.json()).ok === true
      }
      catch {
        available = false
      }

      return available
    },

    async write(patch, options = {}) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patch, overwrite: options.overwrite === true }),
      })

      const data = await response.json() as { ok: boolean, written?: string[], error?: string }
      if (!data.ok) throw new Error(data.error ?? 'unknown error')

      return data.written ?? []
    },
  }
}
