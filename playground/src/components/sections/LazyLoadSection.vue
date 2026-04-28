<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const { t } = useFintI18n()

const showAuth = ref(false)

const AuthPanel = defineAsyncComponent({
  loader: () => import('../AuthPanel.vue'),
  onError(error) {
    throw error
  },
})

const showAuthPanel = () => {
  showAuth.value = true
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.lazy.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.lazy.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.lazy.description') }}
      </p>
    </div>

    <div class="mt-6 flex flex-col gap-4">
      <button
        v-if="!showAuth"
        data-test="load-auth"
        class="w-full py-3.5 border-2 border-dashed border-slate-300 rounded-2xl text-slate-600 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/60 transition-all flex items-center justify-center gap-2 font-medium"
        type="button"
        @click="showAuthPanel"
      >
        <span class="i-lucide-plus-circle" />
        {{ t('ui.sections.lazy.button') }}
      </button>

      <Suspense v-else>
        <template #default>
          <AuthPanel />
        </template>

        <template #fallback>
          <div class="p-8 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 bg-slate-50">
            <div class="i-lucide-loader-2 animate-spin mx-auto w-8 h-8 mb-3" />
            {{ t('ui.sections.lazy.loading') }}
          </div>
        </template>
      </Suspense>
    </div>
  </section>
</template>
