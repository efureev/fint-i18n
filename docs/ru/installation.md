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
    messages.ts    # Конфигурация лоадеров
  main.ts          # Инициализация приложения
```

### 2. Экспорт package-level лоадеров (`i18n/messages.ts`)

Лоадеры позволяют библиотеке загружать переводы асинхронно, разделяя их на чанки.

```typescript
// src/i18n/messages.ts
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

export const appLocaleLoaders: LocaleLoaderCollection = {
  en: {
    common: () => import('./locales/en/common.json'),
    auth: () => import('./locales/en/auth.json'),
  },
  ru: {
    common: () => import('./locales/ru/common.json'),
    auth: () => import('./locales/ru/auth.json'),
  }
}
```

### 3. Инициализация в `main.ts`

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { appLocaleLoaders } from './i18n/messages'
import { fintDsLocaleLoaders } from '@feugene/fint-ds/i18n'

const i18n = createFintI18n({
  locale: 'ru',           // Начальный язык
  fallbackLocale: 'en',   // Резервный язык
  loaders: [appLocaleLoaders, fintDsLocaleLoaders],
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
```

> [!TIP]
> Если у вас только один пакет с переводами, `loaders` по-прежнему можно передать одной `LocaleLoaderCollection` без массива.

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
