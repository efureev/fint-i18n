# @feugene/fint-i18n

[Русская версия (Russian version)](./README.ru.md)

Localization library for Vue 3 with lazy-loading blocks, template compilation, and extensible plugins.

## Features

- **Small surface area**: The package is split into `core`, `vue`, and `plugins` entry points.
- **Performant runtime**: Templates are compiled into functions and cached.
- **Async blocks**: Support for splitting translations into blocks and lazy-loading them.
- **Bridge Mode**: Transparent integration with `vue-i18n`.
- **Plugins**: Hook system for extending functionality (persistence, logging, etc.).
- **Simple runtime contract**: The only peer dependency is `vue`.

## Documentation

You can find detailed information about the library in the relevant sections:

- 📦 **[Installation and Getting Started](./docs/en/installation.md)**: How to install the package and configure it in a Vue application.
- 📂 **[Defining Messages](./docs/en/defining-messages.md)**: JSON formats, loaders, and dynamic merging.
- 🚀 **[Usage](./docs/en/usage.md)**: How to use `t()`, `$t`, and the `v-t` directive.
- 📘 **[API Reference](./docs/en/api.md)**: Detailed description of all functions, methods, and composables.
- 🔌 **[Plugins](./docs/en/plugins.md)**: Extending functionality via the hook system and built-in plugins.
- 🧱 **[Translation Blocks](./docs/en/blocks.md)**: Deep dive into the concept of blocks and memory management.
- ⚡ **[Benchmarks and Bundle Analysis](./docs/en/bundle-analysis.md)**: How to measure the hot path and analyze the `dist` composition.

---

## Quick Start

### 1. Initialization

```typescript
import { createApp } from 'vue'
import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { appLocaleLoaders } from './i18n/messages'
import { fintDsLocaleLoaders } from '@feugene/fint-ds/i18n'

const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders: [appLocaleLoaders, fintDsLocaleLoaders],
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
```

`loaders` accepts:

- `LocaleLoaderCollection` — a single locale/block collection;
- `LocaleLoaderCollection[]` — an array of collections from multiple packages;
- for each `block`, you can pass a single loader or an array of loaders.

Rules:

- collections in `loaders: [...]` are merged **from left to right**;
- if the same `block` is found in multiple collections, loaders are combined into an array;
- loaders for a single block are executed **sequentially**;
- in case of key conflicts in messages, the **last** loader wins;
- when `loadBlock('pages.articles')` is called, it first looks for an exact block match, then the nearest parent block (`pages`).

### 2. Usage in components

```vue
<script setup>
import { useFintI18n, useI18nScope } from '@feugene/fint-i18n/vue'

// Connect necessary blocks (they will load automatically)
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
    
    <!-- Directive usage -->
    <span v-t="'auth.login'" />
  </div>
</template>
```
