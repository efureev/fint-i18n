# Defining Messages and Translation Methods

The `@feugene/fint-i18n` library offers flexible ways to define messages: from static JSON files to dynamic merging of objects at runtime.

## Message Format

Messages are standard JS objects (or JSON files). Unlimited nesting is supported.

```json5
// common.json
{
  "welcome": "Welcome, {name}!",
  "actions": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

### Parameters (Placeholders)

You can use named parameters in curly braces `{param}`.
When calling `t()`, these parameters will be replaced by their corresponding values.

```json
{
  "notifications": "You have {count} new messages"
}
```

## Methods for Defining Translations

### 1. Static Loaders (Lazy Loading)

This is the recommended method for most applications. Translations are loaded on demand, splitting your application into chunks.

```typescript
// messages/en.ts
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

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
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

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
export { en } from './en'
export { ru } from './ru'
```

Each locale lives in its own module and is exported by name — this lets the
application import only the languages it needs while the bundler tree-shakes
the rest. See [Authoring localization
packages](./authoring-localization-packages.md) for the full guideline.

### 2. Composition of Loaders from Multiple Packages

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { en as appEn, ru as appRu } from './messages'
import { en as granularityEn, ru as granularityRu } from '@feugene/granularity/i18n'

const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  // Only the locales the application actually ships are bundled.
  loaders: [appEn, appRu, granularityEn, granularityRu],
})
```

If multiple collections declare the same block, their loaders will be
executed sequentially in the order of the `loaders: [...]` array.

### 3. Multiple Loaders for a Single Block

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

This is useful when a single block needs to be assembled from multiple sources within one package.

### 4. Dynamic Merging (mergeMessages)

If you need to add translations dynamically (e.g., received via an API or from a third-party plugin), use the `mergeMessages` method.

```typescript
const { mergeMessages } = useFintI18n()

// Adding new messages to the 'custom' block for the current locale
mergeMessages('custom', {
  dynamic_key: 'Dynamic value'
})
```

> [!NOTE]
> `mergeMessages` automatically precompiles all passed strings into optimized functions.

## Deep Structures and Partial Loading

The library supports a hierarchical structure of blocks. You can load an entire block or just parts of it.

Example loader structure:
```typescript
const loaders = {
  en: {
    pages: () => import('./locales/en/pages.json'),
    'pages.articles': () => import('./locales/en/pages/articles.json'),
  }
}
```

If you call `loadBlock('pages.articles')`, only the specified JSON will be loaded. If `pages.json` already contained some data, they will be merged.

### Merge and Resolve Rules

- First, it looks for an exact `blockName`.
- If an exact block is not found, the library looks for the nearest parent block (`pages.articles.comments` → `pages.articles` → `pages`).
- All found loaders for the block are executed sequentially.
- When merging messages, the last value for a key wins.
- For top-level `loaders: [packageA, packageB, packageC]`, the override order matches the array order.

## Compilation Features

When loading a block (whether via a loader or `mergeMessages`), all template strings recursively pass through a **JIT compiler**.
This transforms the string `"Hello, {name}!"` into a function:
`params => "Hello, " + params.name + "!"`.

This ensures:
- **Instant Resolution**: No time is spent parsing strings or RegExps when calling `t()`.
- **Minimal Overhead**: Caching of compiled functions happens automatically.
