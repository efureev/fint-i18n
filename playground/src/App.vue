<script setup lang="ts">
import Playground from './Playground.vue'
</script>

<template>
  <Suspense>
    <template #default>
      <Playground />
    </template>
    <template #fallback>
      <div class="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div class="text-center text-gray-400">
           <div class="i-lucide-loader-2 animate-spin w-12 h-12 mx-auto mb-4 text-indigo-500" />
           <p class="text-lg font-medium">Initializing i18n engine...</p>
        </div>
      </div>
    </template>
  </Suspense>
</template>
