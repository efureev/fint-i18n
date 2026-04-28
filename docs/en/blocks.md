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

> [!IMPORTANT]
> Resolution only walks **child → parent**, never **parent → children**.
> A block name in `loaders` is the **full path of the block**, not a "container" for nested blocks.

### Example: nested blocks are NOT auto-expanded

```typescript
// messages.ts
export const loaders = {
  ru: {
    'components.first':  () => import('./locales/components/first/ru.json'),
    'components.second': () => import('./locales/components/second/ru.json'),
  },
}

i18n.registerBlocks(['components'])
await i18n.loadUsedBlocks('ru')
```

In this example, `components.first` and `components.second` **will not be loaded**:

- `registerBlocks(['components'])` increments the usage counter **exactly** for the name `components` — no prefix expansion happens.
- `loadUsedBlocks('ru')` calls `loadBlock('components', 'ru')`.
- The registry has neither an exact `components` loader nor a parent above it, so the resolver returns `null` and you'll see the warning:
  `[fint-i18n] No loader for block "components" in locale "ru"`.

Correct approaches:

1. **Granular registration** of the child blocks (matches the loaders above):

   ```typescript
   i18n.registerBlocks(['components.first', 'components.second'])
   await i18n.loadUsedBlocks('ru')
   ```

2. **A single shared loader** on the parent block (if you want to ship everything in one file):

   ```typescript
   ru: {
     components: () => import('./locales/ru/components.json'),
   }

   i18n.registerBlocks(['components'])
   await i18n.loadUsedBlocks('ru')
   ```

3. **Wildcard Registration** — see the next section.

## Wildcard Registration: `prefix.*` and `prefix.**`

If you often register blocks that share a prefix, you can refer to them with a single pattern name instead of listing them. Two forms are supported:

- `prefix.*`  — all blocks that have **exactly one** segment (no dots) after `prefix.`. These are "direct children".
- `prefix.**` — all blocks that **start with** `prefix.` (any nesting depth).

The parent literal `prefix` itself is **not** included in the expansion — if you use it, register/load it separately.

```typescript
// messages.ts
export const loaders = {
  ru: {
    'components.first':       () => import('./locales/components/first/ru.json'),
    'components.second':      () => import('./locales/components/second/ru.json'),
    'components.deep.widget': () => import('./locales/components/deep/widget/ru.json'),
  },
}

// Load direct children of components.* — first and second
i18n.registerBlocks(['components.*'])
await i18n.loadUsedBlocks('ru')

// Load the whole components.** subtree — first, second, deep.widget
i18n.registerBlocks(['components.**'])
await i18n.loadUsedBlocks('ru')
```

Where the pattern works:

- `i18n.registerBlocks([...])` / `i18n.registerUsage(name)` — usage counter is incremented for each matched block (not for the pattern itself).
- `i18n.unregisterUsage(name)` — decrements the same children that the matching `registerUsage` incremented (the pattern is expanded via a shared cache).
- `i18n.loadBlock('prefix.*' | 'prefix.**')` — loads all matched blocks in parallel.
- `useI18nScope(['components.*'])` — works transparently: register → load → unregister on unmount.

> [!IMPORTANT]
> Pattern expansion is done **once across all known loaders of all locales** and cached. It relies on the set of blocks passed to `createFintI18n` at init time. Loaders added later (dynamically) won't be picked up by an existing expansion.

> [!TIP]
> If no blocks match, you'll see a warning:
> `[fint-i18n] Pattern "..." did not match any registered block`. It's a handy way to catch typos in prefixes.

### Performance

- All block names are cached once as a single, locale-merged list.
- A specific pattern is expanded in a single pass and cached by pattern string on the `FintI18n` instance.
- Prefix comparison avoids `String.prototype.startsWith` and regexp — it's a per-character `charCodeAt` loop with no substring allocation.
- Repeated `registerUsage('components.*')` calls don't re-scan the loader map — they reuse the cached list of child names.

### When not to use it

- If you only have one or two child blocks, listing them explicitly (`['components.first', 'components.second']`) is clearer and preserves TS autocomplete on block keys.
- If your block set is built dynamically (e.g. extended via an additional package collection after startup), the pattern won't refresh automatically.

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
