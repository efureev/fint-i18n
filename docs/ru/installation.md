# Установка и начало работы

`@feugene/fint-i18n` — это легковесное и производительное решение для локализации приложений на Vue 3, разработанное с упором на скорость работы и минимальный размер бандла.

## Установка

Установите пакет с помощью вашего менеджера зависимостей:

```bash
# yarn
yarn add @feugene/fint-i18n

# npm
npm install @feugene/fint-i18n

# pnpm
pnpm add @feugene/fint-i18n
```

## Базовая конфигурация

Для начала работы необходимо создать экземпляр i18n и зарегистрировать его как плагин в приложении Vue.

### 1. Подготовка структуры файлов

Рекомендуемая структура файлов для хранения переводов:

```text
src/
  i18n/
    locales/
      en/
        common.json
        auth.json
      ru/
        common.json
        auth.json
    messages/
      en.ts        # Лоадеры английской локали
      ru.ts        # Лоадеры русской локали
      index.ts     # Реэкспорт per-locale (см. ниже)
  main.ts          # Инициализация приложения
```

> [!TIP]
> Каждая локаль выносится в отдельный модуль. Это позволяет приложению
> и пакетам-донорам импортировать только нужные языки, а сборщик удалит
> остальные при tree-shaking. Подробнее см.
> [Authoring localization packages](./authoring-localization-packages.md).

### 2. Экспорт per-locale лоадеров (`i18n/messages/*`)

Лоадеры позволяют библиотеке загружать переводы асинхронно, разделяя их
на чанки. Каждый язык объявляется в отдельном файле — это и есть
рекомендуемый формат для приложений и для пакетов-доноров.

```typescript
// src/i18n/messages/en.ts
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

export const en: LocaleLoaderCollection = {
  en: {
    common: () => import('../locales/en/common.json'),
    auth: () => import('../locales/en/auth.json'),
  },
}

export default en
```

```typescript
// src/i18n/messages/ru.ts
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

export const ru: LocaleLoaderCollection = {
  ru: {
    common: () => import('../locales/ru/common.json'),
    auth: () => import('../locales/ru/auth.json'),
  },
}

export default ru
```

```typescript
// src/i18n/messages/index.ts
export { en } from './en'
export { ru } from './ru'
```

> [!TIP]
> Если нужен «жирный» агрегат всех локалей (для демо, e2e, инструментов),
> заведите отдельный `src/i18n/messages/all.ts` и импортируйте его явно
> (`./i18n/messages/all`). **Не реэкспортируйте `all` из `index.ts`** —
> иначе любой `import { en } from './i18n/messages'` потянет в граф все
> языки и tree-shaking сломается. Подробности и пример настройки
> `package.json#exports` для пакетов-доноров — в
> [Authoring localization packages](./authoring-localization-packages.md#опциональный-allts).

### 3. Инициализация в `main.ts`

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'

// Импортируем только те локали, которые реально нужны приложению.
import { en as appEn, ru as appRu } from './i18n/messages'
import { en as granularityEn, ru as granularityRu } from '@feugene/granularity/i18n'

const i18n = createFintI18n({
  locale: 'ru',           // Начальный язык
  fallbackLocale: 'en',   // Резервный язык
  // Все локали, не перечисленные здесь, будут удалены сборщиком.
  loaders: [appEn, appRu, granularityEn, granularityRu],
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
```

> [!TIP]
> Если у вас только одна локаль и один пакет с переводами, `loaders`
> по-прежнему можно передать одной `LocaleLoaderCollection` без массива.

## Правила merge и resolve

- `loaders: [packageA, packageB]` мерджится **слева направо**.
- Если один и тот же `block` объявлен в нескольких пакетах, его loaders объединяются в массив в том же порядке.
- Если у одного `block` уже указан массив loaders, он flatten-ится в общий список.
- Все loaders найденного блока выполняются **последовательно**.
- При совпадении ключей в сообщениях последнее загруженное значение переопределяет предыдущее.
- При `loadBlock('pages.articles')` сначала ищется точный block, затем ближайший parent block (`pages`).

## TypeScript

Пакет полностью написан на TypeScript и предоставляет отличный DX "из коробки". Если вы используете `Volar` (или расширение `Vue - Official`), вы получите поддержку типов в шаблонах для глобальных свойств, таких как `$t`.

> [!TIP]
> Для максимальной производительности библиотека использует JIT-компиляцию. Это означает, что ваши шаблоны строк будут превращены в оптимизированные JS-функции сразу после загрузки.
