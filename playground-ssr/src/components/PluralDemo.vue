<script setup lang="ts">
import { computed, ref } from 'vue'
import { getPluralCategories, selectPluralCategory } from '@feugene/fint-i18n/core'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const { t, locale } = useFintI18n()

// Стартовое значение фиксировано, а не случайно: сервер и клиент обязаны
// отрисовать одно и то же, иначе гидрация разойдётся.
const count = ref(5)

const category = computed(() => selectPluralCategory(locale.value, count.value))
const order = computed(() => getPluralCategories(locale.value).join(' → '))
const samples = [0, 1, 2, 5, 11, 21, 101]
</script>

<template>
  <section class="panel">
    <h2>Pluralization</h2>

    <p class="lead">{{ t('cart.items', { n: count }) }}</p>

    <div class="row">
      <button
        v-for="sample in samples"
        :key="sample"
        type="button"
        :class="['chip', { active: count === sample }]"
        @click="count = sample"
      >
        {{ sample }}
      </button>
    </div>

    <dl class="grid">
      <dt>CLDR category</dt>
      <dd><code>{{ category }}</code></dd>

      <dt>Category order for this locale</dt>
      <dd><code>{{ order }}</code></dd>

      <dt>A string that merely contains a pipe</dt>
      <dd>{{ t('stats.columns') }}</dd>
    </dl>

    <p class="hint">
      Forms are an object keyed by CLDR category, so the server renders the correct Russian form for
      the initial count and the client keeps rendering it after hydration. Nothing in the message
      string is special: <code>{{ t('stats.columns') }}</code> is plain text.
    </p>
  </section>
</template>
