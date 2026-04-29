# @feugene/fint-i18n

[![codecov](https://codecov.io/gh/efureev/fint-i18n/branch/main/graph/badge.svg)](https://codecov.io/gh/efureev/fint-i18n)
[![npm version](https://badge.fury.io/js/@feugene%2Ffint-i18n.svg)](https://badge.fury.io/js/@feugene%2Ffint-i18n)

Библиотека локализации для Vue 3 с ленивой загрузкой блоков, компиляцией шаблонов и расширяемыми плагинами.

## Особенности

- **Небольшой surface area**: пакет разбит на `core`, `vue` и `plugins` энтрипойнты.
- **Производительный runtime**: шаблоны компилируются в функции и кэшируются.
- **Асинхронные блоки**: Поддержка разделения переводов на блоки и их ленивая загрузка.
- **Bridge Mode**: Прозрачная интеграция с `vue-i18n`.
- **Плагины**: Система хуков для расширения функционала (персистентность, логирование и т.д.).
- **Простой runtime-контракт**: единственная peer dependency — `vue`.

## Документация

Подробную информацию о работе с библиотекой вы найдете в соответствующих разделах:

- 📦 **[Установка и начало работы](./docs/ru/installation.md)**: Как установить пакет и настроить его в приложении Vue.
- 📂 **[Определение сообщений](./docs/ru/defining-messages.md)**: Форматы JSON, лоадеры и динамический мердж.
- 🌐 **[Гайд для авторов локализационных пакетов](./docs/ru/authoring-localization-packages.md)**: Контракт per-locale экспортов для tree-shakable пакетов-доноров.
- 🚀 **[Использование](./docs/ru/usage.md)**: Как использовать `t()`, `$t` и директиву `v-t`.
- 📘 **[Справочник API](./docs/ru/api.md)**: Подробное описание всех функций, методов и композаблов.
- 🔌 **[Плагины](./docs/ru/plugins.md)**: Расширение функционала через систему хуков и встроенные плагины.
- 🧱 **[Блоки перевода](./docs/ru/blocks.md)**: Глубокое погружение в концепцию блоков и управление памятью.
- ⚡ **[Бенчмарки и анализ бандла](./docs/ru/bundle-analysis.md)**: Как мерить hot path и смотреть состав собранного `dist`.

---

## Быстрый старт

### 1. Инициализация

```typescript
import { createApp } from 'vue'
import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { en as appEn, ru as appRu } from './i18n/messages'
import { en as granularityEn, ru as granularityRu } from '@feugene/granularity/i18n'
const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  // Импортируйте только те локали, которые реально нужны приложению —
  // остальные сборщик удалит при tree-shaking.
  loaders: [appEn, appRu, granularityEn, granularityRu],
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
```

`loaders` принимает:

- `LocaleLoaderCollection` — одна locale/block-коллекция;
- `LocaleLoaderCollection[]` — массив коллекций из нескольких пакетов;
- для каждого `block` можно передать один loader или массив loaders.

Правила работы:

- коллекции в `loaders: [...]` мерджатся **слева направо**;
- если один и тот же `block` встречается в нескольких коллекциях, loaders объединяются в массив;
- loaders одного блока выполняются **последовательно**;
- при конфликте ключей в сообщениях побеждает **последний** loader;
- при `loadBlock('pages.articles')` сначала ищется точный block, затем ближайший parent block (`pages`).

### 2. Использование в компонентах

```vue
<script setup>
import { useFintI18n, useI18nScope } from '@feugene/fint-i18n/vue'

// Подключаем необходимые блоки (автоматически загрузятся)
await useI18nScope(['common', 'auth'])

const { t, locale, setLocale } = useFintI18n()

const changeLanguage = async () => {
  await setLocale(locale.value === 'en' ? 'ru' : 'en')
}
</script>

<template>
  <div>
    <p>{{ t('common.welcome', { name: 'User' }) }}</p>
    <button @click="changeLanguage">
Change Language
</button>
    
    <!-- Использование директивы -->
    <span v-t="'auth.login'" />
  </div>
</template>
```

