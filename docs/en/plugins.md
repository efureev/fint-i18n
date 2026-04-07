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
  key?: string;      // Key for storing the locale (default: 'fint-i18n-locale')
  storage?: Storage; // Storage object (default: localStorage)
  syncTabs?: boolean; // Synchronize between browser tabs (default: true)
}
```

#### Features
- **Automatic Loading**: Upon initialization, the plugin checks for a saved value in `storage`.
- **Tab Synchronization**: Uses the `storage` event to instantly update the locale in all open tabs when it changes in one of them.

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
// [demo-i18n] "beforeLoadBlock" called common
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
- **Logs all built-in hooks**: `beforeInit`, `afterInit`, `onLocaleChange`, `beforeLoadBlock`, `afterLoadBlock`, `onMissingKey`, `onTranslate`.
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
| `beforeLoadBlock` | Before starting to load a block | `string` (block name) |
| `afterLoadBlock` | After a block is successfully loaded | `{ block: string, messages: any }` |
| `onMissingKey` | If a key is not found in the current locale | `{ locale: Locale, key: string }` |
