# Плагины и расширение функционала

Библиотека `@feugene/fint-i18n` предоставляет расширяемую систему плагинов, основанную на хуках жизненного цикла. Это позволяет добавлять новый функционал (персистентность, логирование, интеграцию со сторонними библиотеками) без утяжеления ядра.

## Встроенные плагины

### PersistencePlugin

Этот плагин отвечает за сохранение выбранной локали в хранилище (по умолчанию `localStorage`) и синхронизацию её между открытыми вкладками браузера.

#### Установка

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { PersistencePlugin, type PersistenceOptions } from '@feugene/fint-i18n/plugins'

const options: PersistenceOptions = {
  key: 'my-app-locale', // Ключ в localStorage
  syncTabs: true        // Синхронизация между вкладками
}

const i18n = createFintI18n({
  // ...
  plugins: [
    new PersistencePlugin(options)
  ]
})
```

##### Интерфейс `PersistenceOptions`

```typescript
interface PersistenceOptions {
  key?: string;             // Ключ для хранения локали (по умолчанию 'fint-i18n-locale')
  storage?: Storage;        // Объект хранилища (по умолчанию localStorage)
  syncTabs?: boolean;       // Синхронизация между вкладками браузера (true по умолчанию)
  allowedLocales?: Locale[]; // Локали, которые плагину разрешено восстанавливать
}
```

#### Особенности
- **Автоматическая загрузка**: При инициализации плагин проверяет наличие сохраненного значения в `storage`.
- **Синхронизация вкладок**: Использует событие `storage` для мгновенного обновления локали во всех открытых вкладках при её изменении в одной из них.
- **Валидация**: значение из хранилища применяется, только если о существовании локали есть подтверждение — из `allowedLocales`, из зарегистрированных лоадеров или из уже загруженных словарей. Устаревший или подменённый ключ поэтому не может оставить приложение вообще без переводов.
- **Подбор**: сохранённый тег сопоставляется через [`negotiateLocale()`](./api.md#подбор-локали), а не по точному равенству строк. Локаль, сохранённая как `ru-RU`, при доступной `ru` приводится к `ru` и применяется — значение в хранилище обычно пришло из браузера, а значит обычно с регионом. Тег постороннего языка по-прежнему отвергается.

> [!IMPORTANT]
> Если словари задаются через `mergeMessages()`, а не лоадерами, библиотеке неоткуда узнать список локалей — сохранённое значение будет проигнорировано с предупреждением. В такой схеме передавайте `allowedLocales`.

```typescript
new PersistencePlugin({ allowedLocales: ['en', 'ru'] })
```

---

### BridgePlugin

Позволяет прозрачно использовать `fint-i18n` совместно с существующим инстансом `vue-i18n`. Это полезно в больших проектах или при использовании сторонних библиотек, зависящих от `vue-i18n`.

#### Установка

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { BridgePlugin, type BridgeOptions } from '@feugene/fint-i18n/plugins'
import { createI18n } from 'vue-i18n'

const vueI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { /* ... */ }
})

const options: BridgeOptions = {
  i18n: vueI18n,
}

const i18n = createFintI18n({
  // ...
  plugins: [
    new BridgePlugin(options)
  ]
})
```

##### Интерфейс `BridgeOptions`

```typescript
interface BridgeOptions {
  i18n: any; // Экземпляр vue-i18n (Composer или Legacy i18n)
}
```

#### Особенности
- **Двусторонняя синхронизация**: При изменении локали в `fint-i18n`, она автоматически меняется в `vue-i18n` и наоборот.
- **Fallback переводы**: Если ключ не найден в блоках `fint-i18n`, плагин попытается разрешить его через `vue-i18n`.

---

### HookLoggerPlugin

Плагин для отладки, который пишет в консоль каждый вызванный хук `fint-i18n`. Полезен при диагностике загрузки блоков, переводов, смены локали и поиска отсутствующих ключей.

#### Установка

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { HookLoggerPlugin, type HookLoggerPluginOptions } from '@feugene/fint-i18n/plugins'

const options: HookLoggerPluginOptions = {
  prefix: '[demo-i18n]',
}

const i18n = createFintI18n({
  locale: 'en',
  plugins: [
    new HookLoggerPlugin(options)
  ]
})
```

#### Пример использования

```typescript
await i18n.loadBlock('common')
i18n.t('common.greeting', { name: 'John' })
await i18n.setLocale('fr')

// Консоль:
// [demo-i18n] "afterInit" called undefined
// [demo-i18n] "beforeLoadBlock" called { block: 'common', locale: 'en' }
// [demo-i18n] "afterLoadBlock" called { block: 'common', locale: 'en', messages: { ... } }
// [demo-i18n] "onTranslate" called { key: 'common.greeting', params: { name: 'John' }, result: 'Hello John' }
// [demo-i18n] "onLocaleChange" called { locale: 'fr', previous: 'en' }
```

##### Интерфейс `HookLoggerPluginOptions`

```typescript
interface HookLoggerPluginOptions {
  logger?: (message?: any, ...optionalParams: any[]) => void; // Функция логирования, по умолчанию console.log
  prefix?: string; // Префикс сообщения, по умолчанию '[fint-i18n] Hook'
}
```

#### Особенности
- **Логирует все встроенные хуки**: `afterInit`, `onLocaleChange`, `beforeLoadBlock`, `afterLoadBlock`, `onMissingKey`, `onTranslate`, `onFallback`, `onRetry`, `onError`, `onWarning`.
- **Не влияет на поток данных**: Плагин возвращает исходный payload каждого хука и подходит для безопасной отладки.
- **Настраиваемый вывод**: Можно передать собственный `logger` и изменить `prefix`.

---

## Создание собственного плагина

Система плагинов построена на классах, которые реализуют метод `install(instance)`. Внутри этого метода вы можете подписываться на хуки.

```typescript
import type { FintI18n, FintI18nPlugin } from '@feugene/fint-i18n/core'

export class MyLoggerPlugin implements FintI18nPlugin {
  public name = 'my-logger'

  install(i18n: FintI18n) {
    // Подписка на хук перевода
    const off = i18n.hooks.on('onTranslate', (data) => {
      console.log(`[i18n] Перевод ключа "${data.key}": ${data.result}`)
    })

    // Позже можно вызвать off() для отписки
  }
}
```

### Доступные хуки

| Хук | Описание | Тип данных (Data) |
| :--- | :--- | :--- |
| `afterInit` | Вызывается после инициализации инстанса | `void` |
| `onLocaleChange` | Вызывается при смене языка | `{ locale: Locale, previous: Locale }` |
| `onTranslate` (Sync) | Вызывается в момент перевода (в `t()`) | `{ key: string, params?: Record<string, any>, result: string }` |
| `beforeLoadBlock` | Перед началом загрузки блока | `{ block: string, locale: Locale }` |
| `afterLoadBlock` | После успешной загрузки блока | `{ block: string, locale: Locale, messages: any }` |
| `onMissingKey` | Если ключ не найден в текущей локали | `{ locale: Locale, key: string }` |
| `onFallback` (Sync) | Перевод дала запасная локаль: в текущей ключа нет | `{ key: string, locale: Locale, fallbackLocale: Locale }` |
| `onRetry` (Sync) | Отказ лоадера, после которого будет ещё попытка | `{ block: string, locale: Locale, attempt: number, error: unknown }` |
| `onError` | Отказ загрузки блока — любым путём. Без подписчиков — `console.error` | `{ error: unknown, block?: string, locale?: Locale }` |
| `onWarning` (Sync) | Проблема конфигурации. Без подписчиков — `console.warn` | `{ code: WarningCode, message: string, context?: Record<string, unknown> }` |

### Предупреждения: `onWarning`

Блок без лоадера, wildcard, не совпавший ни с одним блоком, сохранённая локаль,
которой не существует, — это ошибки конфигурации, и без подписчика они видны
только тому, кто открыл консоль. Подписчик получает их структурно и может
отправить куда угодно; пока подписчика нет, всё идёт в `console.warn`.

```typescript
i18n.hooks.on('onWarning', ({ code, message, context }) => {
  if (code === 'no-loader') reportToSentry(message, context)
})
```

| Код | Когда |
| :--- | :--- |
| `no-loader` | Для блока нет лоадера в этой локали |
| `pattern-no-match` | Wildcard не совпал ни с одним зарегистрированным блоком |
| `scope-prefix-ignored` | `prefix: true` со списком блоков или с паттерном |
| `persisted-locale-unknown` | `PersistencePlugin` не смог подтвердить сохранённую локаль |
| `ssr-function-messages` | В SSR-снимке есть сообщения-функции, которых не переживёт JSON |
| `deprecated-locale-setter` | Запись в `locale.value` вместо `setLocale()` |

Код существует затем, чтобы различать случаи машинно, а не разбором текста.
Произвольная строка тоже допустима — плагин шлёт в этот же канал свои
предупреждения со своими кодами:

```typescript
import { warn } from '@feugene/fint-i18n/core'

warn(i18n.hooks, 'my-plugin:stale-cache', 'Кэш устарел', { age: 3600 })
```

**Чего канал не покрывает.** Предупреждения `Intl` — невалидный тег локали,
невалидные опции форматирования, невалидная дата — и предупреждение о неполном
наборе плюральных форм остаются только в консоли: их кэши модульные, до инстанса
оттуда не дотянуться.
