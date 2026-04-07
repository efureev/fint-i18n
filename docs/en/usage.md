# Using the Library (TS and Vue Templates)

After initializing the library, you can use it in all parts of your Vue 3 application.

## Using in Components (script setup)

To work within components, use the `useFintI18n` composable.

```vue
<script setup>
import { useFintI18n } from '@feugene/fint-i18n/vue'

// Get the translation method and a reactive reference to the current language
const { t, locale } = useFintI18n()

// Parameters for t() can be regular values or reactive (Ref)
const name = ref('John')
</script>

<template>
  <div>
    <!-- Simple key (block 'common', key 'welcome') -->
    <h1>{{ t('common.welcome', { name }) }}</h1>
    
    <button @click="locale = 'ru'">
RU
</button>
    <button @click="locale = 'en'">
EN
</button>
  </div>
</template>
```

### `t(key, params, options)` Method

- **`key`** (string): Full path to the key, including the block name (e.g., `auth.login.title`).
- **`params`** (Record<string, any>, optional): Object with parameters to insert into the template.
- **`options`** (object, optional): Additional settings.
  - `fallbackLocale` (`Locale`): Fallback language for this specific call.

## Using in Templates (template)

### Global Property `$t`

The library registers a global property `$t`, available in all component templates:

```html
<p>{{ $t('common.save') }}</p>
<p>{{ $t('common.greeting', { name: 'User' }) }}</p>
```

### Directive `v-t`

The `v-t` directive allows you to set an element's text content declaratively. It is optimized for performance (minimizing unnecessary DOM updates).

```html
<!-- Simple key -->
<span v-t="'auth.login'"></span>

<!-- With parameters -->
<span v-t="{ path: 'common.welcome', params: { name: 'Admin' } }"></span>

<!-- .once modifier: render once and stop tracking language changes -->
<span v-t.once="'common.app_name'"></span>
```

## Working Outside of Components (Vanilla TS)

If you need to access translations outside of Vue components (e.g., in Pinia stores or a router), use the instance directly.

> [!IMPORTANT]
> To do this, you must save the instance during creation or obtain it via `useFintI18n()` inside a lifecycle hook.

```typescript
// src/store/user.ts
import { useFintI18n } from '@feugene/fint-i18n/vue'

export const useUserStore = defineStore('user', () => {
  const { t } = useFintI18n()
  
  const notify = () => {
    console.log(t('common.notification'))
  }
  
  return { notify }
})
```

## Plugins

The library provides an extensible plugin system. For a detailed description and usage examples of built-in and custom plugins, read the [Plugins](./plugins.md) section.

---

Full list of all functions, methods, and parameters is available in the [API Reference](./api.md).
