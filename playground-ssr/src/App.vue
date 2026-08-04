<script setup lang="ts">
import Page from './Page.vue'
</script>

<template>
  <!-- `Page` использует асинхронный `useI18nScope`, поэтому ему нужен Suspense
       выше по дереву — и на сервере, и при гидрации на клиенте. -->
  <Suspense>
    <Page />
    <template #fallback>
      <p class="loading">Loading translations…</p>
    </template>
  </Suspense>
</template>
