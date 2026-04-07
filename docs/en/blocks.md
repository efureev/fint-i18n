# Translation Blocks: Concept and Usage

Blocks are a key concept in the `@feugene/fint-i18n` architecture. They allow for logical separation of translations, isolation of application modules, and performance optimization.

## What is a Block?

A **block** is a named set of messages. For example: `auth`, `admin`, `common`, `dashboard`.

Advantages of using blocks:
1. **Isolation**: Keys in different blocks do not conflict.
2. **Lazy Loading**: You can load translations for a specific page only when the user navigates to it.
3. **Performance**: The engine looks for keys within the target block first, which is faster than searching through a giant global object.

## Working with Blocks

### 1. Declarative Declaration (useI18nScope)

This is the most convenient way for Vue components. It automatically loads the specified blocks and manages their lifecycle (reference counting).

```vue
<script setup>
import { useI18nScope } from '@feugene/fint-i18n/vue'

// Asynchronously load blocks before the component renders
await useI18nScope(['auth', 'profile'])
</script>
```

> [!TIP]
> Use `<Suspense>` at the root of your application for asynchronous composables to work correctly.

### 2. Manual Loading (loadBlock)

The `loadBlock` method allows you to load a block at any time.

```typescript
const { loadBlock } = useFintI18n()

await loadBlock('admin')
console.log('Block loaded!')
```

## Can I Work Without Blocks?

Technically, **yes**, but in practice, you are always using at least one block.

If you want a flat structure "like in classic i18n," simply define all your keys in a single block, such as `app`.

```typescript
// messages.ts
export const loaders = {
  en: {
    app: () => import('./locales/en.json')
  }
}

// Usage
t('app.welcome')
t('app.buttons.save')
```

The library **requires** that the first part of a key is always the block name. This ensures high performance during resolution (searching the Flat Map cache is O(1)).

## Hierarchy and Partial Loading

You can create nested blocks by using a dot in the name.

```typescript
// In messages.ts
const loaders = {
  en: {
    'pages.articles': () => import('./articles.json'),
  },
}

// In code
await useI18nScope(['pages.articles'])
t('pages.articles.title')
```

If you load `pages.articles`, the library marks this path as loaded. You can still have a separate loader for the parent block `pages`.

## Loader Resolving

When `loadBlock(blockName)` is called, the library follows these rules:

1. It first searches for an **exact** match for `blockName`.
2. If no exact match is found and the block is nested, it looks for the nearest parent block.
3. If multiple loaders are registered for the found block, they are executed **sequentially**.

Example:

```typescript
const loaders = {
  en: {
    page: () => import('./page.json'),
  },
}

await i18n.loadBlock('page.articles')
```

In this case, the loader for the `page` block will be used.

## Merging Loaders from Multiple Packages

`createFintI18n()` can accept multiple package collections:

```typescript
const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders: [package1LocaleLoaders, package2LocaleLoaders],
})
```

Merge rules:

- Package collections are merged **from left to right**.
- Identical block keys do not conflict; they are combined into a common list of loaders.
- If a loader within a package is already an array, it is flattened into this common list.
- In case of message key conflicts, the last loaded value wins.

## Lifecycle and Memory

`useI18nScope` implements a **Reference Counting** mechanism.
- When the first component requests the `auth` block, it is loaded into memory.
- When other components request `auth`, they use the already loaded data.
- (Optional) When the last component using `auth` is unmounted, the data can be cleared to save memory (if configured).
