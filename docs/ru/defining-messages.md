# Определение сообщений и способы задания переводов

Библиотека `@feugene/fint-i18n` предлагает гибкие способы задания сообщений: от статических JSON-файлов до динамического
мерджа объектов в рантайме.

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

Вы можете использовать именованные параметры в фигурных скобках `{param}`. При вызове `t()` эти параметры будут заменены
соответствующими значениями.

```json
{
  "notifications": "У вас {count} новых сообщений"
}
```

### Формы множественного числа

Формы множественного числа — это объект, все ключи которого являются ключами
форм: категориями CLDR (`zero`, `one`, `two`, `few`, `many`, `other`) либо
точными значениями (`=0`, `=-1`). `other` обязателен.

```json
{
  "files": {
    "=0": "нет файлов",
    "one": "{n} file",
    "other": "{n} files"
  },
  "filesRu": {
    "one": "{n} файл",
    "few": "{n} файла",
    "many": "{n} файлов",
    "other": "{n} файла"
  }
}
```

Форма выбирается по параметру `count` (или `n`): `t('files', { n: 5 })`.

Поскольку плюрализация — это форма значения, ни один символ внутри строки
сообщения не является специальным: `"Name | Email"` — обычный текст и всегда
выводится целиком. Объект считается набором форм, только если **все** его ключи
являются ключами форм, поэтому обычное пространство имён за формы принято не
будет. Полный справочник: [api.md](./api.md#плюрализация).

## Способы задания переводов

### 1. Статические лоадеры (Lazy Loading)

Это рекомендуемый способ для большинства приложений. Переводы загружаются по требованию, разделяя ваше приложение на
чанки.

```typescript
// messages/en.ts
import type {LocaleLoaderCollection} from '@feugene/fint-i18n/core'

export const en: LocaleLoaderCollection = {
    en: {
        common: () => import('../locales/en/common.json'),
        admin: () => import('../locales/en/admin.json'),
    },
}

export default en
```

```typescript
// messages/ru.ts
import type {LocaleLoaderCollection} from '@feugene/fint-i18n/core'

export const ru: LocaleLoaderCollection = {
    ru: {
        common: () => import('../locales/ru/common.json'),
        admin: () => import('../locales/ru/admin.json'),
    },
}

export default ru
```

```typescript
// messages/index.ts
export {en} from './en'
export {ru} from './ru'
```

Каждая локаль живёт в отдельном модуле и экспортируется именованно — это позволяет приложению импортировать только
нужные языки, а сборщику — выбросить остальные при tree-shaking. Подробнее
см. [Authoring localization packages](./authoring-localization-packages.md).

### 2. Композиция loaders из нескольких пакетов

```typescript
import {createFintI18n} from '@feugene/fint-i18n/core'
import {en as appEn, ru as appRu} from './messages'
import {en as granularityEn, ru as granularityRu} from '@feugene/granularity/i18n'

const i18n = createFintI18n({
    locale: 'en',
    fallbackLocale: 'en',
    // Указываем только те локали, что реально нужны приложению.
    loaders: [appEn, appRu, granularityEn, granularityRu],
})
```

Если несколько коллекций объявляют один и тот же block, их loaders будут выполнены последовательно в порядке массива
`loaders: [...]`.

### 3. Несколько loaders для одного блока

```typescript
export const en: LocaleLoaderCollection = {
    en: {
        common: [
            () => import('../locales/en/common.base.json'),
            () => import('../locales/en/common.override.json'),
        ],
    },
}
```

Это полезно, когда один block нужно собрать из нескольких источников внутри одного пакета.

### 4. Динамический мердж (mergeMessages)

Если вам нужно добавить переводы динамически (например, полученные через API или из стороннего плагина), используйте
метод `mergeMessages`.

```typescript
const {mergeMessages} = useFintI18n()

// Добавляем новые сообщения в блок 'custom' для текущей локали
mergeMessages('custom', {
    dynamic_key: 'Динамическое значение'
})
```

> [!NOTE]
> `mergeMessages` только мерджит. Сообщение компилируется в функцию при первом
> обращении к нему, результат кэшируется — большой блок не платит за строки,
> которые никто не отрисовывает.

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

Если вы вызовете `loadBlock('pages.articles')`, загрузится только указанный JSON. При этом, если в `pages.json` уже были
какие-то данные, они будут объединены.

### Правила merge и правила resolve

- Сначала ищется точный `blockName`.
- Если точный block не найден, библиотека ищет ближайший parent block (`pages.articles.comments` → `pages.articles` →
  `pages`).
- Все найденные loaders для блока выполняются последовательно.
- При merge сообщений последнее значение по ключу побеждает.
- Для top-level `loaders: [packageA, packageB, packageC]` порядок override соответствует порядку массива.

## Особенности компиляции

Сообщение проходит через **JIT-компилятор** при первом обращении к нему. Это превращает
строку `"Hello, {name}!"` в функцию: `params => "Hello, " + params.name + "!"`.
Функция кэшируется по паре «локаль + ключ».

Это обеспечивает:

- **Мгновенный резолв**: при последующих вызовах `t()` не тратится время на парсинг строки или RegExp.
- **Ничего лишнего**: загрузка блока стоит мерджа, а не компиляции всех строк в нём.
