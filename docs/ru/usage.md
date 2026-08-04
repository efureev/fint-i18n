# Использование библиотеки (TS и шаблоны Vue)

После инициализации библиотеки вы можете использовать её во всех частях приложения Vue 3.

## Использование в компонентах (script setup)

Для работы в компонентах используйте композабл `useFintI18n`.

```vue

<script setup>
  import {useFintI18n} from '@feugene/fint-i18n/vue'

  // Получаем метод перевода и реактивную ссылку на текущий язык
  const {t, locale} = useFintI18n()

  // Параметры для t() могут быть обычными значениями или реактивными (Ref)
  const name = ref('John')
</script>

<template>
  <div>
    <!-- Простой ключ (блок 'common', ключ 'welcome') -->
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

### Метод `t(key, params, options)`

- **`key`** (string): Полный путь к ключу, включая имя блока (например, `auth.login.title`).
- **`params`** (Record<string, any>, optional): Объект с параметрами для вставки в шаблон.
- **`options`** (object, optional): Дополнительные настройки.
    - `fallbackLocale` (`Locale`): Резервный язык для этого конкретного вызова.

## Использование в шаблонах (template)

### Глобальное свойство `$t`

Библиотека регистрирует глобальное свойство `$t`, доступное во всех шаблонах компонентов:

```html
<p>{{ $t('common.save') }}</p>
<p>{{ $t('common.greeting', { name: 'User' }) }}</p>
```

### Директива `v-t`

Директива `v-t` позволяет устанавливать текстовое содержимое элемента декларативно. Она оптимизирована для
производительности (минимизирует лишние обновления DOM).

```html
<!-- Простой ключ -->
<span v-t="'auth.login'"></span>

<!-- С параметрами -->
<span v-t="{ path: 'common.welcome', params: { name: 'Admin' } }"></span>

<!-- Модификатор .once: отрендерить один раз и не следить за сменой языка -->
<span v-t.once="'common.app_name'"></span>
```

## Работа вне компонентов (Vanilla TS)

Если вам нужно получить доступ к переводам за пределами Vue-компонентов (например, в сторах Pinia или роутере),
используйте инстанс напрямую.

> [!IMPORTANT]
> Для этого вы должны сохранить инстанс при создании или получить его через `useFintI18n()` внутри хука жизненного
цикла.

```typescript
// src/store/user.ts
import {useFintI18n} from '@feugene/fint-i18n/vue'

export const useUserStore = defineStore('user', () => {
    const {t} = useFintI18n()

    const notify = () => {
        console.log(t('common.notification'))
    }

    return {notify}
})
```

## Формы множественного числа

Формы задаются объектом, ключи которого — категории CLDR; нужная выбирается по параметру
`count` (или `n`). Отдельный метод для `t()` не нужен.

```vue

<script setup>
  import {useFintI18n} from '@feugene/fint-i18n/vue'

  const {t} = useFintI18n()
  // files.count = { one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' }
</script>

<template>
  <p>{{ t('files.count', { n: 5 }) }}</p> <!-- 5 файлов -->
</template>
```

Выбор идёт через `Intl.PluralRules` **локали сообщения**: перевод, пришедший из
`fallbackLocale`, сохраняет свои правила.
Синтаксис: [defining-messages.md](./defining-messages.md#формы-множественного-числа).

## Форматирование чисел и дат

`useI18nFormat()` возвращает `n()` и `d()`, привязанные к текущей локали. Локаль читается в момент вызова, поэтому
значения перерисовываются после `setLocale()`.

```vue

<script setup>
  import {useI18nFormat} from '@feugene/fint-i18n/vue'

  const {n, d} = useI18nFormat()
</script>

<template>
  <span>{{ n(1234.5, { style: 'currency', currency: 'EUR' }) }}</span>
  <time>{{ d(Date.now(), { dateStyle: 'long' }) }}</time>
</template>
```

Опции передаются напрямую в `Intl.NumberFormat` / `Intl.DateTimeFormat`. Инстансы форматтеров кэшируются по локали и
опциям — их создание и есть дорогая часть.

Вне компонентов ту же пару можно собрать из любого источника локали:

```typescript
import {createFormatters} from '@feugene/fint-i18n/core'

const {n, d} = createFormatters(() => i18n.locale.value)
```

## Плагины

Библиотека предоставляет расширяемую систему плагинов. Подробное описание и примеры использования встроенных и кастомных
плагинов читайте в разделе [Плагины](./plugins.md).

---

Полный список всех функций, методов и параметров доступен в [Справочнике API](./api.md).
