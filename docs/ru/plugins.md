# Плагины и расширение функционала

Библиотека `@feugene/fint-i18n` предоставляет расширяемую систему плагинов, основанную на хуках жизненного цикла. Это позволяет добавлять новый функционал (персистентность, логирование, интеграцию со сторонними библиотеками) без утяжеления ядра.

## Встроенные плагины

### PersistencePlugin

Этот плагин отвечает за сохранение выбранной локали в хранилище (по умолчанию `localStorage`) и синхронизацию её между открытыми вкладками браузера.

#### Установка

```typescript
import { createFintI18n } from '@feugene/fint-i18n/core'
import { PersistencePlugin, type PersistenceOptions } from '@feugene/fint-i18n/plugins'

const options: PersistenceOptions = {
  key: 'my-app-locale', // Ключ в localStorage
  syncTabs: true        // Синхронизация между вкладками
}

const i18n = createFintI18n({
  // ...
  plugins: [
    new PersistencePlugin(options)
  ]
})
```

##### Интерфейс `PersistenceOptions`

```typescript
interface PersistenceOptions {
  key?: string;      // Ключ для хранения локали (по умолчанию 'fint-i18n-locale')
  storage?: Storage; // Объект хранилища (по умолчанию localStorage)
  syncTabs?: boolean; // Синхронизация между вкладками браузера (true по умолчанию)
}
```

#### Особенности
- **Автоматическая загрузка**: При инициализации плагин проверяет наличие сохраненного значения в `storage`.
- **Синхронизация вкладок**: Использует событие `storage` для мгновенного обновления локали во всех открытых вкладках при её изменении в одной из них.

---

### BridgePlugin

Позволяет прозрачно использовать `fint-i18n` совместно с существующим инстансом `vue-i18n`. Это полезно в больших проектах или при использовании сторонних библиотек, зависящих от `vue-i18n`.

#### Установка

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

##### Интерфейс `BridgeOptions`

```typescript
interface BridgeOptions {
  i18n: any; // Экземпляр vue-i18n (Composer или Legacy i18n)
}
```

#### Особенности
- **Двусторонняя синхронизация**: При изменении локали в `fint-i18n`, она автоматически меняется в `vue-i18n` и наоборот.
- **Fallback переводы**: Если ключ не найден в блоках `fint-i18n`, плагин попытается разрешить его через `vue-i18n`.

---

### HookLoggerPlugin

Плагин для отладки, который пишет в консоль каждый вызванный хук `fint-i18n`. Полезен при диагностике загрузки блоков, переводов, смены локали и поиска отсутствующих ключей.

#### Установка

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

#### Пример использования

```typescript
await i18n.loadBlock('common')
i18n.t('common.greeting', { name: 'John' })
await i18n.setLocale('fr')

// Консоль:
// [demo-i18n] "afterInit" called undefined
// [demo-i18n] "beforeLoadBlock" called common
// [demo-i18n] "afterLoadBlock" called { block: 'common', locale: 'en', messages: { ... } }
// [demo-i18n] "onTranslate" called { key: 'common.greeting', params: { name: 'John' }, result: 'Hello John' }
// [demo-i18n] "onLocaleChange" called { locale: 'fr', previous: 'en' }
```

##### Интерфейс `HookLoggerPluginOptions`

```typescript
interface HookLoggerPluginOptions {
  logger?: (message?: any, ...optionalParams: any[]) => void; // Функция логирования, по умолчанию console.log
  prefix?: string; // Префикс сообщения, по умолчанию '[fint-i18n] Hook'
}
```

#### Особенности
- **Логирует все встроенные хуки**: `beforeInit`, `afterInit`, `onLocaleChange`, `beforeLoadBlock`, `afterLoadBlock`, `onMissingKey`, `onTranslate`.
- **Не влияет на поток данных**: Плагин возвращает исходный payload каждого хука и подходит для безопасной отладки.
- **Настраиваемый вывод**: Можно передать собственный `logger` и изменить `prefix`.

---

## Создание собственного плагина

Система плагинов построена на классах, которые реализуют метод `install(instance)`. Внутри этого метода вы можете подписываться на хуки.

```typescript
import type { FintI18n, FintI18nPlugin } from '@feugene/fint-i18n/core'

export class MyLoggerPlugin implements FintI18nPlugin {
  public name = 'my-logger'

  install(i18n: FintI18n) {
    // Подписка на хук перевода
    const off = i18n.hooks.on('onTranslate', (data) => {
      console.log(`[i18n] Перевод ключа "${data.key}": ${data.result}`)
    })

    // Позже можно вызвать off() для отписки
  }
}
```

### Доступные хуки

| Хук | Описание | Тип данных (Data) |
| :--- | :--- | :--- |
| `afterInit` | Вызывается после инициализации инстанса | `void` |
| `onLocaleChange` | Вызывается при смене языка | `{ locale: Locale, previous: Locale }` |
| `onTranslate` (Sync) | Вызывается в момент перевода (в `t()`) | `{ key: string, params?: Record<string, any>, result: string }` |
| `beforeLoadBlock` | Перед началом загрузки блока | `string` (имя блока) |
| `afterLoadBlock` | После успешной загрузки блока | `{ block: string, messages: any }` |
| `onMissingKey` | Если ключ не найден в текущей локали | `{ locale: Locale, key: string }` |
