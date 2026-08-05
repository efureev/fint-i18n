<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

/**
 * Загрузчик срабатывает при первом рендере компонента, а не при импорте этого
 * файла: до клика браузеру не нужен ни чанк, ни блок `promo`, а сервер их не
 * видит вовсе — `v-if` не даёт им попасть в разметку и, значит, в снимок.
 *
 * `suspensible: false` здесь обязателен: Suspense выше по дереву к моменту
 * клика уже разрешён, и асинхронная зависимость вернула бы его в pending —
 * фолбэк мигнул бы на всю страницу.
 */
const LazyBlockPanel = defineAsyncComponent({
  loader: () => import('./LazyBlockPanel.vue'),
  suspensible: false,
})

const shown = ref(false)

const { locale } = useFintI18n()
</script>

<template>
  <section class="panel">
    <h2>A deferred component with a deferred block</h2>

    <div class="row">
      <button class="chip" type="button" :disabled="shown" @click="shown = true">
        {{ shown ? 'Loaded' : 'Load the section' }}
      </button>
    </div>

    <LazyBlockPanel v-if="shown" />

    <p class="hint">
      Nothing of this section is in the server response: the markup is behind <code>v-if</code>, so
      the chunk is never imported and the <code>promo</code> block is never loaded — check the
      snapshot block list above, it lists only <code>common</code>, <code>cart</code> and
      <code>stats</code>.
    </p>

    <p class="hint">
      The click fetches two things, both visible in the Network tab: the component chunk and the
      block's JSON. The browser loader counter above stops being <span class="ok">0</span> — and
      <code>{{ locale }}:promo</code> is the only entry it gets, because hydration had already
      covered everything the server rendered.
    </p>
  </section>
</template>
