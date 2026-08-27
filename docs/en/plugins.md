# Plugins and Extending Functionality

The `@feugene/fint-i18n` library provides an extensible plugin system based on lifecycle hooks. This allows for adding new functionality (persistence, logging, integration with third-party libraries) without bloating the core.

## Built-in Plugins

### PersistencePlugin

This plugin is responsible for saving the selected locale to storage (defaults to `localStorage`) and synchronizing it across open browser tabs.

#### Installation

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { PersistencePlugin, type PersistenceOptions } from '@feugene/fint-i18n/plugins'

const options: PersistenceOptions = {
  key: 'my-app-locale', // Key in localStorage
  syncTabs: true        // Synchronize between tabs
}

const i18n = createFintI18n({
  // ...
  plugins: [
    new PersistencePlugin(options)
  ]
})
```

##### `PersistenceOptions` Interface

```typescript
interface PersistenceOptions {
  key?: string;             // Key for storing the locale (default: 'fint-i18n-locale')
  storage?: Storage;        // Storage object (default: localStorage)
  syncTabs?: boolean;       // Synchronize between browser tabs (default: true)
  allowedLocales?: Locale[]; // Locales the plugin may restore
}
```

#### Features
- **Automatic Loading**: Upon initialization, the plugin checks for a saved value in `storage`.
- **Tab Synchronization**: Uses the `storage` event to instantly update the locale in all open tabs when it changes in one of them.
- **Validation**: A stored value is applied only when the locale is known to exist — from `allowedLocales`, from the registered loaders, or from messages already merged. A stale or tampered key therefore cannot leave the application with no translations at all.
- **Negotiation**: the stored tag is matched with [`negotiateLocale()`](./api.md#locale-negotiation), not by string equality. A locale saved as `ru-RU` while the application ships `ru` resolves to `ru` and is applied — the value in storage usually came from the browser, so it usually carries a region. A tag of an unrelated language is still rejected.

> [!IMPORTANT]
> If dictionaries come from `mergeMessages()` rather than loaders, the library has no way to know which locales exist and will ignore the stored value with a warning. Pass `allowedLocales` in that setup.

```typescript
new PersistencePlugin({ allowedLocales: ['en', 'ru'] })
```

---

### BridgePlugin

Allows for transparently using `fint-i18n` alongside an existing `vue-i18n` instance. This is useful in large projects or when using third-party libraries that depend on `vue-i18n`.

#### Installation

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { BridgePlugin, type BridgeOptions } from '@feugene/fint-i18n/plugins'
import { createI18n } from 'vue-i18n'

const vueI18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { /* ... */ }
})

const options: BridgeOptions = {
  i18n: vueI18n,
}

const i18n = createFintI18n({
  // ...
  plugins: [
    new BridgePlugin(options)
  ]
})
```

##### `BridgeOptions` Interface

```typescript
interface BridgeOptions {
  i18n: any; // vue-i18n instance (Composer or Legacy i18n)
}
```

#### Features
- **Two-way Synchronization**: When the locale changes in `fint-i18n`, it automatically changes in `vue-i18n` and vice versa.
- **Fallback Translations**: If a key is not found in `fint-i18n` blocks, the plugin will attempt to resolve it via `vue-i18n`.

---

### HookLoggerPlugin

A debugging plugin that logs every called `fint-i18n` hook to the console. Useful for diagnosing block loading, translations, locale changes, and finding missing keys.

#### Installation

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { HookLoggerPlugin, type HookLoggerPluginOptions } from '@feugene/fint-i18n/plugins'

const options: HookLoggerPluginOptions = {
  prefix: '[demo-i18n]',
}

const i18n = createFintI18n({
  locale: 'en',
  plugins: [
    new HookLoggerPlugin(options)
  ]
})
```

#### Usage Example

```typescript
await i18n.loadBlock('common')
i18n.t('common.greeting', { name: 'John' })
await i18n.setLocale('fr')

// Console:
// [demo-i18n] "afterInit" called undefined
// [demo-i18n] "beforeLoadBlock" called { block: 'common', locale: 'en' }
// [demo-i18n] "afterLoadBlock" called { block: 'common', locale: 'en', messages: { ... } }
// [demo-i18n] "onTranslate" called { key: 'common.greeting', params: { name: 'John' }, result: 'Hello John' }
// [demo-i18n] "onLocaleChange" called { locale: 'fr', previous: 'en' }
```

##### `HookLoggerPluginOptions` Interface

```typescript
interface HookLoggerPluginOptions {
  logger?: (message?: any, ...optionalParams: any[]) => void; // Logging function, default: console.log
  prefix?: string; // Message prefix, default: '[fint-i18n] Hook'
}
```

#### Features
- **Logs all built-in hooks**: `afterInit`, `onLocaleChange`, `beforeLoadBlock`, `afterLoadBlock`, `onMissingKey`, `onTranslate`, `onFallback`, `onRetry`, `onError`, `onWarning`.
- **No data flow interference**: The plugin returns the original payload for each hook, making it safe for debugging.
- **Configurable Output**: You can pass a custom `logger` and change the `prefix`.

---

## Creating a Custom Plugin

The plugin system is built on classes that implement the `install(instance)` method. Inside this method, you can subscribe to hooks.

```typescript
import type { FintI18n, FintI18nPlugin } from '@feugene/fint-i18n/core'

export class MyLoggerPlugin implements FintI18nPlugin {
  public name = 'my-logger'

  install(i18n: FintI18n) {
    // Subscribing to the translation hook
    const off = i18n.hooks.on('onTranslate', (data) => {
      console.log(`[i18n] Translation of key "${data.key}": ${data.result}`)
    })

    // off() can be called later to unsubscribe
  }
}
```

### Available Hooks

| Hook | Description | Data Type |
| :--- | :--- | :--- |
| `afterInit` | Called after instance initialization | `void` |
| `onLocaleChange` | Called when the language changes | `{ locale: Locale, previous: Locale }` |
| `onTranslate` (Sync) | Called at the moment of translation (in `t()`) | `{ key: string, params?: Record<string, any>, result: string }` |
| `beforeLoadBlock` | Before starting to load a block | `{ block: string, locale: Locale }` |
| `afterLoadBlock` | After a block is successfully loaded | `{ block: string, locale: Locale, messages: any }` |
| `onMissingKey` | If a key is not found in the current locale | `{ locale: Locale, key: string }` |
| `onFallback` (Sync) | The fallback locale produced the translation; the current one has no such key | `{ key: string, locale: Locale, fallbackLocale: Locale }` |
| `onRetry` (Sync) | A loader failed and another attempt follows | `{ block: string, locale: Locale, attempt: number, error: unknown }` |
| `onError` | A block failed to load, by any path. With no subscriber — `console.error` | `{ error: unknown, block?: string, locale?: Locale }` |
| `onWarning` (Sync) | A configuration problem. With no subscriber — `console.warn` | `{ code: WarningCode, message: string, context?: Record<string, unknown> }` |

### Warnings: `onWarning`

A block with no loader, a wildcard that matched nothing, a stored locale that
does not exist — these are configuration mistakes, and without a subscriber they
are visible only to whoever has the console open. A subscriber receives them
structurally and can forward them anywhere; with no subscriber everything goes to
`console.warn`.

```typescript
i18n.hooks.on('onWarning', ({ code, message, context }) => {
  if (code === 'no-loader') reportToSentry(message, context)
})
```

| Code | When |
| :--- | :--- |
| `no-loader` | No loader is registered for the block in this locale |
| `pattern-no-match` | A wildcard matched none of the registered blocks |
| `scope-prefix-ignored` | `prefix: true` with a list of blocks or with a pattern |
| `persisted-locale-unknown` | `PersistencePlugin` could not confirm the stored locale |
| `ssr-function-messages` | The SSR snapshot holds message functions that JSON cannot carry |
| `deprecated-locale-setter` | Writing to `locale.value` instead of `setLocale()` |

The code exists so that cases can be told apart by machine rather than by parsing
text. An arbitrary string is allowed too — a plugin sends its own warnings through
the same channel under its own codes:

```typescript
import { warn } from '@feugene/fint-i18n/core'

warn(i18n.hooks, 'my-plugin:stale-cache', 'Cache is stale', { age: 3600 })
```

**What the channel does not cover.** `Intl` warnings — an invalid locale tag,
invalid formatting options, an invalid date — and the warning about an incomplete
set of plural forms stay console-only: their caches are module-level and cannot
reach an instance.
