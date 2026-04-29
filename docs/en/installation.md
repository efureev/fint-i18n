# Installation and Getting Started

`@feugene/fint-i18n` is a lightweight and performant localization solution for Vue 3 applications, developed with a focus on speed and minimal bundle size.

## Installation

Install the package using your dependency manager:

```bash
# yarn
yarn add @feugene/fint-i18n

# npm
npm install @feugene/fint-i18n

# pnpm
pnpm add @feugene/fint-i18n
```

## Basic Configuration

To get started, you need to create an i18n instance and register it as a plugin in your Vue application.

### 1. Preparing the File Structure

Recommended file structure for storing translations:

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
      en.ts        # English locale loaders
      ru.ts        # Russian locale loaders
      index.ts     # Per-locale re-exports (see below)
  main.ts          # Application initialization
```

> [!TIP]
> Each locale lives in its own module. This lets the application and any
> donor packages import only the languages they actually need, while the
> bundler tree-shakes the rest. See
> [Authoring localization packages](./authoring-localization-packages.md).

### 2. Per-locale loader exports (`i18n/messages/*`)

Loaders allow the library to load translations asynchronously, splitting
them into chunks. Each language is declared in its own file — this is the
recommended layout both for applications and for donor packages.

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

### 3. Initialization in `main.ts`

```typescript
// src/main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
// Import only the locales the application actually ships.
import { en as appEn, ru as appRu } from './i18n/messages'
import { en as granularityEn, ru as granularityRu } from '@feugene/granularity/i18n'

const i18n = createFintI18n({
  locale: 'en',           // Initial language
  fallbackLocale: 'en',   // Fallback language
  // Locales not listed here are tree-shaken out of the production bundle.
  loaders: [appEn, appRu, granularityEn, granularityRu],
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
```

> [!TIP]
> If you have only one locale and one package with translations, `loaders`
> can still be passed as a single `LocaleLoaderCollection` without an array.

## Merge and Resolve Rules

- `loaders: [packageA, packageB]` are merged **from left to right**.
- If the same `block` is declared in multiple packages, its loaders are combined into an array in the same order.
- If a `block` already has an array of loaders, it is flattened into the general list.
- All loaders for a found block are executed **sequentially**.
- In case of key conflicts in messages, the last loaded value overrides the previous one.
- When `loadBlock('pages.articles')` is called, it first looks for an exact block match, then the nearest parent block (`pages`).

## TypeScript

The package is written entirely in TypeScript and provides excellent DX out of the box. If you use `Volar` (or the `Vue - Official` extension), you will get type support in templates for global properties such as `$t`.

> [!TIP]
> For maximum performance, the library uses JIT compilation. This means your string templates will be turned into optimized JS functions immediately after loading.
