# API Reference

This section provides a detailed technical description of all functions, methods, and interfaces of the `@feugene/fint-i18n` library.

---

## Global Functions

### `createFintI18n(options)`

The main function for initializing the library. Imported from `@feugene/fint-i18n/core`.

```typescript
function createFintI18n(options: FintI18nOptions): FintI18n;

type Locale = string;
type LocaleBlockLoader = () => Promise<any>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];
type LocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoaders>>;
type LocaleLoaderSource = LocaleLoaderCollection | LocaleLoaderCollection[];

interface FintI18nOptions {
  locale: Locale;                                           // Initial language
  fallbackLocale?: Locale;                                  // Fallback language
  loaders?: LocaleLoaderSource;                             // One or more loader collections
  plugins?: FintI18nPlugin[];                               // List of plugins
  globalInstall?: boolean;                                  // Global registration of $t (true by default)
}
```

**Parameters:**
- `options` (object):
  - `locale` (`Locale`): Initial application language.
  - `fallbackLocale` (`Locale`, optional): Fallback language. Defaults to `'en'`.
  - `loaders` (`LocaleLoaderSource`, optional): A single package-level loader collection or an array of such collections.
  - `plugins` (array, optional): Array of plugins to extend functionality.

**Returns:** A `FintI18n` instance.

#### Loaders Contract

```typescript
type LocaleBlockLoader = () => Promise<any>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];

type LocaleLoaderCollection = {
  [locale: Locale]: {
    [blockName: string]: LocaleBlockLoaders;
  };
};
```

- `LocaleLoaderCollection` is convenient to export from a package as a ready-to-use i18n artifact.
- `LocaleLoaderSource` allows passing either a single collection or an array of collections to `createFintI18n()`.
- If a single `blockName` has multiple loaders, they are executed sequentially and their results are merged in the order of declaration.
- If the same `blockName` comes from multiple package collections, the final order of loaders preserves the order in the `loaders: [...]` array.

---

## Composables (Vue 3)

### `useFintI18n()`

Provides access to the current i18n instance inside Vue components. Imported from `@feugene/fint-i18n/vue`.

```typescript
function useFintI18n(): FintI18n;
```

**Returns:** A `FintI18n` instance, providing access to the reactive locale and translation methods.

### `useI18nScope(blocks)`

An asynchronous composable to manage the scope of translation blocks in a component. Imported from `@feugene/fint-i18n/vue`.

```typescript
async function useI18nScope(blocks: string | string[]): Promise<I18nScope>;

interface I18nScope {
  t: (key: string, params?: Record<string, any>) => string;
  locale: Ref<Locale>;
  setLocale: (l: Locale) => Promise<void>;
}
```

**Parameters:**
- `blocks` (string | string[]): Name of the block or an array of block names required by the component.

**Features:**
- Automatically loads specified blocks when the component is mounted.
- Uses a Reference Counting mechanism for memory management.
- Must be used with `await` in `<script setup>` (requires `Suspense` in the parent component).

---

## `FintI18n` Instance (Core API)

Methods available on the `FintI18n` class instance.

### `t(key, params, options)`

The main method for retrieving a translation.

```typescript
declare function t(key: string, params?: Record<string, any>): string;
```

- **`key`** (string): Full path to the key (e.g., `common.welcome`).
- **`params`** (object, optional): Parameters for interpolation. Supports `Ref`.

### `setLocale(locale)`

Changes the current application locale.

```typescript
declare function setLocale(locale: Locale): Promise<void>;
```

- **`locale`** (`Locale`): The new locale code.

### `loadBlock(blockName, locale?)`

Asynchronously loads the specified message block.

```typescript
declare function loadBlock(blockName: string, locale?: Locale): Promise<void>;
```

- **`blockName`** (string): Name of the block to load.
- **`locale`** (`Locale`, optional): If not specified, loads for the current locale.

**Loader Resolving Rules:**
- First, it looks for an exact `blockName` match.
- If an exact block is not found and the name contains a dot, it looks for the nearest parent block (`pages.articles.comments` → `pages.articles` → `pages`).
- If multiple loaders are found for a block, they are executed sequentially.

### `mergeMessages(locale, blockName, messages)`

Manually adds messages to the store.

```typescript
declare function mergeMessages(locale: Locale, blockName: string, messages: any): void;
```

- **`locale`** (`Locale`): Locale.
- **`blockName`** (string): Block name.
- **`messages`** (object): Object containing translations.

### `hooks.on(name, callback)`

Subscribes to i18n lifecycle hooks.

```typescript
declare function on<K extends keyof FintI18nHooks>(name: K, fn: FintI18nHooks[K]): () => void;
```

**Returns:** An unsubscribe function.

---

## `v-t` Directive

A Vue directive for high-performance translation output.

```typescript
type VTValue = string | { path: string, params?: Record<string, any> };
```

**Syntax:**
- `v-t="'block.key'"` — simple output.
- `v-t="{ path: 'block.key', params: { name: 'John' } }"` — with parameters.

**Modifiers:**
- `.once`: Renders the translation once. Ignores subsequent changes to the locale or parameters to save resources.

---

## Global Properties

When registered via `installI18n(app, i18n)` from `@feugene/fint-i18n/vue`, the following are available in templates:

- **`$t`**: Global equivalent of the `t()` function.
- **`$i18n`**: Access to the i18n instance.
