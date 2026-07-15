# API Reference

This section provides a detailed technical description of all functions, methods, and interfaces of the `@feugene/fint-i18n` library.

---

## Global Functions

### `createFintI18n(options)`

The main function for initializing the library. Imported from `@feugene/fint-i18n/core`.

```typescript
function createFintI18n<Schema extends MessageSchema = any>(
  options: FintI18nOptions,
): FintI18n<Schema>;

type Locale = string;
type LocaleBlockLoader = () => Promise<{ default: MessageValue } | MessageValue>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];
type LocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoaders>>;
type LocaleLoaderSource = LocaleLoaderCollection | LocaleLoaderCollection[];

interface FintI18nOptions {
  locale: Locale;                    // Initial language
  fallbackLocale?: Locale;           // Fallback language (see default below)
  loaders?: LocaleLoaderSource;      // One or more loader collections
  plugins?: FintI18nPlugin[];        // List of plugins
  preloadFallback?: boolean;         // Also load blocks for fallbackLocale (default: false)
  unloadUnusedBlocks?: boolean;      // Free a block when its usage counter hits 0 (default: false)
}
```

**Parameters:**
- `options` (object):
  - `locale` (`Locale`): Initial application language.
  - `fallbackLocale` (`Locale`, optional): Fallback language. **Defaults to `''` (an empty string), i.e. fallback is disabled.** When set, `t()` retries a missing key in this locale before reporting it as missing.
  - `loaders` (`LocaleLoaderSource`, optional): A single package-level loader collection or an array of such collections.
  - `plugins` (`FintI18nPlugin[]`, optional): Array of plugins to extend functionality.
  - `preloadFallback` (`boolean`, optional, default `false`): When `true`, every `loadBlock()` also loads the same block for `fallbackLocale`. Without it, fallback only works against messages that happen to be already loaded.
  - `unloadUnusedBlocks` (`boolean`, optional, default `false`): When `true`, a block is removed from memory (messages + compilation cache) once its usage counter drops to zero (the last component that requested it via `useI18nScope` is unmounted). See [Blocks → Lifecycle and Memory](./blocks.md#lifecycle-and-memory).

**Returns:** A `FintI18n<Schema>` instance.

#### Typed message keys (`Schema`)

`createFintI18n<Schema>()` (and `useFintI18n<Schema>()`) accept an optional message-schema generic. When provided, `t()` autocompletes and type-checks literal keys while still accepting arbitrary strings for dynamically built keys:

```typescript
interface AppSchema {
  common: { welcome: string; user: { profile: string } };
}

const i18n = createFintI18n<AppSchema>({ locale: 'en' });

i18n.t('common.welcome')        // ✅ autocompleted / typo-checked
i18n.t('common.user.profile')   // ✅
i18n.t(`common.${dynamic}`)     // ✅ still allowed (falls back to `string`)
```

Related exported types:

```typescript
type MessagePrimitive = string | number | boolean;
type MessageFunction = (params?: Record<string, any>) => string;

interface MessageSchema { [key: string]: MessagePrimitive | MessageFunction | MessageSchema }
type MessageValue = MessagePrimitive | MessageFunction | MessageSchema;

// All leaf keys of a schema in dot-notation: { common: { welcome: string } } → 'common.welcome'
type MessageKeys<S>;
// The key type accepted by t(): literal schema keys | (string & {})
type MessageKey<S>;
```

#### Loaders Contract

```typescript
type LocaleBlockLoader = () => Promise<{ default: MessageValue } | MessageValue>;
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[];

type LocaleLoaderCollection = {
  [locale: Locale]: {
    [blockName: string]: LocaleBlockLoaders;
  };
};
```

- `LocaleLoaderCollection` is convenient to export from a package as a ready-to-use i18n artifact.
- `LocaleLoaderSource` allows passing either a single collection or an array of collections to `createFintI18n()`.
- A loader may resolve either to the messages directly or to a module namespace with a `default` export (e.g. `() => import('./en.json')`) — the `default` is unwrapped automatically.
- If a single `blockName` has multiple loaders, they are executed sequentially and their results are merged in the order of declaration.
- If the same `blockName` comes from multiple package collections, the final order of loaders preserves the order in the `loaders: [...]` array.

---

## Composables (Vue 3)

### `useFintI18n()`

Provides access to the current i18n instance inside Vue components. Imported from `@feugene/fint-i18n/vue`.

```typescript
function useFintI18n<Schema extends MessageSchema = any>(): FintI18n<Schema>;
```

**Returns:** A `FintI18n` instance, providing access to the reactive locale and translation methods. Throws if `installI18n()` was not called for the app.

### `useI18nScope(blocks, options?)`

An asynchronous composable to manage the scope of translation blocks in a component. Imported from `@feugene/fint-i18n/vue`.

```typescript
async function useI18nScope(
  blocks: string | string[],
  options?: UseI18nScopeOptions,
): Promise<I18nScope>;

interface UseI18nScopeOptions {
  /**
   * Prefix keys with the block name: t('login') → t('auth.login').
   * Works only with a single concrete block (not a pattern).
   */
  prefix?: boolean;
}

interface I18nScope {
  t: (key: string, params?: Record<string, any>) => string;
  locale: ComputedRef<Locale>;
  setLocale: (l: Locale) => Promise<void>;
}
```

**Parameters:**
- `blocks` (`string | string[]`): Name of the block or an array of block names required by the component. Wildcard patterns (`prefix.*`, `prefix.**`) are supported.
- `options.prefix` (`boolean`, optional): When `true` and a single concrete block is passed, `scope.t('key')` is automatically prefixed with the block name. Ignored (with a console warning) for multiple blocks or patterns.

**Features:**
- Automatically loads specified blocks when the component is set up, and registers/unregisters their usage (reference counting) around the component lifecycle.
- Must be used with `await` in `<script setup>` (requires `Suspense` in a parent component).

### `useI18nScopeSync(blocks, options?)`

Synchronous variant of `useI18nScope` — does **not** require `<Suspense>`. Blocks load in the background; a `ready` flag signals completion. Imported from `@feugene/fint-i18n/vue`.

```typescript
function useI18nScopeSync(
  blocks: string | string[],
  options?: UseI18nScopeOptions,
): I18nScopeSync;

interface I18nScopeSync extends I18nScope {
  /** Becomes `true` once all scope blocks have finished loading. */
  ready: Ref<boolean>;
}
```

Before `ready` turns `true`, `t()` returns keys that resolve as blocks arrive (the directive/`t()` are reactive, so the UI updates automatically). Load failures are reported to `console.error`.

---

## `FintI18n` Instance (Core API)

Methods available on the `FintI18n` class instance.

### `locale`

```typescript
readonly locale: WritableComputedRef<Locale>;
```

Reactive current locale. **Reading** is reactive (`i18n.locale.value`).

> [!WARNING]
> Direct assignment (`i18n.locale.value = 'ru'`) is **deprecated**: it delegates to `setLocale()` and logs a one-time warning. Call `setLocale()` directly instead — it also awaits the loading of used blocks before switching.

### `messages`

```typescript
readonly messages: Readonly<Record<Locale, MessageSchema>>;
```

Read-only view of the loaded dictionaries. Mutate only through `mergeMessages()` / `loadBlock()`.

### `t(key, params, options)`

The main method for retrieving a translation.

```typescript
declare function t(
  key: MessageKey<Schema>,
  params?: Record<string, any>,
  options?: TranslateOptions,
): string;

interface TranslateOptions {
  /** Override the instance `fallbackLocale` for this call only. */
  fallbackLocale?: Locale;
}
```

- **`key`** (string): Full path to the key (e.g., `common.welcome`).
- **`params`** (object, optional): Parameters for interpolation. Supports `Ref` values (they are unwrapped).
- **`options`** (object, optional):
  - **`fallbackLocale`** (`Locale`): Fallback locale for this call, taking precedence over the instance-level `fallbackLocale`. If the key is missing in the current locale, it is looked up here.
- **Returns:** the resolved string, or the `key` itself if it cannot be resolved in the current or fallback locale (a missing-key report is emitted once per `locale:key`).

### `setLocale(locale)`

Changes the current application locale. Before switching it awaits loading of any registered-but-not-yet-loaded blocks for the target locale, so raw keys are never shown. Concurrent calls are coalesced — only the last requested locale is applied.

```typescript
declare function setLocale(locale: Locale): Promise<void>;
```

- **`locale`** (`Locale`): The new locale code.

### `loadBlock(blockName, locale?)`

Asynchronously loads the specified message block.

```typescript
declare function loadBlock(blockName: string, locale?: Locale): Promise<void>;
```

- **`blockName`** (string): Name of the block to load. Wildcard patterns (`prefix.*`, `prefix.**`) are expanded and their matched blocks are loaded in parallel.
- **`locale`** (`Locale`, optional): If not specified, loads for the current locale. When `preloadFallback` is enabled, the block is also loaded for `fallbackLocale`.

**Loader Resolving Rules:**
- First, it looks for an exact `blockName` match.
- If an exact block is not found and the name contains a dot, it looks for the nearest parent block (`pages.articles.comments` → `pages.articles` → `pages`).
- If multiple loaders are found for a block, they are executed sequentially.

### `addLoaders(source)`

Registers additional loaders after the instance has been created (micro-frontends, dynamically attached modules). Clears the wildcard-pattern expansion cache.

```typescript
declare function addLoaders(source: LocaleLoaderSource): void;
```

> Patterns already expanded by an earlier call are re-computed on next use; but see the caveat in [Blocks → Wildcard Registration](./blocks.md#wildcard-registration-prefix-and-prefix): a pattern expansion relies on loaders known at expansion time.

### `getKnownLocales()`

Returns the locales known from the registered loaders.

```typescript
declare function getKnownLocales(): readonly Locale[];
```

### `mergeMessages(locale, blockName, messages)`

Manually adds messages to the store (used internally by `loadBlock`; useful for SSR hydration or tests).

```typescript
declare function mergeMessages(locale: Locale, blockName: string, messages: MessageValue): void;
```

- **`locale`** (`Locale`): Locale.
- **`blockName`** (string): Block name (may be dotted, e.g. `pages.articles`).
- **`messages`** (object | string | function): Messages to merge for that block.

### `isBlockLoaded(blockName, locale?)`

Returns whether a block (or any of its parents) is already loaded for the given locale.

```typescript
declare function isBlockLoaded(blockName: string, locale?: Locale): boolean;
```

### `unloadBlock(blockName, locale?)`

Removes a block from memory: deletes its message subtree, invalidates the compilation cache, and clears the loaded mark (a subsequent `loadBlock` reloads it).

```typescript
declare function unloadBlock(blockName: string, locale?: Locale): void;
```

> If a block was loaded through a parent loader (e.g. `pages.articles` resolved to `pages`), unload it by the **loaded (parent) block name**.

### Usage counting: `registerUsage` / `registerBlocks` / `unregisterUsage`

Reference counting that drives lazy loading in `setLocale()` (via `loadUsedBlocks`) and optional unloading (`unloadUnusedBlocks`). `useI18nScope` calls these for you; use them directly outside components.

```typescript
declare function registerUsage(blockName: string): void;   // +1 (supports patterns)
declare function registerBlocks(blockNames: string[]): void; // registerUsage for each
declare function unregisterUsage(blockName: string): void;   // -1 (supports patterns)
```

Wildcard patterns (`prefix.*`, `prefix.**`) are expanded to concrete block names via a shared cache, so `unregisterUsage` decrements exactly the children that `registerUsage` incremented.

### `loadUsedBlocks(locale)`

Loads every registered-and-still-used block that is not yet loaded for `locale`, looping until convergence (blocks registered mid-load are picked up on the next iteration). A single block's failure does not cancel the others — failures are reported via the `onError` hook.

```typescript
declare function loadUsedBlocks(locale: Locale): Promise<void>;
```

### `markBlockLoaded(blockName, locale)`

Low-level: marks a block as loaded for a locale (used internally after a successful load). Call directly only when you inject messages via `mergeMessages()` and want the block treated as loaded (e.g. SSR hydration).

```typescript
declare function markBlockLoaded(blockName: string, locale: Locale): void;
```

### `dispose()`

Tears the instance down: calls `uninstall()` on every installed plugin and clears the plugin list. Call when a per-request/SSR instance is no longer needed.

```typescript
declare function dispose(): void;
```

### `hooks.on(name, callback)`

Subscribes to i18n lifecycle hooks.

```typescript
declare function on<K extends keyof FintI18nHooks>(name: K, fn: FintI18nHooks[K]): () => void;
```

**Returns:** An unsubscribe function.

**Available hooks (`FintI18nHooks`):**

| Hook | Payload | When |
| --- | --- | --- |
| `afterInit` | `void` | Emitted synchronously at the end of the constructor (only plugins can subscribe in time). |
| `onLocaleChange` | `{ locale, previous }` | After the active locale changes. |
| `beforeLoadBlock` | `string` (block name) | Before a block's loaders run. |
| `afterLoadBlock` | `{ block, locale, messages }` | After a block finished loading. |
| `onMissingKey` | `{ key, locale }` | A key could not be resolved (deduped per `locale:key`). |
| `onTranslate` | `{ key, params?, result }` | On every `t()` call; a handler may rewrite `result`. |
| `onError` | `{ error, block?, locale? }` | Async block-loading failures. With no subscriber, errors go to `console.error`. |

---

## `v-t` Directive

A Vue directive for high-performance translation output. Registered by `installI18n` (as `v-t` by default).

```typescript
type VTDirectiveValue = string | { path: string, params?: Record<string, any> };
```

**Syntax:**
- `v-t="'block.key'"` — simple output.
- `v-t="{ path: 'block.key', params: { name: 'John' } }"` — with parameters.

**Reactivity (default):**
- The element text is **reactive**: it re-renders when the locale changes and when lazily loaded blocks arrive (via a per-element `watchEffect`). This is the default behavior — no modifier needed.

**Modifiers:**
- `.once`: Render the translation **once**, with no reactivity. Subsequent locale/param/block changes are ignored — use it for static labels where you want to skip the reactive overhead.
- `.preserve`: If the key cannot be resolved (i.e. `t()` returns the key itself), keep the element's current text instead of overwriting it with the raw key. Useful to avoid a flash of raw keys before a block finishes loading.

```vue
<span v-t="'common.welcome'" />          <!-- reactive -->
<span v-t.once="'brand.name'" />         <!-- rendered once, no reactivity -->
<span v-t.preserve="'lazy.title'" />     <!-- keeps current text until the key resolves -->
```

**SSR:**
- The directive implements `getSSRProps`, so during server-side rendering it emits the translated text as `textContent`. Ensure the required blocks are loaded before rendering on the server (e.g. `await i18n.loadBlock(...)` / `loadUsedBlocks()`).

---

## Vue Plugin (`installI18n`)

Registers the `FintI18n` instance in a Vue application: provides it via `provide/inject`, optionally registers global properties (`$t`, `$i18n`) and the `v-t` directive. Imported from `@feugene/fint-i18n/vue`.

```typescript
import type { App } from 'vue'

type GlobalInstallFn = (app: App, i18n: FintI18n) => void

interface InstallI18nOptions {
  /**
   * Controls registration of the `v-t` directive.
   * - `string` — register the directive under the given name (e.g. `'i18n'` → `v-i18n`).
   * - `true` or omitted — register under the default name `'t'` (`v-t`).
   * - `false` — do not register the directive.
   */
  directive?: string | boolean

  /**
   * Controls registration of global properties (`$t`, `$i18n`).
   * - function — called instead of the default registration; you implement
   *   the binding yourself (e.g. expose a different name or attach extra utilities);
   * - `true` — performs the default registration (`app.config.globalProperties.$t = i18n.t`,
   *   `app.config.globalProperties.$i18n = i18n`);
   * - `false` — nothing is registered.
   * If the option is omitted, defaults to `true`.
   */
  globalInstall?: boolean | GlobalInstallFn
}

declare function installI18n(app: App, i18n: FintI18n, options?: InstallI18nOptions): void
```

**Behavior:**
- Always calls `app.provide(FINT_I18N_KEY, i18n)`, so `useFintI18n()` and `useI18nScope()` work regardless of `globalInstall`.
- The effective value of `globalInstall` is `options.globalInstall ?? true`.
- If a function is passed, it fully replaces the default registration — neither `$t` nor `$i18n` will be set automatically.

#### Examples

Default registration (equivalent to omitting the option):

```typescript
installI18n(app, i18n) // registers $t, $i18n and the v-t directive
```

Disable global properties (recommended when using only composables / the `v-t` directive):

```typescript
installI18n(app, i18n, { globalInstall: false })
```

Custom registration — for example, expose under different names or add helpers:

```typescript
import { installI18n } from '@feugene/fint-i18n/vue'

installI18n(app, i18n, {
  globalInstall: (app, i18n) => {
    app.config.globalProperties.$tr = i18n.t
    app.config.globalProperties.$i18n = i18n
    app.config.globalProperties.$locale = i18n.locale
  },
})
```

Customize the directive name or disable it:

```typescript
installI18n(app, i18n, { directive: 'i18n' }) // v-i18n="..."
installI18n(app, i18n, { directive: false })  // do not register the directive
```

### `createFintI18nPlugin(i18n, options?)`

A conventional Vue plugin wrapper around `installI18n`, for the idiomatic `app.use()` form. Imported from `@feugene/fint-i18n/vue`.

```typescript
declare function createFintI18nPlugin(i18n: FintI18n, options?: InstallI18nOptions): Plugin;
```

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { createFintI18nPlugin } from '@feugene/fint-i18n/vue'

const i18n = createFintI18n({ locale: 'en' })
app.use(createFintI18nPlugin(i18n, { globalInstall: false }))
```

---

## Global Properties

When registered via `installI18n(app, i18n)` from `@feugene/fint-i18n/vue` with `globalInstall` enabled (default), the following are available in templates:

- **`$t`**: Global equivalent of the `t()` function.
- **`$i18n`**: Access to the i18n instance.

> [!TIP]
> If `globalInstall: false` is passed, `$t`/`$i18n` are not registered. Use `useFintI18n()` / `useI18nScope()` or pass a custom registration function to expose properties under your own names.

### Opt-in global type augmentation

Registering `$t`, `$i18n`, and `v-t` at runtime does **not** by itself make them type-check in templates. The global TypeScript augmentation (`ComponentCustomProperties.$t` / `$i18n` and the `v-t` directive types) is now **opt-in** — import it once, e.g. in your app entry or a `*.d.ts`:

```typescript
import '@feugene/fint-i18n/vue/global-types'
```

> [!IMPORTANT]
> This augmentation used to be applied automatically. If you relied on template typings for `$t`/`$i18n`/`v-t`, add the import above after upgrading. See the [installation migration note](./installation.md#migration-global-type-augmentation-is-now-opt-in).

---

## Template Interpolation

Messages are compiled to functions (no `new Function`, CSP-safe). Placeholder syntax:

- `{name}` — substitutes a parameter. Names may contain letters, digits, `_`, `.` and `-`.
- A missing or `null`/`undefined` parameter leaves the placeholder text as-is.
- `{{` and `}}` — **escaping**: rendered as literal `{` and `}`.

```typescript
i18n.t('greeting', { name: 'Alex' }) // "Hello, {name}!" → "Hello, Alex!"
i18n.t('literal')                    // "Use {{name}} as a placeholder" → "Use {name} as a placeholder"
```
