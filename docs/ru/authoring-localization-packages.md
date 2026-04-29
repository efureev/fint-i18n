# Гайд для авторов локализационных пакетов

Этот документ описывает рекомендуемый формат экспорта переводов для
любого пакета, который поставляет локализационные ресурсы для
`@feugene/fint-i18n` (UI-кит, бизнес-модуль, плагин и т.п.).

Главный принцип — **один экспорт на одну локаль**. Это нужно не самому
`fint-i18n` (движок прекрасно работает с любой формой
`LocaleLoaderCollection`), а **сборщику приложения**: только так Vite /
Rollup / webpack могут выкинуть из бандла языки, которые потребитель не
использует.

## Почему важен per-locale экспорт

Если пакет экспортирует один «жирный» объект со всеми локалями:

```ts
// ❌ так делать не нужно
export const fooLocaleLoaders = {
  en: { common: () => import('./locales/en/common.json'), /* ... */ },
  ru: { common: () => import('./locales/ru/common.json'), /* ... */ },
  de: { /* ... */ },
  fr: { /* ... */ },
  // ...
}
```

то даже если приложение через `setLocale('en' | 'ru')` никогда не
обратится к `de` / `fr` / …, **все динамические `import()`-чанки этих
локалей всё равно достижимы из графа модулей** и попадут в `dist`. Это
раздувает манифест, prefetch-стратегии и SSR-артефакты.

Опции вроде `supportedLocales` в `createFintI18n` эту проблему **не
решают**: они работают в рантайме, а tree-shaking — статический.

## Рекомендуемая структура пакета

```text
my-package/
  src/
    i18n/
      locales/
        en/...json
        ru/...json
        de/...json
        ...
      en.ts          # экспорт `en` — только английские лоадеры
      ru.ts          # экспорт `ru` — только русские
      de.ts
      ...
      index.ts       # барелл с именованными реэкспортами
      all.ts         # (опционально) агрегированный экспорт для демо/тестов
```

### Файл локали

```ts
// src/i18n/en.ts
import type { LocaleLoaderCollection } from '@feugene/fint-i18n/core'

export const en: LocaleLoaderCollection = {
  en: {
    common: () => import('./locales/en/common.json'),
    forms:  () => import('./locales/en/forms.json'),
  },
}

export default en
```

Файлы остальных локалей пишутся по той же схеме — отличается только
двухбуквенный ключ верхнего уровня и пути.

### Барелл `index.ts`

```ts
// src/i18n/index.ts
export { en } from './en'
export { ru } from './ru'
export { de } from './de'
// и т.д.
```

Именно `index.ts` обычно публикуется как `<package>/i18n` в `exports`
поле `package.json`. Если потребитель напишет:

```ts
import { en, ru } from 'my-package/i18n'
```

то модули `de.ts`, `fr.ts`, `…` **никогда не попадают в граф
зависимостей** и автоматически уходят при tree-shaking — независимо от
того, лежит там жирный JSON или большой набор `import()`.

### Опциональный `all.ts`

```ts
// src/i18n/all.ts — для демо, инструментов, e2e-тестов
import { en } from './en'
import { ru } from './ru'
import { de } from './de'

export const all = [en, ru, de /* ... */]
export default all
```

Этот экспорт **намеренно** заставляет тянуть все локали. Используйте его
только там, где tree-shaking не важен.

## Контракт пакета

1. **Экспортируйте каждую локаль отдельным именованным экспортом** в
   `<package>/i18n` (имя экспорта = ISO-код локали: `en`, `ru`, `pt-BR`
   как `ptBR` или `'pt-BR'` через `as`-алиас на стороне импортёра).
2. **Не используйте default-экспорт «жирного» объекта** для всех локалей
   как основной способ потребления.
3. Тип экспорта — всегда `LocaleLoaderCollection` (одна верхне-уровневая
   локаль внутри объекта).
4. **Не предполагайте конкретный язык приложения**: пакет должен спокойно
   работать, если приложение импортирует только одну вашу локаль.
5. **Не делайте side-effects в файлах локалей** (`sideEffects: false` в
   `package.json` или явный whitelist).

## Использование на стороне приложения

```ts
import { createFintI18n } from '@feugene/fint-i18n/core'
import { en as appEn, ru as appRu } from './i18n/messages'
import { en as granularityEn, ru as granularityRu } from '@feugene/granularity/i18n'

const i18n = createFintI18n({
  locale: 'ru',
  fallbackLocale: 'en',
  // Пакеты-доноры подключаются ровно теми локалями, что нужны проекту.
  loaders: [appEn, appRu, granularityEn, granularityRu],
})
```

При совпадении блоков `fint-i18n` смерджит loaders слева направо —
поэтому переводы приложения, поставленные раньше пакета-донора, будут
переопределяться его значениями (а пришедшие позже — наоборот). Подробные
правила см. в [Defining Messages](./defining-messages.md).

## Чек-лист

- [ ] Каждая локаль — отдельный модуль (`en.ts`, `ru.ts`, …).
- [ ] `index.ts` реэкспортирует локали именованно, без агрегатов по
      умолчанию.
- [ ] В `package.json` указан корректный `exports` для подпути `i18n`
      (`./i18n`), а `sideEffects` не блокирует tree-shaking.
- [ ] Файлы локалей не делают побочных эффектов и не импортируют друг
      друга.
- [ ] Опциональный `all` экспортируется отдельным подпутём
      (`<package>/i18n/all`), а не из основного барелла.
