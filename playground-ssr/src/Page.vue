<script setup lang="ts">
import { useFintI18n, useI18nScope } from '@feugene/fint-i18n/vue'
import FormatDemo from './components/FormatDemo.vue'
import PluralDemo from './components/PluralDemo.vue'
import SsrPanel from './components/SsrPanel.vue'

// На сервере `renderToString` дожидается этого await, поэтому к моменту снятия
// снимка блоки уже загружены. На клиенте после `hydrate()` он разрешается
// мгновенно — блоки помечены загруженными, в сеть никто не идёт.
await useI18nScope(['common', 'cart', 'stats'])

const { t, locale, setLocale } = useFintI18n()

const other = locale.value === 'ru' ? 'en' : 'ru'
</script>

<template>
  <main>
    <header class="head">
      <h1>{{ t('common.title') }}</h1>
      <p>{{ t('common.greeting', { name: 'Eugene' }) }}</p>
      <p class="row">
        <a class="chip" :href="`?locale=${other}`">Switch to {{ other }}</a>
        <button class="chip" type="button" @click="setLocale(other)">
          setLocale('{{ other }}') without a reload
        </button>
      </p>
    </header>

    <SsrPanel />
    <PluralDemo />
    <FormatDemo />
  </main>
</template>
