# Определение сообщений и способы задания переводов

Библиотека `@feugene/fint-i18n` предлагает гибкие способы задания сообщений: от статических JSON-файлов до динамического мерджа объектов в рантайме.

## Формат сообщений

Сообщения — это обычные объекты JS (или JSON-файлы). Поддерживается неограниченная вложенность.

```json5
// common.json
{
  "welcome": "Добро пожаловать, {name}!",
  "actions": {
    "save": "Сохранить",
    "cancel": "Отмена"
  }
}
```

### Параметры (плейсхолдеры)

Вы можете использовать именованные параметры в фигурных скобках `{param}`.
При вызове `t()` эти параметры будут заменены соответствующими значениями.

```json
{
  "notifications": "У вас {count} новых сообщений"
}
```

## Способы задания переводов

### 1. Статические лоадеры (Lazy Loading)

Это рекомендуемый способ для большинства приложений. Переводы загружаются по требованию, разделяя ваше приложение на чанки.

```typescript
// messages.ts
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

export const appLocaleLoaders: LocaleLoaderCollection = {
  en: {
    common: () => import('./locales/en/common.json'),
    admin: () => import('./locales/en/admin.json'),
  },
  ru: {
    common: () => import('./locales/ru/common.json'),
    admin: () => import('./locales/ru/admin.json'),
  }
}
```

Такую `LocaleLoaderCollection` можно экспортировать из пакета как публичный i18n-контракт и затем подключать в приложении одной строкой.

### 2. Композиция loaders из нескольких пакетов

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { appLocaleLoaders } from './messages'
import { fintDsLocaleLoaders } from '@feugene/fint-ds/i18n'

const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders: [appLocaleLoaders, fintDsLocaleLoaders],
})
```

Если несколько пакетов объявляют один и тот же block, их loaders будут выполнены последовательно в порядке массива `loaders: [...]`.

### 3. Несколько loaders для одного блока

```typescript
export const appLocaleLoaders: LocaleLoaderCollection = {
  en: {
    common: [
      () => import('./locales/en/common.base.json'),
      () => import('./locales/en/common.override.json'),
    ],
  },
}
```

Это полезно, когда один block нужно собрать из нескольких источников внутри одного пакета.

### 4. Динамический мердж (mergeMessages)

Если вам нужно добавить переводы динамически (например, полученные через API или из стороннего плагина), используйте метод `mergeMessages`.

```typescript
const { mergeMessages } = useFintI18n()

// Добавляем новые сообщения в блок 'custom' для текущей локали
mergeMessages('custom', {
  dynamic_key: 'Динамическое значение'
})
```

> [!NOTE]
> `mergeMessages` автоматически прекомпилирует все переданные строки в оптимизированные функции.

## Глубокие структуры и Partial Loading

Библиотека поддерживает иерархическую структуру блоков. Вы можете загружать как весь блок целиком, так и его части.

Пример структуры лоадеров:
```typescript
const loaders = {
  en: {
    pages: () => import('./locales/en/pages.json'),
    'pages.articles': () => import('./locales/en/pages/articles.json'),
  }
}
```

Если вы вызовете `loadBlock('pages.articles')`, загрузится только указанный JSON. При этом, если в `pages.json` уже были какие-то данные, они будут объединены.

### Правила merge и правила resolve

- Сначала ищется точный `blockName`.
- Если точный block не найден, библиотека ищет ближайший parent block (`pages.articles.comments` → `pages.articles` → `pages`).
- Все найденные loaders для блока выполняются последовательно.
- При merge сообщений последнее значение по ключу побеждает.
- Для top-level `loaders: [packageA, packageB, packageC]` порядок override соответствует порядку массива.

## Особенности компиляции

При загрузке блока (будь то через лоадер или `mergeMessages`), все строки-шаблоны рекурсивно проходят через **JIT-компилятор**. 
Это превращает строку `"Hello, {name}!"` в функцию: 
`params => "Hello, " + params.name + "!"`.

Это обеспечивает:
- **Мгновенный резолв**: При вызове `t()` не тратится время на парсинг строки или RegExp.
- **Минимальный оверхед**: Кэширование скомпилированных функций происходит автоматически.
