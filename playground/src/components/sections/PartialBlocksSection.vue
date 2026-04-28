<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { t } = i18n

const isArticlesLoaded = ref(false)
const isPageLoaded = ref(false)

const loadArticles = async () => {
  await i18n.loadBlock('page.articles')
  isArticlesLoaded.value = true
}

const loadFullPage = async () => {
  await i18n.loadBlock('page')
  isPageLoaded.value = true
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.partial.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.partial.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.partial.description') }}
      </p>
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-2">
      <button
        data-test="load-articles"
        class="p-4 rounded-2xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100/80 transition flex flex-col items-start text-left"
        type="button"
        @click="loadArticles"
      >
        <span class="i-lucide-file-text text-emerald-600 mb-3 text-lg" />
        <span class="text-sm font-bold text-emerald-900">{{ t('ui.sections.partial.loadArticles') }}</span>
        <span class="text-xs text-emerald-700/80 mt-1">{{ t('ui.sections.partial.loadArticlesHint') }}</span>
        <span class="mt-4 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          <span class="i-lucide-check-circle-2" />
          {{ isArticlesLoaded ? t('ui.status.loaded') : t('ui.status.ready') }}
        </span>
      </button>

      <button
        data-test="load-page"
        class="p-4 rounded-2xl border border-violet-100 bg-violet-50 hover:bg-violet-100/80 transition flex flex-col items-start text-left"
        type="button"
        @click="loadFullPage"
      >
        <span class="i-lucide-layers text-violet-600 mb-3 text-lg" />
        <span class="text-sm font-bold text-violet-900">{{ t('ui.sections.partial.loadPage') }}</span>
        <span class="text-xs text-violet-700/80 mt-1">{{ t('ui.sections.partial.loadPageHint') }}</span>
        <span class="mt-4 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-violet-700">
          <span class="i-lucide-check-circle-2" />
          {{ isPageLoaded ? t('ui.status.loaded') : t('ui.status.ready') }}
        </span>
      </button>
    </div>

    <div v-if="isArticlesLoaded || isPageLoaded" class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 flex flex-col gap-4">
      <div v-if="isArticlesLoaded">
        <h3 class="text-lg font-semibold text-slate-900">{{ t('page.articles.title') }}</h3>
        <p class="text-sm text-slate-600 mt-1">{{ t('page.articles.description') }}</p>
      </div>

      <div v-if="isPageLoaded" class="border-t border-slate-200 pt-4">
        <h4 class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500 mb-3">
          {{ t('ui.sections.partial.fullPageLabel') }}
        </h4>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p class="text-sm text-indigo-700 font-semibold">{{ t('page.terms.title') }}</p>
          <p class="text-sm text-slate-600 mt-1">{{ t('page.terms.content') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
