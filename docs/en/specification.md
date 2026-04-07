# Technical Specification (TS) for the `@feugene/fint-i18n` Package

## 1. Goals and Objectives

Development of a lightweight, high-performance localization library for Vue 3 applications and component libraries, providing flexibility in resource management and asynchronous loading.

## 2. Key Requirements

### 2.1. Performance and Size

- **Minimal Size**: The core bundle size should be less than 2 KB (gzip) and strive for an absolute minimum.
- **Zero Dependencies**: Maximum absence of external dependencies (only `vue` as a `peerDependency`).
- **Instant Initialization**: Initialization should not require complex calculations or the creation of heavy virtual machines.
- **Ultra-fast `t`**:
    - Use of **template precompilation** (JIT). When a message chunk is loaded, template strings (e.g., `"Hello, {name}!"`) are converted into optimized generator functions `(p) => "Hello, " + p.name + "!"`.
    - Caching of compiled functions for reuse.
    - Avoiding regular expressions at runtime when calling `t`.

### 2.2. Asynchronicity and Blocks (Translation Blocks)

- **Asynchronous Sources**: Support for dynamic imports for locales.
- **Block Structure**: Ability to split translations into independent blocks (e.g., `common`, `auth`, `profile`).
- **Dynamic Loading**: API for loading blocks on the fly without page reloads.
- **Parallel Loading**: Support for simultaneous loading of multiple blocks/locales via `Promise.all`.

### 2.3. DX (Developer Experience) and TypeScript

- **Simple API**: A minimalist interface inspired by `i18n` best practices.
- **Strict Typing**: Automatic generation of types for keys based on JSON structures (using Template Literal Types).
- **Vue Integration**: Support via `app.use()` and the `useFintI18n()` composable. Global `$t` property (optional).

### 2.4. SPA/SSR Compatibility

- **Universality**: Full support for Single Page Applications and Server-Side Rendering (Node.js, Edge Runtime).
- **Isolation**: Absence of hard bindings to global browser objects (`window`, `document`, `localStorage`) in the core. All platform-dependent functionality (e.g., `PersistencePlugin`) is moved to plugins or adapters.

### 2.5. BridgeMode (Compatibility with vue-i18n)

- **Proxying**: If the main application already uses `vue-i18n`, `fint-i18n` should be able to:
    - Use the `locale` from `vue-i18n`.
    - Forward `t` calls to `vue-i18n.t`.
    - Synchronize state (changing the language in one place changes it everywhere).

This functionality is implemented via the **plugin system** (see Section 6). If compatibility is not needed, the plugin is not connected, keeping the core size minimal.

### 2.6. JIT vs AOT Compilation (Architectural Decision)

During the design phase, a comparative analysis of template compilation approaches was conducted:

| Characteristic | JIT (Runtime, current) | AOT (Build-time) |
| :--- | :--- | :--- |
| **Performance (Init)** | Minimal delay when loading a chunk | Instant |
| **Performance (t)** | Very high (O(N) by string parts) | Extreme (native JS) |
| **Core Bundle Size** | + ~300 bytes (compiler) | - 300 bytes |
| **Translation File Size** | Minimal (JSON) | Higher (JS functions) |
| **Flexibility** | Any sources (API, DB) | Only static files |
| **Implementation Complexity** | Zero | Requires Vite plugin |

**Decision**: Use **JIT compilation** with mandatory **precompilation upon block loading**. This ensures an optimal balance: the library remains independent of build tools and supports dynamic data sources, while not losing out on rendering speed.

---

## 3. Architecture and API

### 3.1. Creating an Instance

```typescript
const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders: [appLocaleLoaders, dsLocaleLoaders]
})
```

Where each package collection looks like:

```typescript
type LocaleBlockLoader = () => Promise<any>
type LocaleBlockLoaders = LocaleBlockLoader | LocaleBlockLoader[]
type LocaleLoaderCollection = Record<Locale, Record<string, LocaleBlockLoaders>>
```

Rules:

- Package collections are merged from left to right.
- Identical block keys are combined into a sequence of loaders.
- It first looks for an exact block, then the nearest parent block.
- Messages from subsequent loaders override matching keys from previous loaders.

### 3.2. Working with Blocks

```typescript
// Loading a block
await i18n.loadBlock('auth');

// Checking if loaded
if (i18n.isBlockLoaded('auth')) {
  // ...
}
```

### 3.3. Usage in Components

```typescript
const { t, locale } = useFintI18n();
const label = t('auth.login.submit', { name: 'User' });
```

---

## 4. Implementation Plan

### Stage 1: Core Engine
- Reactive message store.
- JIT template compiler.
- Plugin system (core and hooks).

### Stage 2: Loader & Blocks
- Loader registration system.
- Block mechanism and merging.
- `useI18nScope` composable for block lifecycle management.

### Stage 3: Vue Integration
- Plugin for Vue 3.
- `v-t` directive implementation.
- Basic plugins: `PersistencePlugin`, `LoggerPlugin`.

### Stage 4: Advanced Features & Tooling
- `BridgePlugin` for `vue-i18n` compatibility.
- Key typing.
- Documentation and examples.

---

## 5. Advanced Features (Implementation Details)

### 5.1. Persistent Storage

Implemented as a built-in mechanism or plugin for automatic saving and restoration of the selected locale.

- **Storage Adapter**: Abstraction over storage (defaults to `localStorage`). Interface: `{ get(key): string, set(key, val): void }`.
- **Initialization**: When calling `createFintI18n`, locale selection priority: `options.locale` -> `Storage` -> `fallbackLocale`.
- **Synchronization**: Reactive `watch` on `locale` that calls `storage.set()`.
- **Cross-Tab Sync**: Use of the `window.onstorage` event for instant locale updates across all tabs without a reload.

### 5.2. Reactive Scope Context (Local Contexts)

Allows components to declare their dependencies on specific translation blocks.

- **Composable `useI18nScope(blocks: string[])`**:
    - Increases the usage counter for specified blocks when called.
    - Automatically calls `loadBlock` for each block during initialization.
    - Returns a local `t`, which can have a preset prefix.
    - Decreases the counter upon component destruction (`onUnmounted`). If a block's counter reaches 0, messages can be unloaded from memory (optional for resource saving in large applications).

### 5.3. Directive Support (Vue Directives)

The `v-t` directive for declarative use in templates.

- **Syntax**: `<span v-t="'auth.title'"></span>` or `<span v-t="{ path: 'auth.greet', params: { name: 'User' } }"></span>`.
- **Performance**: Direct update of the element's `textContent`, bypassing part of Vue's virtual DOM for simple strings.
- **Modifiers**:
    - `.once`: Renders once and no longer tracks changes (maximum performance for static content).
    - `.preserve`: Keeps current content if the key is not found.

---

## 6. Plugin System

To ensure modularity and keep the core size minimal, `fint-i18n` uses an event-oriented plugin system.

### 6.1. Plugin Interface
```typescript
interface FintI18nPlugin {
  name: string;
  install: (instance: FintI18nInstance) => void;
}
```

### 6.2. Extension Points (Hooks)
Plugins can subscribe to internal instance events:
- `beforeInit`: Configuration of initial parameters.
- `onLocaleChange(newLocale)`: Reaction to language change.
- `beforeLoadBlock(blockName)`: Pre-processing before loading.
- `afterLoadBlock(blockName, messages)`: Post-processing (e.g., additional message transformation).
- `onMissingKey(key, locale)`: Handling of missing keys (logging, external APIs).
- `onTranslate(key, params, result)`: Intercepting the translation result (for post-filters or debugging).

### 6.3. Functionality Moved to Plugins
1. **BridgePlugin**: Implements `BridgeMode` via `t` proxying and `locale` synchronization with `vue-i18n`.
2. **PersistencePlugin**: Encapsulates work with `localStorage`.
3. **LoggerPlugin**: Handles `onMissingKey` in dev mode.

### 6.4. Independence and Modularity

- **Standalone Core**: The core must function fully without the plugin system.
- **Build-time Optimization**: The plugin system should be designed so that if not used, the code for the hook system and plugin registration can be completely excluded from the bundle (Tree Shaking).
- **Minimal Plugin Size**: Each plugin should be self-contained and as lightweight as possible (less than 0.5 KB gzip), ensuring a "pay-only-for-what-you-use" model.
